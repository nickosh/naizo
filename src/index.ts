/**
 * naizo.js — Self-Persisting HTML Built-In Database (#naizodb) & List Repeater
 * Syncs DOM State & Lists <-> <script id="naizodb" type="application/json"> <-> Local Disk
 * Supports both short `naizo` / `naizo-*` and HTML5 `data-naizo` / `data-naizo-*` attributes.
 * License: MIT
 */

export interface NaizoMeta {
  updatedAt?: string;
  [key: string]: unknown;
}

export interface NaizoDatabase {
  _meta: NaizoMeta;
  fields: Record<string, unknown>;
  lists: Record<string, Array<Record<string, unknown>>>;
  custom: Record<string, unknown>;
}

export interface NaizoAPI {
  init(): Promise<void>;
  get(key?: string): unknown;
  set(key: string, value: unknown): void;
  getList(listName: string): Array<Record<string, unknown>>;
  addItem(listName: string, itemData?: Record<string, unknown>): void;
  removeItem(listName: string, index: number): void;
  moveItem(listName: string, fromIndex: number, toIndex: number): void;
  save(): void;
  exportHTML(): string;
}

interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemWritableFileStream {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface NaizoFileHandle {
  queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface NaizoHostElement extends HTMLDivElement {
  _setDot?: (state: string) => void;
}

declare global {
  interface Window {
    Naizo: NaizoAPI;
    NaizoDB: NaizoAPI;
    showSaveFilePicker?: (options?: Record<string, unknown>) => Promise<NaizoFileHandle>;
  }
}

const DB_ID = 'naizodb';
const UI_ID = '__naizodb_host__';
const STYLE_ID = '__naizodb_styles__';
const IDB_NAME = 'NaizoDB_Handles';

const NOT_IGNORED = ':not([naizo-ignore]):not([data-naizo-ignore])';
const TRACKED_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[naizo]',
  '[data-naizo]',
  '[data-naizo-field]',
]
  .map((sel) => `${sel}${NOT_IGNORED}`)
  .join(', ');

const LIST_SELECTOR = '[naizo-list], [data-naizo-list]';
const ITEM_SELECTOR = '[naizo-item], [data-naizo-item]';
const DIRECT_ITEM_SELECTOR = ':scope > [naizo-item], :scope > [data-naizo-item]';
const TEMPLATE_SELECTOR = 'template[naizo-template], template[data-naizo-template], template';
const IGNORE_SELECTOR = '[naizo-ignore], [data-naizo-ignore]';

function getPageKey(): string {
  return 'naizodb_state_' + (typeof location !== 'undefined' ? location.pathname : '/');
}

function getSnapshotKey(): string {
  return 'naizodb_disk_hash_' + (typeof location !== 'undefined' ? location.pathname : '/');
}

function getAttr(el: Element, shortName: string): string | null {
  return el.getAttribute(shortName) ?? el.getAttribute(`data-${shortName}`);
}

function hasAttr(el: Element, shortName: string): boolean {
  return el.hasAttribute(shortName) || el.hasAttribute(`data-${shortName}`);
}

function escapeSelectorAttr(val: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(val);
  }
  return val.replace(/["\\]/g, '\\$&');
}

function findListElement(listName: string): HTMLElement | null {
  const escaped = escapeSelectorAttr(listName);
  return document.querySelector<HTMLElement>(
    `[naizo-list="${escaped}"], [data-naizo-list="${escaped}"]`,
  );
}

function toTextValue(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint') {
    return String(val);
  }
  return JSON.stringify(val);
}

let fileHandle: NaizoFileHandle | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let statusEl: HTMLElement | null = null;
let actionBtn: HTMLButtonElement | null = null;
let listenersAttached = false;

// --- 1. IndexedDB Helper for Persisting FileSystemFileHandle ---
function idbStore(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => void): void {
  try {
    if (typeof indexedDB === 'undefined') return;
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => {
      const tx = req.result.transaction('handles', mode);
      callback(tx.objectStore('handles'));
    };
  } catch {
    // Fallback if IndexedDB is restricted on file:// protocol
  }
}

function saveHandleToIDB(handle: NaizoFileHandle): void {
  idbStore('readwrite', (store) => store.put(handle, getPageKey()));
}

function loadHandleFromIDB(): Promise<NaizoFileHandle | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('handles');
      req.onsuccess = () => {
        const tx = req.result.transaction('handles', 'readonly');
        const getReq = tx.objectStore('handles').get(getPageKey());
        getReq.onsuccess = () => resolve((getReq.result as NaizoFileHandle | undefined) ?? null);
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// --- 2. Ensure <script id="naizodb" type="application/json"> Exists ---
export function getDbScript(): HTMLScriptElement {
  let el = document.getElementById(DB_ID) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = DB_ID;
    el.type = 'application/json';
    el.textContent = '\n{\n  "_meta": {},\n  "fields": {},\n  "lists": {},\n  "custom": {}\n}\n';
    document.head.prepend(el);
  }
  return el;
}

export function parseDbScript(): NaizoDatabase {
  try {
    const raw = getDbScript().textContent?.trim() ?? '';
    const parsed = raw ? (JSON.parse(raw) as Partial<NaizoDatabase>) : {};
    return {
      _meta: parsed._meta && typeof parsed._meta === 'object' ? parsed._meta : {},
      fields: parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : {},
      lists: parsed.lists && typeof parsed.lists === 'object' ? parsed.lists : {},
      custom: parsed.custom && typeof parsed.custom === 'object' ? parsed.custom : {},
    };
  } catch (e) {
    console.warn('[naizo.js] Invalid JSON in #naizodb, resetting.', e);
    return { _meta: {}, fields: {}, lists: {}, custom: {} };
  }
}

function parseCachedState(raw: string | null): NaizoDatabase | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<NaizoDatabase>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      _meta: parsed._meta && typeof parsed._meta === 'object' ? parsed._meta : {},
      fields: parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : {},
      lists: parsed.lists && typeof parsed.lists === 'object' ? parsed.lists : {},
      custom: parsed.custom && typeof parsed.custom === 'object' ? parsed.custom : {},
    };
  } catch (e) {
    console.warn('[naizo.js] Invalid JSON in localStorage cache, ignoring.', e);
    return null;
  }
}

