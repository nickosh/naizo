/**
 * naka.js v0.1.0 — Self-Persisting HTML Inner Database (#nakadb) & List Repeater
 * Syncs DOM State & Lists <-> <script id="nakadb" type="application/json"> <-> Local Disk
 * Supports both short `naka` / `naka-*` and HTML5 `data-naka` / `data-naka-*` attributes.
 * License: MIT
 */
(() => {
  const DB_ID = 'nakadb';
  const UI_ID = '__nakadb_host__';
  const STYLE_ID = '__nakadb_styles__';
  const PAGE_KEY = 'nakadb_state_' + location.pathname;
  const SNAPSHOT_KEY = 'nakadb_disk_hash_' + location.pathname;
  const IDB_NAME = 'NakaDB_Handles';

  const NOT_IGNORED = ':not([naka-ignore]):not([data-naka-ignore])';
  const TRACKED_SELECTOR = [
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[naka]',
    '[data-naka]',
    '[data-naka-field]',
  ]
    .map((sel) => `${sel}${NOT_IGNORED}`)
    .join(', ');

  const LIST_SELECTOR = '[naka-list], [data-naka-list]';
  const ITEM_SELECTOR = '[naka-item], [data-naka-item]';
  const DIRECT_ITEM_SELECTOR = ':scope > [naka-item], :scope > [data-naka-item]';
  const TEMPLATE_SELECTOR = 'template[naka-template], template[data-naka-template], template';
  const IGNORE_SELECTOR = '[naka-ignore], [data-naka-ignore]';

  let fileHandle = null;
  let saveTimeout = null;
  let statusEl = null;
  let actionBtn = null;

  function getAttr(el, shortName) {
    return el.getAttribute(shortName) ?? el.getAttribute('data-' + shortName);
  }

  function hasAttr(el, shortName) {
    return el.hasAttribute(shortName) || el.hasAttribute('data-' + shortName);
  }

  function escapeSelectorAttr(val) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(val);
    }
    return val.replace(/["\\]/g, '\\$&');
  }

  function findListElement(listName) {
    const escaped = escapeSelectorAttr(listName);
    return document.querySelector(`[naka-list="${escaped}"], [data-naka-list="${escaped}"]`);
  }

  // --- 1. IndexedDB Helper for Persisting FileSystemFileHandle ---
  function idbStore(mode, callback) {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('handles');
      req.onsuccess = () => {
        const tx = req.result.transaction('handles', mode);
        callback(tx.objectStore('handles'));
      };
    } catch (e) {
      // Fallback if IndexedDB is restricted on file:// protocol
    }
  }

  function saveHandleToIDB(handle) {
    idbStore('readwrite', (store) => store.put(handle, PAGE_KEY));
  }

  function loadHandleFromIDB() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore('handles');
        req.onsuccess = () => {
          const tx = req.result.transaction('handles', 'readonly');
          const getReq = tx.objectStore('handles').get(PAGE_KEY);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  // --- 2. Ensure <script id="nakadb" type="application/json"> Exists ---
  function getDbScript() {
    let el = document.getElementById(DB_ID);
    if (!el) {
      el = document.createElement('script');
      el.id = DB_ID;
      el.type = 'application/json';
      el.textContent = '\n{\n  "_meta": {},\n  "fields": {},\n  "lists": {},\n  "custom": {}\n}\n';
      document.head.prepend(el);
    }
    return el;
  }

  function parseDbScript() {
    try {
      const raw = getDbScript().textContent.trim();
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        _meta: parsed._meta && typeof parsed._meta === 'object' ? parsed._meta : {},
        fields: parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : {},
        lists: parsed.lists && typeof parsed.lists === 'object' ? parsed.lists : {},
        custom: parsed.custom && typeof parsed.custom === 'object' ? parsed.custom : {},
      };
    } catch (e) {
      console.warn('[naka.js] Invalid JSON in #nakadb, resetting.', e);
      return { _meta: {}, fields: {}, lists: {}, custom: {} };
    }
  }

  function parseCachedState(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        _meta: parsed._meta && typeof parsed._meta === 'object' ? parsed._meta : {},
        fields: parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : {},
        lists: parsed.lists && typeof parsed.lists === 'object' ? parsed.lists : {},
        custom: parsed.custom && typeof parsed.custom === 'object' ? parsed.custom : {},
      };
    } catch (e) {
      console.warn('[naka.js] Invalid JSON in localStorage cache, ignoring.', e);
      return null;
    }
  }

  // --- 3. Element Value Helpers (Read, Write & Attribute Baking) ---
  function getElementKey(el, idx) {
    return (
      getAttr(el, 'naka') ||
      el.getAttribute('data-naka-field') ||
      el.id ||
      el.name ||
      `field_${idx}`
    );
  }

  function readAndBakeElement(el) {
    if (el.type === 'checkbox') {
      el.checked ? el.setAttribute('checked', 'checked') : el.removeAttribute('checked');
      return el.checked;
    }
    if (el.type === 'radio') {
      if (el.checked) {
        el.setAttribute('checked', 'checked');
        return el.value;
      }
      el.removeAttribute('checked');
      return undefined;
    }
    if (el.tagName === 'SELECT') {
      Array.from(el.options).forEach((opt) => {
        opt.selected ? opt.setAttribute('selected', 'selected') : opt.removeAttribute('selected');
      });
      return el.value;
    }
    if (el.tagName === 'TEXTAREA') {
      el.textContent = el.value;
      return el.value;
    }
    if (el.tagName === 'INPUT') {
      el.setAttribute('value', el.value);
      return el.value;
    }
    if (el.hasAttribute('contenteditable')) {
      return el.innerHTML;
    }
    return el.textContent;
  }

  function writeElementValue(el, val) {
    if (el.type === 'checkbox') {
      el.checked = Boolean(val);
    } else if (el.type === 'radio') {
      el.checked = el.value === String(val);
    } else if (el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.value = val ?? '';
    } else if (el.hasAttribute('contenteditable')) {
      el.innerHTML = val ?? '';
    } else {
      el.textContent = val ?? '';
    }
    readAndBakeElement(el);
  }

  function clearElementValue(el) {
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = false;
      el.removeAttribute('checked');
    } else if (el.tagName === 'SELECT') {
      if (el.options.length) el.selectedIndex = 0;
      Array.from(el.options).forEach((opt, i) => {
        if (i === 0) opt.setAttribute('selected', 'selected');
        else opt.removeAttribute('selected');
      });
    } else if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.value = '';
      el.removeAttribute('value');
      if (el.tagName === 'TEXTAREA') el.textContent = '';
    } else if (el.hasAttribute('contenteditable')) {
      el.innerHTML = '';
    } else {
      el.textContent = '';
    }
  }

  // --- 4. Declarative List Repeater Engine ([naka-list] / [data-naka-list]) ---
  function ensureListBlueprints() {
    document.querySelectorAll(LIST_SELECTOR).forEach((listEl) => {
      let tpl = listEl.querySelector(TEMPLATE_SELECTOR);
      if (!tpl) {
        const firstItem = listEl.querySelector(ITEM_SELECTOR);
        if (!firstItem) return;
        const cleanClone = firstItem.cloneNode(true);
        cleanClone.querySelectorAll(IGNORE_SELECTOR).forEach((n) => n.remove());
        cleanClone.querySelectorAll(TRACKED_SELECTOR).forEach(clearElementValue);

        tpl = document.createElement('template');
        tpl.setAttribute('naka-template', '');
        tpl.content.appendChild(cleanClone);
        listEl.prepend(tpl);
      } else if (!hasAttr(tpl, 'naka-template')) {
        tpl.setAttribute('naka-template', '');
      }
    });
  }

  function decorateListControls(listEl) {
    if (hasAttr(listEl, 'naka-no-controls')) return;
    const listName = getAttr(listEl, 'naka-list');
    if (!listName) return;

    listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).forEach((itemEl) => {
      if (itemEl.querySelector('[naka-remove], [data-naka-remove]')) return;
      const tools = document.createElement('span');
      tools.className = 'naka-item-tools';
      tools.setAttribute('naka-ignore', 'true');
      tools.innerHTML = `
        <button type="button" naka-move="up" title="Move up">↑</button>
        <button type="button" naka-move="down" title="Move down">↓</button>
        <button type="button" naka-remove title="Delete item">×</button>
      `;
      itemEl.appendChild(tools);
    });

    const escaped = escapeSelectorAttr(listName);
    if (!document.querySelector(`[naka-add="${escaped}"], [data-naka-add="${escaped}"]`)) {
      const addWrap = document.createElement('div');
      addWrap.className = 'naka-list-footer';
      addWrap.setAttribute('naka-ignore', 'true');
      addWrap.innerHTML = `<button type="button" class="naka-add-btn" naka-add="${listName}">+ Add Item</button>`;
      listEl.insertAdjacentElement('afterend', addWrap);
    }
  }

  function createItemNode(listEl, itemData = {}) {
    const tpl = listEl.querySelector(TEMPLATE_SELECTOR);
    if (!tpl) return null;
    const fragment = tpl.content.cloneNode(true);
    const itemEl = fragment.querySelector(ITEM_SELECTOR) || fragment.firstElementChild;
    if (!itemEl) return null;

    itemEl.querySelectorAll(TRACKED_SELECTOR).forEach((el, idx) => {
      const key = getElementKey(el, idx);
      if (key in itemData) {
        writeElementValue(el, itemData[key]);
      }
    });
    return itemEl;
  }

  function renderListItems(listEl, itemsArray) {
    listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).forEach((el) => el.remove());
    itemsArray.forEach((itemData) => {
      const node = createItemNode(listEl, itemData);
      if (node) listEl.appendChild(node);
    });
    decorateListControls(listEl);
  }

  // --- 5. Full DOM <-> JSON Synchronization ---
  function captureDomToState() {
    const db = parseDbScript();
    db._meta.updatedAt = new Date().toISOString();

    db.fields = {};
    document.querySelectorAll(TRACKED_SELECTOR).forEach((el, idx) => {
      if (el.closest(`${ITEM_SELECTOR}, template`)) return;
      const key = getElementKey(el, idx);
      const val = readAndBakeElement(el);
      if (val !== undefined) db.fields[key] = val;
    });

    db.lists = {};
    document.querySelectorAll(LIST_SELECTOR).forEach((listEl) => {
      const listName = getAttr(listEl, 'naka-list');
      if (!listName) return;
      const items = [];
      listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).forEach((itemEl) => {
        const itemObj = {};
        itemEl.querySelectorAll(TRACKED_SELECTOR).forEach((el, idx) => {
          const key = getElementKey(el, idx);
          const val = readAndBakeElement(el);
          if (val !== undefined) itemObj[key] = val;
        });
        items.push(itemObj);
      });
      db.lists[listName] = items;
    });

    const formatted = '\n' + JSON.stringify(db, null, 2) + '\n';
    getDbScript().textContent = formatted;
    return { db, formatted };
  }

  function hydrateDomFromState(db) {
    if (!db) return;

    if (db.fields) {
      document.querySelectorAll(TRACKED_SELECTOR).forEach((el, idx) => {
        if (el.closest(`${ITEM_SELECTOR}, template`)) return;
        const key = getElementKey(el, idx);
        if (key in db.fields) writeElementValue(el, db.fields[key]);
      });
    }

    document.querySelectorAll(LIST_SELECTOR).forEach((listEl) => {
      const listName = getAttr(listEl, 'naka-list');
      if (listName && db.lists && Array.isArray(db.lists[listName])) {
        renderListItems(listEl, db.lists[listName]);
      } else {
        decorateListControls(listEl);
      }
    });

    captureDomToState();
    window.dispatchEvent(new CustomEvent('naka:hydrate', { detail: db }));
  }

  // --- 6. Clean Serialization (Strips Runtime UI Before Disk Save) ---
  function getCleanHtmlString() {
    captureDomToState();
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll(`${IGNORE_SELECTOR}, #${UI_ID}, #${STYLE_ID}`).forEach((el) => el.remove());
    return '<!DOCTYPE html>\n' + clone.outerHTML;
  }

  // --- 7. Persistence Engine (localStorage + File System Access API) ---
  async function writeToDisk() {
    if (!fileHandle) return false;
    try {
      const perm = await fileHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        updateUi('needs-permission', 'Resume Disk Sync');
        return false;
      }
      const htmlString = getCleanHtmlString();
      const writable = await fileHandle.createWritable();
      await writable.write(htmlString);
      await writable.close();

      localStorage.setItem(SNAPSHOT_KEY, getDbScript().textContent.trim());
      updateUi(
        'saved',
        'Saved ' +
          new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
      );
      return true;
    } catch (err) {
      console.warn('[naka.js] Disk write failed:', err);
      updateUi('cached', 'Cached in Browser · Link Disk');
      return false;
    }
  }

  function triggerSave() {
    const { db } = captureDomToState();
    localStorage.setItem(PAGE_KEY, JSON.stringify(db));

    if (!fileHandle) {
      updateUi('cached', 'Cached in Browser');
      return;
    }

    updateUi('saving', 'Saving...');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => writeToDisk(), 250);
  }

  async function connectOrResumeDisk() {
    if (fileHandle) {
      const perm = await fileHandle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        await writeToDisk();
        return;
      }
    }

    if ('showSaveFilePicker' in window) {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: location.pathname.split('/').pop() || 'index.html',
          types: [{ description: 'HTML Document', accept: { 'text/html': ['.html'] } }],
        });
        saveHandleToIDB(fileHandle);
        await writeToDisk();
      } catch (e) {
        /* User cancelled file picker */
      }
    } else {
      const blob = new Blob([getCleanHtmlString()], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = location.pathname.split('/').pop() || 'index.html';
      a.click();
      updateUi('saved', 'Downloaded HTML Snapshot');
    }
  }

  // --- 8. Lightweight Styles for Auto-Injected List Controls & Shadow Pill ---
  function mountUi() {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.setAttribute('naka-ignore', 'true');
      style.textContent = `
        [naka-item], [data-naka-item] { position: relative; }
        .naka-item-tools {
          display: inline-flex; gap: 3px; margin-left: auto; padding-left: 8px; opacity: 0.3;
          transition: opacity 0.15s; vertical-align: middle;
        }
        [naka-item]:hover .naka-item-tools, [data-naka-item]:hover .naka-item-tools { opacity: 1; }
        .naka-item-tools button {
          background: transparent; border: 1px solid #cbd5e1; color: #475569;
          border-radius: 4px; padding: 1px 6px; font: 11px/1.4 system-ui; cursor: pointer;
        }
        .naka-item-tools button:hover { background: #f1f5f9; color: #0f172a; }
        .naka-item-tools button[naka-remove]:hover, .naka-item-tools button[data-naka-remove]:hover {
          background: #fee2e2; color: #b91c1c; border-color: #fca5a5;
        }
        .naka-list-footer { margin: 10px 0 16px; }
        .naka-add-btn {
          background: #f8fafc; border: 1px dashed #94a3b8; color: #334155;
          border-radius: 6px; padding: 6px 12px; font: 500 12px system-ui; cursor: pointer;
        }
        .naka-add-btn:hover { background: #f1f5f9; border-color: #64748b; color: #0f172a; }
      `;
      document.head.appendChild(style);
    }

    const host = document.createElement('div');
    host.id = UI_ID;
    host.setAttribute('naka-ignore', 'true');
    const shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>
        .pill {
          position: fixed; bottom: 16px; right: 16px; z-index: 2147483647;
          display: flex; align-items: center; gap: 8px;
          background: #0f172a; color: #f8fafc; padding: 6px 12px;
          border-radius: 999px; font: 500 12px/1.2 system-ui, sans-serif;
          box-shadow: 0 4px 14px rgba(0,0,0,0.25); border: 1px solid #334155;
        }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; }
        .dot.saved { background: #10b981; }
        .dot.saving { background: #3b82f6; }
        button {
          background: #1e293b; color: #e2e8f0; border: 1px solid #475569;
          border-radius: 999px; padding: 4px 10px; font: inherit; cursor: pointer;
        }
        button:hover { background: #334155; color: #fff; }
      </style>
      <div class="pill">
        <span class="dot" id="dot"></span>
        <span id="status">naka.js Ready</span>
        <button id="action">Link Disk</button>
        <button id="copy" title="Copy #nakadb JSON state">{ } Copy</button>
      </div>
    `;

    statusEl = shadow.getElementById('status');
    actionBtn = shadow.getElementById('action');
    const dotEl = shadow.getElementById('dot');
    const copyBtn = shadow.getElementById('copy');

    actionBtn.addEventListener('click', connectOrResumeDisk);
    copyBtn.addEventListener('click', () => {
      const { formatted } = captureDomToState();
      navigator.clipboard.writeText(formatted.trim());
      copyBtn.textContent = '✓ Copied';
      setTimeout(() => (copyBtn.textContent = '{ } Copy'), 1500);
    });

    host._setDot = (state) => {
      dotEl.className = 'dot ' + (state === 'saved' ? 'saved' : state === 'saving' ? 'saving' : '');
    };

    document.body.appendChild(host);
  }

  function updateUi(state, message) {
    if (!statusEl) return;
    statusEl.textContent = message;
    document.getElementById(UI_ID)?._setDot(state);
    if (state === 'saved') {
      actionBtn.style.display = 'none';
    } else if (state === 'needs-permission') {
      actionBtn.style.display = 'inline-block';
      actionBtn.textContent = 'Resume Disk Sync';
    } else {
      actionBtn.style.display = 'inline-block';
      actionBtn.textContent = 'Link Disk';
    }
  }

  // --- 9. Event Delegation for List Actions (+ Add, × Remove, ↑/↓ Move) ---
  function handleListClicks(e) {
    const addBtn = e.target.closest('[naka-add], [data-naka-add]');
    if (addBtn) {
      const listName = getAttr(addBtn, 'naka-add');
      if (listName) window.Naka.addItem(listName, {});
      return;
    }

    const removeBtn = e.target.closest('[naka-remove], [data-naka-remove]');
    if (removeBtn) {
      const itemEl = removeBtn.closest(ITEM_SELECTOR);
      if (itemEl) {
        itemEl.remove();
        triggerSave();
      }
      return;
    }

    const moveBtn = e.target.closest('[naka-move], [data-naka-move]');
    if (moveBtn) {
      const dir = getAttr(moveBtn, 'naka-move');
      const itemEl = moveBtn.closest(ITEM_SELECTOR);
      if (!itemEl) return;
      const prev = itemEl.previousElementSibling;
      const next = itemEl.nextElementSibling;
      if (dir === 'up' && prev && hasAttr(prev, 'naka-item')) {
        itemEl.parentNode.insertBefore(itemEl, prev);
        triggerSave();
      } else if (dir === 'down' && next && hasAttr(next, 'naka-item')) {
        itemEl.parentNode.insertBefore(next, itemEl);
        triggerSave();
      }
    }
  }

  // --- 10. Public API (window.Naka & window.NakaDB alias) ---
  const api = {
    get(key) {
      const db = parseDbScript();
      return key ? db.custom[key] : db;
    },
    set(key, value) {
      const db = parseDbScript();
      db.custom[key] = value;
      db._meta.updatedAt = new Date().toISOString();
      getDbScript().textContent = '\n' + JSON.stringify(db, null, 2) + '\n';
      triggerSave();
    },
    getList(listName) {
      return parseDbScript().lists[listName] || [];
    },
    addItem(listName, itemData = {}) {
      const listEl = findListElement(listName);
      if (!listEl) return;
      const node = createItemNode(listEl, itemData);
      if (node) {
        listEl.appendChild(node);
        decorateListControls(listEl);
        const firstInput = node.querySelector(
          'input[type="text"], [contenteditable="true"], textarea',
        );
        if (firstInput) firstInput.focus();
        triggerSave();
      }
    },
    removeItem(listName, index) {
      const listEl = findListElement(listName);
      if (!listEl) return;
      const items = listEl.querySelectorAll(DIRECT_ITEM_SELECTOR);
      if (items[index]) {
        items[index].remove();
        triggerSave();
      }
    },
    moveItem(listName, fromIndex, toIndex) {
      const listEl = findListElement(listName);
      if (!listEl) return;
      const items = Array.from(listEl.querySelectorAll(DIRECT_ITEM_SELECTOR));
      if (!items[fromIndex] || !items[toIndex] || fromIndex === toIndex) return;
      const target = items[toIndex];
      listEl.insertBefore(items[fromIndex], fromIndex < toIndex ? target.nextSibling : target);
      triggerSave();
    },
    save: triggerSave,
    exportHTML: getCleanHtmlString,
  };

  window.Naka = api;
  window.NakaDB = api;

  // --- 11. Boot & Smart Conflict Resolution (Disk vs Browser Cache) ---
  async function init() {
    mountUi();
    ensureListBlueprints();

    const currentDiskRaw = getDbScript().textContent.trim();
    const lastKnownDiskRaw = localStorage.getItem(SNAPSHOT_KEY);
    const diskState = parseDbScript();
    const cachedState = parseCachedState(localStorage.getItem(PAGE_KEY));

    const diskModifiedExternally =
      lastKnownDiskRaw !== null && currentDiskRaw !== lastKnownDiskRaw;

    if (diskModifiedExternally || !cachedState) {
      hydrateDomFromState(diskState);
      localStorage.setItem(PAGE_KEY, JSON.stringify(parseDbScript()));
      localStorage.setItem(SNAPSHOT_KEY, getDbScript().textContent.trim());
    } else {
      hydrateDomFromState(cachedState);
    }

    fileHandle = await loadHandleFromIDB();
    if (fileHandle) {
      const perm = await fileHandle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        updateUi('saved', 'Disk Sync Active');
      } else {
        updateUi('needs-permission', 'File Remembered');
      }
    }

    document.addEventListener('click', handleListClicks);
    document.addEventListener('input', (e) => {
      if (!e.target.closest(`#${UI_ID}`)) triggerSave();
    });
    document.addEventListener('change', (e) => {
      if (!e.target.closest(`#${UI_ID}`)) triggerSave();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