// --- 3. Element Value Helpers (Read, Write & Attribute Baking) ---
function getElementKey(el: Element, idx: number): string {
  return (
    getAttr(el, 'naizo') ||
    el.getAttribute('data-naizo-field') ||
    el.id ||
    el.getAttribute('name') ||
    `field_${idx}`
  );
}

function readAndBakeElement(el: Element): unknown {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox') {
      if (el.checked) {
        el.setAttribute('checked', 'checked');
      } else {
        el.removeAttribute('checked');
      }
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
    el.setAttribute('value', el.value);
    return el.value;
  }
  if (el instanceof HTMLSelectElement) {
    Array.from(el.options).forEach((opt) => {
      if (opt.selected) {
        opt.setAttribute('selected', 'selected');
      } else {
        opt.removeAttribute('selected');
      }
    });
    return el.value;
  }
  if (el instanceof HTMLTextAreaElement) {
    el.textContent = el.value;
    return el.value;
  }
  if (el.hasAttribute('contenteditable')) {
    return el.innerHTML;
  }
  return el.textContent ?? '';
}

function writeElementValue(el: Element, val: unknown): void {
  const textVal = toTextValue(val);
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox') {
      el.checked = Boolean(val);
    } else if (el.type === 'radio') {
      el.checked = el.value === textVal;
    } else {
      el.value = textVal;
    }
  } else if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    el.value = textVal;
  } else if (el.hasAttribute('contenteditable')) {
    el.innerHTML = textVal;
  } else {
    el.textContent = textVal;
  }
  readAndBakeElement(el);
}

function clearElementValue(el: Element): void {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = false;
      el.removeAttribute('checked');
    } else {
      el.value = '';
      el.removeAttribute('value');
    }
  } else if (el instanceof HTMLSelectElement) {
    if (el.options.length) el.selectedIndex = 0;
    Array.from(el.options).forEach((opt, i) => {
      if (i === 0) opt.setAttribute('selected', 'selected');
      else opt.removeAttribute('selected');
    });
  } else if (el instanceof HTMLTextAreaElement) {
    el.value = '';
    el.textContent = '';
  } else if (el.hasAttribute('contenteditable')) {
    el.innerHTML = '';
  } else {
    el.textContent = '';
  }
}

// --- 4. Declarative List Repeater Engine ([naizo-list] / [data-naizo-list]) ---
function ensureListBlueprints(): void {
  document.querySelectorAll<HTMLElement>(LIST_SELECTOR).forEach((listEl) => {
    let tpl = listEl.querySelector<HTMLTemplateElement>(TEMPLATE_SELECTOR);
    if (!tpl) {
      const firstItem = listEl.querySelector<HTMLElement>(ITEM_SELECTOR);
      if (!firstItem) return;
      const cleanClone = firstItem.cloneNode(true) as HTMLElement;
      cleanClone.querySelectorAll(IGNORE_SELECTOR).forEach((n) => n.remove());
      cleanClone.querySelectorAll(TRACKED_SELECTOR).forEach(clearElementValue);

      tpl = document.createElement('template');
      tpl.setAttribute('naizo-template', '');
      tpl.content.appendChild(cleanClone);
      listEl.prepend(tpl);
    } else if (!hasAttr(tpl, 'naizo-template')) {
      tpl.setAttribute('naizo-template', '');
    }
  });
}

function decorateListControls(listEl: HTMLElement): void {
  if (hasAttr(listEl, 'naizo-no-controls')) return;
  const listName = getAttr(listEl, 'naizo-list');
  if (!listName) return;

  listEl.querySelectorAll<HTMLElement>(DIRECT_ITEM_SELECTOR).forEach((itemEl) => {
    if (itemEl.querySelector('[naizo-remove], [data-naizo-remove]')) return;
    const tools = document.createElement('span');
    tools.className = 'naizo-item-tools';
    tools.setAttribute('naizo-ignore', 'true');
    tools.innerHTML = `
      <button type="button" naizo-move="up" title="Move up">↑</button>
      <button type="button" naizo-move="down" title="Move down">↓</button>
      <button type="button" naizo-remove title="Delete item">×</button>
    `;
    itemEl.appendChild(tools);
  });

  const escaped = escapeSelectorAttr(listName);
  if (!document.querySelector(`[naizo-add="${escaped}"], [data-naizo-add="${escaped}"]`)) {
    const addWrap = document.createElement('div');
    addWrap.className = 'naizo-list-footer';
    addWrap.setAttribute('naizo-ignore', 'true');
    addWrap.innerHTML = `<button type="button" class="naizo-add-btn" naizo-add="${listName}">+ Add Item</button>`;
    listEl.insertAdjacentElement('afterend', addWrap);
  }
}

function createItemNode(
  listEl: HTMLElement,
  itemData: Record<string, unknown> = {},
): HTMLElement | null {
  const tpl = listEl.querySelector<HTMLTemplateElement>(TEMPLATE_SELECTOR);
  if (!tpl) return null;
  const fragment = tpl.content.cloneNode(true) as DocumentFragment;
  const itemEl =
    fragment.querySelector<HTMLElement>(ITEM_SELECTOR) ??
    (fragment.firstElementChild as HTMLElement | null);
  if (!itemEl) return null;

  itemEl.querySelectorAll(TRACKED_SELECTOR).forEach((el, idx) => {
    const key = getElementKey(el, idx);
    if (key in itemData) {
      writeElementValue(el, itemData[key]);
    }
  });
  return itemEl;
}

function renderListItems(listEl: HTMLElement, itemsArray: Array<Record<string, unknown>>): void {
  listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).forEach((el) => el.remove());
  itemsArray.forEach((itemData) => {
    const node = createItemNode(listEl, itemData);
    if (node) listEl.appendChild(node);
  });
  decorateListControls(listEl);
}

// --- 5. Full DOM <-> JSON Synchronization ---
export function captureDomToState(): { db: NaizoDatabase; formatted: string } {
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
  document.querySelectorAll<HTMLElement>(LIST_SELECTOR).forEach((listEl) => {
    const listName = getAttr(listEl, 'naizo-list');
    if (!listName) return;
    const items: Array<Record<string, unknown>> = [];
    listEl.querySelectorAll<HTMLElement>(DIRECT_ITEM_SELECTOR).forEach((itemEl) => {
      const itemObj: Record<string, unknown> = {};
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

export function hydrateDomFromState(db: NaizoDatabase | null): void {
  if (!db) return;

  if (db.fields) {
    document.querySelectorAll(TRACKED_SELECTOR).forEach((el, idx) => {
      if (el.closest(`${ITEM_SELECTOR}, template`)) return;
      const key = getElementKey(el, idx);
      if (key in db.fields) writeElementValue(el, db.fields[key]);
    });
  }

  document.querySelectorAll<HTMLElement>(LIST_SELECTOR).forEach((listEl) => {
    const listName = getAttr(listEl, 'naizo-list');
    if (listName && db.lists && Array.isArray(db.lists[listName])) {
      renderListItems(listEl, db.lists[listName]);
    } else {
      decorateListControls(listEl);
    }
  });

  captureDomToState();
  window.dispatchEvent(new CustomEvent('naizo:hydrate', { detail: db }));
}

// --- 6. Clean Serialization (Strips Runtime UI Before Disk Save) ---
export function getCleanHtmlString(): string {
  captureDomToState();
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(`${IGNORE_SELECTOR}, #${UI_ID}, #${STYLE_ID}`)
    .forEach((el) => el.remove());
  return '<!DOCTYPE html>\n' + clone.outerHTML;
}

// --- 7. Persistence Engine (localStorage + File System Access API) ---
async function writeToDisk(): Promise<boolean> {
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

    localStorage.setItem(getSnapshotKey(), getDbScript().textContent?.trim() ?? '');
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
    console.warn('[naizo.js] Disk write failed:', err);
    updateUi('cached', 'Cached in Browser · Link Disk');
    return false;
  }
}

export function triggerSave(): void {
  const { db } = captureDomToState();
  try {
    localStorage.setItem(getPageKey(), JSON.stringify(db));
  } catch {
    // Ignore storage quota / security errors
  }

  if (!fileHandle) {
    updateUi('cached', 'Cached in Browser');
    return;
  }

  updateUi('saving', 'Saving...');
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    void writeToDisk();
  }, 250);
}

async function connectOrResumeDisk(): Promise<void> {
  if (fileHandle) {
    const perm = await fileHandle.requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      await writeToDisk();
      return;
    }
  }

  if (typeof window.showSaveFilePicker === 'function') {
    try {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: location.pathname.split('/').pop() || 'index.html',
        types: [{ description: 'HTML Document', accept: { 'text/html': ['.html'] } }],
      });
      saveHandleToIDB(fileHandle);
      await writeToDisk();
    } catch {
      // User cancelled file picker
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
function mountUi(): void {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.setAttribute('naizo-ignore', 'true');
    style.textContent = `
      [naizo-item], [data-naizo-item] { position: relative; }
      .naizo-item-tools {
        display: inline-flex; gap: 3px; margin-left: auto; padding-left: 8px; opacity: 0.3;
        transition: opacity 0.15s; vertical-align: middle;
      }
      [naizo-item]:hover .naizo-item-tools, [data-naizo-item]:hover .naizo-item-tools { opacity: 1; }
      .naizo-item-tools button {
        background: transparent; border: 1px solid #cbd5e1; color: #475569;
        border-radius: 4px; padding: 1px 6px; font: 11px/1.4 system-ui; cursor: pointer;
      }
      .naizo-item-tools button:hover { background: #f1f5f9; color: #0f172a; }
      .naizo-item-tools button[naizo-remove]:hover, .naizo-item-tools button[data-naizo-remove]:hover {
        background: #fee2e2; color: #b91c1c; border-color: #fca5a5;
      }
      .naizo-list-footer { margin: 10px 0 16px; }
      .naizo-add-btn {
        background: #f8fafc; border: 1px dashed #94a3b8; color: #334155;
        border-radius: 6px; padding: 6px 12px; font: 500 12px system-ui; cursor: pointer;
      }
      .naizo-add-btn:hover { background: #f1f5f9; border-color: #64748b; color: #0f172a; }
    `;
    document.head.appendChild(style);
  }

  const existingHost = document.getElementById(UI_ID);
  if (existingHost) existingHost.remove();

  const host = document.createElement('div') as NaizoHostElement;
  host.id = UI_ID;
  host.setAttribute('naizo-ignore', 'true');
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
      <span id="status">naizo.js Ready</span>
      <button id="action">Link Disk</button>
      <button id="copy" title="Copy #naizodb JSON state">{ } Copy</button>
    </div>
  `;

  statusEl = shadow.getElementById('status');
  actionBtn = shadow.getElementById('action') as HTMLButtonElement | null;
  const dotEl = shadow.getElementById('dot');
  const copyBtn = shadow.getElementById('copy') as HTMLButtonElement | null;

  actionBtn?.addEventListener('click', () => {
    void connectOrResumeDisk();
  });
  copyBtn?.addEventListener('click', () => {
    const { formatted } = captureDomToState();
    void navigator.clipboard?.writeText(formatted.trim());
    copyBtn.textContent = '✓ Copied';
    setTimeout(() => {
      copyBtn.textContent = '{ } Copy';
    }, 1500);
  });

  host._setDot = (state: string) => {
    if (dotEl) {
      dotEl.className = 'dot ' + (state === 'saved' ? 'saved' : state === 'saving' ? 'saving' : '');
    }
  };

  document.body.appendChild(host);
}

function updateUi(state: string, message: string): void {
  if (!statusEl || !actionBtn) return;
  statusEl.textContent = message;
  (document.getElementById(UI_ID) as NaizoHostElement | null)?._setDot?.(state);
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
function handleListClicks(e: Event): void {
  const target = e.target as Element | null;
  if (!target || typeof target.closest !== 'function') return;

  const addBtn = target.closest('[naizo-add], [data-naizo-add]');
  if (addBtn) {
    const listName = getAttr(addBtn, 'naizo-add');
    if (listName) Naizo.addItem(listName, {});
    return;
  }

  const removeBtn = target.closest('[naizo-remove], [data-naizo-remove]');
  if (removeBtn) {
    const itemEl = removeBtn.closest(ITEM_SELECTOR);
    if (itemEl) {
      itemEl.remove();
      triggerSave();
    }
    return;
  }

  const moveBtn = target.closest('[naizo-move], [data-naizo-move]');
  if (moveBtn) {
    const dir = getAttr(moveBtn, 'naizo-move');
    const itemEl = moveBtn.closest(ITEM_SELECTOR);
    if (!itemEl || !itemEl.parentNode) return;
    const prev = itemEl.previousElementSibling;
    const next = itemEl.nextElementSibling;
    if (dir === 'up' && prev && hasAttr(prev, 'naizo-item')) {
      itemEl.parentNode.insertBefore(itemEl, prev);
      triggerSave();
    } else if (dir === 'down' && next && hasAttr(next, 'naizo-item')) {
      itemEl.parentNode.insertBefore(next, itemEl);
      triggerSave();
    }
  }
}

// --- 10. Public API (window.Naizo & window.NaizoDB alias) ---
export const Naizo: NaizoAPI = {
  init: initNaizo,
  get(key?: string): unknown {
    const db = parseDbScript();
    return key ? db.custom[key] : db;
  },
  set(key: string, value: unknown): void {
    const db = parseDbScript();
    db.custom[key] = value;
    db._meta.updatedAt = new Date().toISOString();
    getDbScript().textContent = '\n' + JSON.stringify(db, null, 2) + '\n';
    triggerSave();
  },
  getList(listName: string): Array<Record<string, unknown>> {
    return parseDbScript().lists[listName] ?? [];
  },
  addItem(listName: string, itemData: Record<string, unknown> = {}): void {
    const listEl = findListElement(listName);
    if (!listEl) return;
    const node = createItemNode(listEl, itemData);
    if (node) {
      listEl.appendChild(node);
      decorateListControls(listEl);
      const firstInput = node.querySelector<HTMLElement>(
        'input[type="text"], [contenteditable="true"], textarea',
      );
      firstInput?.focus();
      triggerSave();
    }
  },
  removeItem(listName: string, index: number): void {
    const listEl = findListElement(listName);
    if (!listEl) return;
    const items = listEl.querySelectorAll(DIRECT_ITEM_SELECTOR);
    if (items[index]) {
      items[index].remove();
      triggerSave();
    }
  },
  moveItem(listName: string, fromIndex: number, toIndex: number): void {
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

export const NaizoDB: NaizoAPI = Naizo;

// --- 11. Boot & Smart Conflict Resolution (Disk vs Browser Cache) ---
export async function initNaizo(): Promise<void> {
  mountUi();
  ensureListBlueprints();

  const pageKey = getPageKey();
  const snapshotKey = getSnapshotKey();
  const currentDiskRaw = getDbScript().textContent?.trim() ?? '';
  const lastKnownDiskRaw = localStorage.getItem(snapshotKey);
  const diskState = parseDbScript();
  const cachedState = parseCachedState(localStorage.getItem(pageKey));

  const diskModifiedExternally = lastKnownDiskRaw !== null && currentDiskRaw !== lastKnownDiskRaw;

  if (diskModifiedExternally || !cachedState) {
    hydrateDomFromState(diskState);
    localStorage.setItem(pageKey, JSON.stringify(parseDbScript()));
    localStorage.setItem(snapshotKey, getDbScript().textContent?.trim() ?? '');
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

  if (!listenersAttached) {
    document.addEventListener('click', handleListClicks);
    document.addEventListener('input', (e) => {
      const target = e.target as Element | null;
      if (!target?.closest?.(`#${UI_ID}`)) triggerSave();
    });
    document.addEventListener('change', (e) => {
      const target = e.target as Element | null;
      if (!target?.closest?.(`#${UI_ID}`)) triggerSave();
    });
    listenersAttached = true;
  }
}
