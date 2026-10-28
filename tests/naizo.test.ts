import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInThisContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import iifeBundleCode from '../dist/naizo.js?raw';
import checklistHtml from '../examples/checklist.html?raw';
import inventoryHtml from '../examples/inventory.html?raw';
import notesHtml from '../examples/notes.html?raw';
import starterHtml from '../examples/starter.html?raw';
import pkgJson from '../package.json';
import siteHtml from '../site/index.html?raw';
import * as NaizoModule from '../src/index';
import { initNaizo, Naizo, NaizoDB, type NaizoDatabase } from '../src/index';

function readScriptDb(): NaizoDatabase {
  const raw = document.getElementById('naizodb')?.textContent?.trim() ?? '';
  if (!raw) return { _meta: {}, fields: {}, lists: {}, custom: {} };
  return JSON.parse(raw) as NaizoDatabase;
}

describe('naizo.js v0.1.0 core runtime', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-naizo-manual');
    document.documentElement.removeAttribute('naizo-manual');
    document.documentElement.removeAttribute('naizo-mode');
    document.documentElement.removeAttribute('data-naizo-mode');
    document.body.removeAttribute('naizo-mode');
    document.body.removeAttribute('data-naizo-mode');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('hydrates and bakes standalone fields with both naizo and data-naizo attributes', async () => {
    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": {
          "title": "Spec v1",
          "owner": "Kenji",
          "approved": true,
          "tier": "pro",
          "status": "Approved",
          "summary": "Initial notes"
        },
        "lists": {},
        "custom": {}
      }
      </script>
    `;
    document.body.innerHTML = `
      <h1 contenteditable="true" naizo="title">Draft</h1>
      <input type="text" data-naizo="owner" value="">
      <input type="checkbox" naizo="approved">
      <input type="radio" name="tier" naizo="tier" value="free">
      <input type="radio" name="tier" naizo="tier" value="pro">
      <select naizo="status">
        <option value="Draft">Draft</option>
        <option value="Approved">Approved</option>
      </select>
      <textarea data-naizo="summary"></textarea>
    `;

    await initNaizo();

    const h1 = document.querySelector('[naizo="title"]') as HTMLElement;
    const owner = document.querySelector('[data-naizo="owner"]') as HTMLInputElement;
    const approved = document.querySelector('[naizo="approved"]') as HTMLInputElement;
    const radios = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    const select = document.querySelector('select[naizo="status"]') as HTMLSelectElement;
    const textarea = document.querySelector(
      'textarea[data-naizo="summary"]',
    ) as HTMLTextAreaElement;

    expect(h1.textContent).toBe('Spec v1');
    expect(owner.value).toBe('Kenji');
    expect(owner.getAttribute('value')).toBe('');
    expect(approved.checked).toBe(true);
    expect(approved.hasAttribute('checked')).toBe(false);
    expect(radios[0]?.checked).toBe(false);
    expect(radios[1]?.checked).toBe(true);
    expect(radios[1]?.hasAttribute('checked')).toBe(false);
    expect(select.value).toBe('Approved');
    expect(select.options[1]?.hasAttribute('selected')).toBe(false);
    expect(textarea.value).toBe('Initial notes');
    expect(textarea.textContent).toBe('');

    const exportDoc = new DOMParser().parseFromString(Naizo.exportHTML(), 'text/html');
    expect(exportDoc.querySelector('[data-naizo="owner"]')?.getAttribute('value')).toBe('Kenji');
    expect(exportDoc.querySelector('[naizo="approved"]')?.getAttribute('checked')).toBe('checked');
    expect(exportDoc.querySelectorAll('input[type="radio"]')[1]?.getAttribute('checked')).toBe(
      'checked',
    );
    expect(
      exportDoc.querySelectorAll('select[naizo="status"] option')[1]?.getAttribute('selected'),
    ).toBe('selected');
    expect(exportDoc.querySelector('textarea[data-naizo="summary"]')?.textContent).toBe(
      'Initial notes',
    );
  });

  it('supports declarative list repeaters (naizo-list & data-naizo-list) and clears plain text in inferred templates (EC05)', async () => {
    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": {},
        "lists": {
          "tasks": [
            { "done": true, "title": "First task", "tag": "core" },
            { "done": false, "title": "Second task", "tag": "ui" }
          ]
        },
        "custom": {}
      }
      </script>
    `;
    document.body.innerHTML = `
      <div naizo-list="tasks">
        <div naizo-item>
          <input type="checkbox" naizo="done" checked>
          <input type="text" naizo="title" value="Initial seed">
          <span naizo="tag">SeedTag</span>
        </div>
      </div>
    `;

    await initNaizo();

    expect(Naizo.getList('tasks')).toEqual([
      { done: true, title: 'First task', tag: 'core' },
      { done: false, title: 'Second task', tag: 'ui' },
    ]);

    // Add a blank item to verify the inferred template cleared the initial seed values (EC05)
    Naizo.addItem('tasks', {});
    const listAfterAdd = Naizo.getList('tasks');
    expect(listAfterAdd).toHaveLength(3);
    expect(listAfterAdd[2]).toEqual({ done: false, title: '', tag: '' });

    // Move and remove items
    Naizo.moveItem('tasks', 1, 0);
    expect(Naizo.getList('tasks')[0]?.title).toBe('Second task');

    Naizo.removeItem('tasks', 2);
    expect(Naizo.getList('tasks')).toHaveLength(2);
  });

  it('persists custom state via Naizo.get / Naizo.set and dispatches naizo:hydrate', async () => {
    const hydrateSpy = vi.fn();
    window.addEventListener('naizo:hydrate', hydrateSpy);

    await initNaizo();
    expect(hydrateSpy).toHaveBeenCalledTimes(1);

    Naizo.set('rateLimitRps', 350);
    expect(Naizo.get('rateLimitRps')).toBe(350);
    expect((Naizo.get() as { custom: Record<string, unknown> }).custom.rateLimitRps).toBe(350);

    window.removeEventListener('naizo:hydrate', hydrateSpy);
  });

  it('strips [data-naizo-runtime] UI while preserving user [naizo-ignore] elements in auto-templates and exportHTML (D12, EC03, EC07)', async () => {
    document.body.innerHTML = `
      <input type="text" naizo="project" value="naizo">
      <div naizo-list="items">
        <div naizo-item>
          <input type="text" naizo="name" value="One">
          <span class="item-custom-widget" naizo-ignore>Item custom badge</span>
        </div>
      </div>
      <div naizo-ignore><input type="range" id="user-widget" value="50">User widget</div>
      <div data-naizo-ignore>Legacy user widget</div>
      <div data-naizo-runtime="true">Ephemeral runtime overlay</div>
    `;

    await initNaizo();
    Naizo.addItem('items', { name: 'Two' });

    const rows = document.querySelectorAll('[naizo-list="items"] > [naizo-item]');
    expect(rows.length).toBe(2);
    expect(rows[0]?.querySelector('.item-custom-widget')?.textContent).toBe('Item custom badge');
    expect(rows[1]?.querySelector('.item-custom-widget')?.textContent).toBe('Item custom badge');

    const exported = Naizo.exportHTML();
    expect(exported).not.toContain('__naizodb_host__');
    expect(exported).not.toContain('__naizodb_styles__');
    expect(exported).not.toContain('naizo-item-tools');
    expect(exported).not.toContain('naizo-list-footer');
    expect(exported).not.toContain('Ephemeral runtime overlay');
    expect(exported).toContain('Item custom badge');
    expect(exported).toContain('User widget');
    expect(exported).toContain('Legacy user widget');
    expect(exported).toContain('"project": "naizo"');
  });

  it('resolves conflicts in favor of disk when #naizodb changed externally, and recovers from malformed JSON (EC01, EC04, EC05)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pageKey = 'naizodb_state_' + location.pathname;
    const snapshotKey = 'naizodb_disk_hash_' + location.pathname;

    // Simulate stale localStorage cache with older disk snapshot
    localStorage.setItem(snapshotKey, '{"fields":{"status":"Draft"}}');
    localStorage.setItem(
      pageKey,
      JSON.stringify({ _meta: {}, fields: { status: 'Browser Cached' }, lists: {}, custom: {} }),
    );

    // AI agent updated #naizodb on disk to "Approved"
    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": { "status": "Approved" },
        "lists": {},
        "custom": {}
      }
      </script>
    `;
    document.body.innerHTML = `<input type="text" naizo="status" value="Draft">`;

    await initNaizo();

    const input = document.querySelector('[naizo="status"]') as HTMLInputElement;
    expect(input.value).toBe('Approved');

    // Verify corrupted localStorage does not throw (EC05)
    localStorage.setItem(pageKey, '{corrupted json');
    await expect(initNaizo()).resolves.toBeUndefined();
    expect(readScriptDb().fields.status).toBe('Approved');

    // Verify malformed #naizodb JSON resets cleanly without throwing (EC04)
    localStorage.clear();
    document.head.innerHTML = `<script id="naizodb" type="application/json">{not valid json</script>`;
    await expect(initNaizo()).resolves.toBeUndefined();
    expect(Naizo.get()).toEqual({ _meta: {}, fields: {}, lists: {}, custom: {} });
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('keeps ESM entry side-effect free and emits clean dist/naizo.js IIFE with data-naizo-manual opt-out (D17, D25, EC37, EC49)', async () => {
    // ESM import does not auto-mount #__naizodb_host__ before initNaizo() is called
    expect(document.getElementById('__naizodb_host__')).toBeNull();
    expect(Naizo).toBe(NaizoDB);
    expect(typeof Naizo.init).toBe('function');
    expect(Object.keys(NaizoModule).sort()).toEqual(['Naizo', 'NaizoDB', 'initNaizo']);

    // Package entrypoints agree: ESM for main/module/exports["."], IIFE for unpkg/jsdelivr
    expect(pkgJson.name).toBe('naizojs');
    expect(pkgJson.main).toBe('./dist/index.mjs');
    expect(pkgJson.module).toBe('./dist/index.mjs');
    expect(pkgJson.types).toBe('./dist/index.d.mts');
    expect(pkgJson.unpkg).toBe('./dist/naizo.js');
    expect(pkgJson.jsdelivr).toBe('./dist/naizo.js');
    expect(pkgJson.exports['./naizo.min.js']).toBe('./dist/naizo.min.js');
    expect(pkgJson.exports['./dist/naizo.min.js']).toBe('./dist/naizo.min.js');
    expect(pkgJson.files).toEqual([
      'dist/naizo.js',
      'dist/naizo.min.js',
      'dist/index.mjs',
      'dist/index.d.mts',
      'README.md',
      'CHANGELOG.md',
    ]);

    // Built dist/naizo.js is a clean IIFE without NaizoBundle global namespace
    expect(iifeBundleCode.startsWith('(function() {')).toBe(true);
    expect(iifeBundleCode).not.toContain('NaizoBundle');
    expect(iifeBundleCode).toContain('window.Naizo = Naizo');
    expect(iifeBundleCode).toContain('data-naizo-manual');

    // Loading src/iife.ts with data-naizo-manual sets window.Naizo without auto-booting
    Reflect.deleteProperty(window, 'Naizo');
    Reflect.deleteProperty(window, 'NaizoDB');
    document.documentElement.setAttribute('data-naizo-manual', '');
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });

    await import('../src/iife');
    expect(window.Naizo).toBe(Naizo);
    expect(window.NaizoDB).toBe(Naizo);

    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.getElementById('__naizodb_host__')).toBeNull();

    // Removing data-naizo-manual allows boot on DOMContentLoaded
    document.documentElement.removeAttribute('data-naizo-manual');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.getElementById('__naizodb_host__')).not.toBeNull();

    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
  });

  it('hydrates site/index.html and examples/ starter templates with wrapping labels (M3.2, M4.5c, EC39)', async () => {
    for (const html of [siteHtml, starterHtml, checklistHtml, inventoryHtml, notesHtml]) {
      const parsedDoc = new DOMParser().parseFromString(html, 'text/html');
      const rawJson = parsedDoc.getElementById('naizodb')?.textContent?.trim() ?? '';
      expect(rawJson.length).toBeGreaterThan(0);
      const db = JSON.parse(rawJson) as Record<string, unknown>;
      expect(db).toHaveProperty('_meta');
      expect(db).toHaveProperty('fields');
      expect(db).toHaveProperty('lists');
      expect(db).toHaveProperty('custom');
    }

    // Load checklist.html into DOM and verify wrapping <label> controls stay scoped per row (EC39)
    const doc = new DOMParser().parseFromString(checklistHtml, 'text/html');
    document.head.innerHTML = doc.head.innerHTML;
    document.body.innerHTML = doc.body.innerHTML;

    await initNaizo();

    const rows = Array.from(document.querySelectorAll<HTMLElement>('[naizo-item]'));
    expect(rows.length).toBe(3);
    for (const row of rows) {
      const labels = Array.from(row.querySelectorAll('label'));
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.control).not.toBeNull();
        expect(row.contains(label.control)).toBe(true);
      }
    }

    // Load inventory.html into DOM and verify template hydration, wrapping <label> controls, and extra JSON dict keys (EC39, D15)
    localStorage.clear();
    const invDoc = new DOMParser().parseFromString(inventoryHtml, 'text/html');
    document.head.innerHTML = invDoc.head.innerHTML;
    document.body.innerHTML = invDoc.body.innerHTML;

    await initNaizo();

    const invCards = Array.from(document.querySelectorAll<HTMLElement>('[naizo-item]'));
    expect(invCards.length).toBe(6);
    for (const card of invCards) {
      const labels = Array.from(card.querySelectorAll('label'));
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.control).not.toBeNull();
        expect(card.contains(label.control)).toBe(true);
      }
    }
    const firstCardDict = Naizo.getList('inventory')[0];
    expect(firstCardDict?.chip).toBe('Apple M4 Max');
    expect(firstCardDict?.ram).toBe('64GB');

    // Execute inventory.html application script and verify modal/filter edge cases
    const registeredWinListeners: Array<{
      type: string;
      listener: EventListenerOrEventListenerObject;
    }> = [];
    const origWinAdd = window.addEventListener.bind(window);
    const addSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation(
        (
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: boolean | AddEventListenerOptions,
        ) => {
          registeredWinListeners.push({ type, listener });
          origWinAdd(type, listener, options);
        },
      );

    try {
      const appScript = invDoc.body.querySelector('script')?.textContent || '';
      runInThisContext(appScript);
      window.dispatchEvent(new Event('DOMContentLoaded'));

      // 1. Opening + Key on inv-101, reordering cards before submit, and submitting updates inv-101 by stable ID
      const firstAddPropBtn = invCards[0]?.querySelector<HTMLButtonElement>('[data-add-card-prop]');
      firstAddPropBtn?.click();
      Naizo.moveItem('inventory', 0, 1);

      const propKeyIn = document.getElementById('prop-key-input') as HTMLInputElement;
      const propValIn = document.getElementById('prop-val-input') as HTMLInputElement;
      const addPropForm = document.getElementById('add-prop-form') as HTMLFormElement;
      propKeyIn.value = 'maxWatts';
      propValIn.value = 'Infinity';
      addPropForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      // 2. Non-finite numeric input ("Infinity") is preserved as text on inv-101 (now at index 1), not applied to inv-102 (index 0)
      const listAfterProp = Naizo.getList('inventory');
      expect(listAfterProp[0]?.id).toBe('inv-102');
      expect(listAfterProp[0]?.maxWatts).toBeUndefined();
      expect(listAfterProp[1]?.id).toBe('inv-101');
      expect(listAfterProp[1]?.maxWatts).toBe('Infinity');

      // 3. Trailing space in a card's Location field still matches trimmed location filter option
      const locInput = document
        .querySelectorAll<HTMLElement>('[naizo-item]')[1]
        ?.querySelector<HTMLInputElement>('input[naizo="location"]');
      expect(locInput).not.toBeNull();
      locInput!.value = 'Tokyo HQ ';
      locInput!.dispatchEvent(new Event('input', { bubbles: true }));

      Naizo.setField('filter_location', 'Tokyo HQ');
      const movedInv101Card = document.querySelectorAll<HTMLElement>('[naizo-item]')[1];
      expect(movedInv101Card?.hidden).toBe(false);
      Naizo.setField('filter_location', 'all');

      // 4. Creating a card with custom "__proto__" key defines an own enumerable property
      document.getElementById('open-create-modal-btn')?.click();
      const createForm = document.getElementById('create-card-form') as HTMLFormElement;
      (createForm.elements.namedItem('name') as HTMLInputElement).value = 'Proto Test Unit';
      const kvKey = document.querySelector<HTMLInputElement>('#modal-kv-container [data-kv-key]')!;
      const kvVal = document.querySelector<HTMLInputElement>('#modal-kv-container [data-kv-val]')!;
      kvKey.value = '__proto__';
      kvVal.value = '1e309';
      createForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      const createdCard = Naizo.getList('inventory').at(-1);
      expect(createdCard?.name).toBe('Proto Test Unit');
      expect(Object.hasOwn(createdCard ?? {}, '__proto__')).toBe(true);
      expect(createdCard?.['__proto__']).toBe('1e309');

      // 5. Form modals guard against drag-select backdrop clicks, close on true backdrop clicks while preserving drafts, and reset via Reset button
      const createDialog = document.getElementById('create-card-dialog') as HTMLDialogElement;
      document.getElementById('open-create-modal-btn')?.click();
      expect(createDialog.open || createDialog.hasAttribute('open')).toBe(true);

      const nameIn = createForm.elements.namedItem('name') as HTMLInputElement;
      const notesIn = createForm.elements.namedItem('notes') as HTMLTextAreaElement;
      nameIn.value = 'Draft Workstation';
      notesIn.value = 'Carefully typed specification notes';
      document.getElementById('add-modal-kv-btn')?.click();
      const kvRows = document.querySelectorAll('#modal-kv-container .custom-kv-row');
      expect(kvRows.length).toBe(2);

      // Drag-select starting inside an input and ending on #create-card-dialog backdrop must NOT close it
      nameIn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      createDialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(createDialog.open || createDialog.hasAttribute('open')).toBe(true);

      // True backdrop click (mousedown + click on #create-card-dialog) closes it AND preserves draft text/KV rows on reopen
      createDialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      createDialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(createDialog.open || createDialog.hasAttribute('open')).toBe(false);
      document.getElementById('open-create-modal-btn')?.click();
      expect(nameIn.value).toBe('Draft Workstation');
      expect(notesIn.value).toBe('Carefully typed specification notes');
      expect(document.querySelectorAll('#modal-kv-container .custom-kv-row').length).toBe(2);

      // Reset button clears draft text and restores default single custom KV row while keeping dialog open
      document.getElementById('reset-create-btn')?.click();
      expect(createDialog.open || createDialog.hasAttribute('open')).toBe(true);
      expect(nameIn.value).toBe('');
      expect(notesIn.value).toBe('');
      expect(document.querySelectorAll('#modal-kv-container .custom-kv-row').length).toBe(1);
      document.getElementById('close-create-x-btn')?.click();

      // Add Property modal also guards against drag-select backdrop click, closes on true backdrop click while preserving draft for the same card, and resets on Reset or different card
      const addPropDialog = document.getElementById('add-prop-dialog') as HTMLDialogElement;
      const currentCards = Array.from(document.querySelectorAll<HTMLElement>('[naizo-item]'));
      currentCards[0]?.querySelector<HTMLButtonElement>('[data-add-card-prop]')?.click();
      propKeyIn.value = 'draftKey';
      propValIn.value = 'draftValue';
      propKeyIn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      addPropDialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(addPropDialog.open || addPropDialog.hasAttribute('open')).toBe(true);

      addPropDialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      addPropDialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(addPropDialog.open || addPropDialog.hasAttribute('open')).toBe(false);
      currentCards[0]?.querySelector<HTMLButtonElement>('[data-add-card-prop]')?.click();
      expect(propKeyIn.value).toBe('draftKey');
      expect(propValIn.value).toBe('draftValue');

      document.getElementById('reset-prop-btn')?.click();
      expect(propKeyIn.value).toBe('');
      expect(propValIn.value).toBe('');
      document.getElementById('close-prop-x-btn')?.click();

      // 6. Inspect JSON modal serializes live store immediately before 150ms #naizodb debounce fires
      // and only closes on true backdrop click (mousedown + click on dialog backdrop)
      const ownerInput = document
        .querySelectorAll<HTMLElement>('[naizo-item]')[0]
        ?.querySelector<HTMLInputElement>('input[naizo="owner"]');
      ownerInput!.value = 'Live Immediate Preview Owner';
      ownerInput!.dispatchEvent(new Event('input', { bubbles: true }));

      const inspectDialog = document.getElementById('inspect-json-dialog') as HTMLDialogElement;
      document.getElementById('inspect-json-btn')?.click();
      const previewBox = document.getElementById('json-preview-box') as HTMLElement;
      const previewText = previewBox.textContent || '';
      expect(previewText).toContain('Live Immediate Preview Owner');

      // Drag-select starting inside #json-preview-box and ending on backdrop does NOT close inspectDialog
      previewBox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      inspectDialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(inspectDialog.open || inspectDialog.hasAttribute('open')).toBe(true);

      // True backdrop click (mousedown + click on inspectDialog) closes it
      inspectDialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      inspectDialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(inspectDialog.open || inspectDialog.hasAttribute('open')).toBe(false);
    } finally {
      addSpy.mockRestore();
      for (const { type, listener } of registeredWinListeners) {
        window.removeEventListener(type, listener);
      }
    }
  });

  it('preserves unbound fields, unbound lists, and extra item keys via the in-memory store and WeakMap (D15, EC14)', async () => {
    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": { "version": "1.0" },
        "fields": { "title": "Spec", "reviewer": "Agent-X" },
        "lists": {
          "tasks": [
            { "id": "t-1", "title": "Task A", "estimate": 5 },
            { "id": "t-2", "title": "Task B", "estimate": 8 }
          ],
          "ghosts": [
            { "id": "g-1", "note": "Unbound list item" }
          ]
        },
        "custom": { "flag": true }
      }
      </script>
    `;
    document.body.innerHTML = `
      <input type="text" naizo="title" value="">
      <div naizo-list="tasks">
        <div naizo-item>
          <input type="text" naizo="title" value="">
        </div>
      </div>
    `;

    await initNaizo();

    expect(Naizo.getField('reviewer')).toBe('Agent-X');
    expect(Naizo.getList('ghosts')).toEqual([{ id: 'g-1', note: 'Unbound list item' }]);
    expect(Naizo.getList('tasks')).toEqual([
      { id: 't-1', title: 'Task A', estimate: 5 },
      { id: 't-2', title: 'Task B', estimate: 8 },
    ]);

    // Edit first item's bound input and move items
    const itemInputs = document.querySelectorAll<HTMLInputElement>('[naizo-item] [naizo="title"]');
    itemInputs[0]!.value = 'Task A Updated';
    itemInputs[0]!.dispatchEvent(new Event('input', { bubbles: true }));

    Naizo.moveItem('tasks', 0, 1);
    expect(Naizo.getList('tasks')).toEqual([
      { id: 't-2', title: 'Task B', estimate: 8 },
      { id: 't-1', title: 'Task A Updated', estimate: 5 },
    ]);

    Naizo.updateItem('tasks', 1, { estimate: 13 });
    expect(Naizo.getList('tasks')[1]).toEqual({
      id: 't-1',
      title: 'Task A Updated',
      estimate: 13,
    });
    expect(Naizo.getField('reviewer')).toBe('Agent-X');
    expect(Naizo.getList('ghosts')).toEqual([{ id: 'g-1', note: 'Unbound list item' }]);
  });

  it('enforces explicit binding, skips password/file/button inputs, excludes naizo-ignore subtrees, and uses plain-text contenteditable (EC11, EC18, EC21, EC23)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": {
          "note": "<img src=x onerror=alert(1)>",
          "secret_file": "/etc/passwd"
        },
        "lists": {},
        "custom": {}
      }
      </script>
    `;
    document.body.innerHTML = `
      <input type="search" id="search-box" name="q" value="unannotated">
      <input type="password" naizo="api_secret" value="hunter2">
      <input type="file" naizo="secret_file">
      <input type="button" naizo="btn_val" value="Click">
      <div naizo-ignore>
        <input type="text" naizo="ignored_child" value="should-not-capture">
      </div>
      <div contenteditable="true" naizo="note"></div>
    `;

    await expect(initNaizo()).resolves.toBeUndefined();

    const noteEl = document.querySelector('[naizo="note"]') as HTMLElement;
    expect(noteEl.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(noteEl.querySelector('img')).toBeNull();

    const db = Naizo.get() as { fields: Record<string, unknown> };
    expect(db.fields).not.toHaveProperty('search-box');
    expect(db.fields).not.toHaveProperty('q');
    expect(db.fields).not.toHaveProperty('field_0');
    expect(db.fields).not.toHaveProperty('api_secret');
    expect(db.fields).not.toHaveProperty('btn_val');
    expect(db.fields).not.toHaveProperty('ignored_child');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('captures synchronously before async IDB, propagates duplicate scalar bindings, and supports Naizo.bind(root) (EC16, EC19, EC20, EC34)', async () => {
    let resolveIdbGet = () => {};
    const origIdbDesc = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    const mockReq: {
      result: unknown;
      onsuccess: null | (() => void);
      onerror: null | (() => void);
      onupgradeneeded: null | (() => void);
    } = {
      result: {
        createObjectStore: () => ({}),
        transaction: () => ({
          objectStore: () => ({
            get: () => {
              const getReq: { result: unknown; onsuccess: null | (() => void) } = {
                result: null,
                onsuccess: null,
              };
              resolveIdbGet = () => {
                getReq.onsuccess?.();
              };
              return getReq;
            },
          }),
        }),
      },
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        open: () => {
          queueMicrotask(() => {
            mockReq.onsuccess?.();
          });
          return mockReq;
        },
      },
    });

    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": { "title": "Initial", "late_field": "Stored Late" },
        "lists": {},
        "custom": {}
      }
      </script>
    `;
    document.body.innerHTML = `
      <input id="t1" type="text" naizo="title" value="">
      <input id="t2" type="text" naizo="title" value="">
      <div id="dynamic-slot"></div>
    `;

    const initPromise = initNaizo();

    // Before IDB resolves, listeners and hydration are already active (EC34)
    const t1 = document.getElementById('t1') as HTMLInputElement;
    const t2 = document.getElementById('t2') as HTMLInputElement;
    expect(t1.value).toBe('Initial');
    expect(t2.value).toBe('Initial');

    // Editing first duplicate input updates store and propagates to second (EC19)
    t1.value = 'Typed During IDB Wait';
    t1.dispatchEvent(new Event('input', { bubbles: true }));
    expect(Naizo.getField('title')).toBe('Typed During IDB Wait');
    expect(t2.value).toBe('Typed During IDB Wait');

    // Dynamically mounted input does not clobber stored late_field, and Naizo.bind hydrates it (EC20)
    const slot = document.getElementById('dynamic-slot')!;
    slot.innerHTML = `<input id="late" type="text" naizo="late_field" value="Default Value">`;
    expect(Naizo.getField('late_field')).toBe('Stored Late');
    Naizo.bind(slot);
    expect((document.getElementById('late') as HTMLInputElement).value).toBe('Stored Late');

    // Flush pending persistence on pagehide (EC16)
    window.dispatchEvent(new Event('pagehide'));
    expect(readScriptDb().fields.title).toBe('Typed During IDB Wait');

    await Promise.resolve();
    resolveIdbGet();
    await initPromise;
    expect(Naizo.getField('title')).toBe('Typed During IDB Wait');

    if (origIdbDesc) {
      Object.defineProperty(globalThis, 'indexedDB', origIdbDesc);
    } else {
      Reflect.deleteProperty(globalThis, 'indexedDB');
    }
  });

  it('preserves unmutated disk snapshot on boot, change-only updatedAt, numeric/boolean types, and unknown select options (EC06, EC15, EC25, EC32)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rawDisk = `{
        "_meta": { "updatedAt": "2026-10-18T00:00:00.000Z" },
        "fields": { "count": 3, "active": "false", "stage": "Shipped" },
        "lists": {},
        "custom": { "rate": 120 }
      }`;
    document.head.innerHTML = `<script id="naizodb" type="application/json">${rawDisk}</script>`;
    document.body.innerHTML = `
      <input id="count-in" type="text" naizo="count" value="">
      <input id="active-in" type="checkbox" naizo="active" checked>
      <select id="stage-sel" naizo="stage">
        <option value="Draft">Draft</option>
        <option value="Review">Review</option>
      </select>
    `;

    await initNaizo();

    // Boot does not bump updatedAt (EC06) and preserves number & unknown select option (EC15, EC25)
    expect((Naizo.get() as { _meta: { updatedAt: string } })._meta.updatedAt).toBe(
      '2026-10-18T00:00:00.000Z',
    );
    expect(Naizo.getField('count')).toBe(3);
    expect((document.getElementById('active-in') as HTMLInputElement).checked).toBe(false);
    expect(Naizo.getField('stage')).toBe('Shipped');
    expect(warnSpy).toHaveBeenCalled();

    // No-op input event on count-in keeps numeric type 3 (EC25)
    const countIn = document.getElementById('count-in') as HTMLInputElement;
    countIn.dispatchEvent(new Event('input', { bubbles: true }));
    expect(Naizo.getField('count')).toBe(3);

    // Simulate user updating custom rate in browser cache, then reloading with unchanged disk (EC06, EC32)
    Naizo.set('rate', 250);
    document.head.innerHTML = `<script id="naizodb" type="application/json">${rawDisk}</script>`;
    let hydratedRate: unknown;
    const onHydrate = (e: Event) => {
      hydratedRate = (e as CustomEvent<{ custom: { rate: unknown } }>).detail.custom.rate;
    };
    window.addEventListener('naizo:hydrate', onHydrate, { once: true });

    await initNaizo();
    expect(hydratedRate).toBe(250);
    expect(Naizo.get('rate')).toBe(250);
    expect(readScriptDb().custom.rate).toBe(250);

    warnSpy.mockRestore();
  });

  it('protects invalid startup #naizodb shapes, guards storage failures, validates JSON values, and preserves __proto__ keys (EC02, EC04, EC22, EC24, EC33, EC35, EC38)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // 1. Invalid startup JSON preserves raw #naizodb text and blocks overwrite (EC04)
    const brokenRaw = '{"_meta":{},"fields":{},"custom":{"valuable":"KEEP ME"';
    document.head.innerHTML = `<script id="naizodb" type="application/json">${brokenRaw}</script>`;
    document.body.innerHTML = `<input type="text" naizo="title" value="Fallback">`;
    await initNaizo();
    Naizo.setField('title', 'Attempted Edit');
    expect(document.getElementById('naizodb')?.textContent).toBe(brokenRaw);

    // 2. Invalid database shape (null list item / array custom) preserves existing DOM rows (EC33)
    const badShapeRaw = '{"_meta":{},"fields":{},"lists":{"tasks":[null]},"custom":[]}';
    document.head.innerHTML = `<script id="naizodb" type="application/json">${badShapeRaw}</script>`;
    document.body.innerHTML = `
      <div naizo-list="tasks">
        <div naizo-item><input type="text" naizo="name" value="Survives"></div>
      </div>
    `;
    await initNaizo();
    expect(document.querySelectorAll('[naizo-item]').length).toBe(1);
    expect(document.getElementById('naizodb')?.textContent).toBe(badShapeRaw);

    // 3. Valid startup with Object.prototype and __proto__ keys (EC24, EC38) + JSON validation (EC35)
    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": {},
        "lists": {},
        "custom": {}
      }
      </script>
    `;
    document.body.innerHTML = `
      <input id="proto-in" type="text" naizo="__proto__" value="proto-val">
      <input id="tostring-in" type="text" naizo="toString" value="initial-str">
    `;
    await initNaizo();

    expect((document.getElementById('tostring-in') as HTMLInputElement).value).toBe('initial-str');
    expect(Naizo.getField('__proto__')).toBe('proto-val');

    Naizo.set('__proto__', 'custom-proto');
    expect(Naizo.get('__proto__')).toBe('custom-proto');
    expect(document.getElementById('naizodb')?.textContent).toContain(
      '"__proto__": "custom-proto"',
    );

    // Reject non-JSON values (EC35)
    Naizo.set('validKey', 42);
    Naizo.set('validKey', Number.NaN);
    Naizo.set('validKey', undefined);
    Naizo.set('validKey', () => {});
    Naizo.set('big', BigInt(10));
    expect(Naizo.get('validKey')).toBe(42);
    expect(Naizo.get('big')).toBeUndefined();

    // Explicit deleteField (EC35)
    Naizo.setField('tempField', 'remove-me');
    expect(Naizo.getField('tempField')).toBe('remove-me');
    Naizo.deleteField('tempField');
    expect(Naizo.getField('tempField')).toBeUndefined();

    // 4. Storage quota exception does not break in-memory operation (EC22)
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => Naizo.set('inMemoryKey', 'works')).not.toThrow();
    expect(Naizo.get('inMemoryKey')).toBe('works');
    setItemSpy.mockRestore();

    // 5. Fallback Blob download revokes Object URL (EC02)
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const host = document.getElementById('__naizodb_host__');
    const actionBtn = host?.shadowRoot?.getElementById('action') as HTMLButtonElement | null;
    actionBtn?.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(createUrlSpy).toHaveBeenCalled();
    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:mock-url');

    createUrlSpy.mockRestore();
    revokeUrlSpy.mockRestore();
    clickSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('escapes < as \\u003c, surgically updates #naizodb preserving UTF-8 BOM, and guards non-naizo files (D13, D16, D24, EC08, EC28)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": { "snippet": "Safe" },
        "lists": {},
        "custom": {}
      }
      </script>
    `;
    document.body.innerHTML = `<input type="text" naizo="snippet" value="Safe">`;
    await initNaizo();

    // 1. \u003c escaping for </script> and <!-- (EC08)
    Naizo.setField('snippet', '</script><!--<script>alert(1)</script>');
    const rawScript = document.getElementById('naizodb')?.textContent ?? '';
    expect(rawScript).not.toContain('</script>');
    expect(rawScript).toContain('\\u003c/script>');
    expect(rawScript).toContain('\\u003c!--');
    expect(readScriptDb().fields.snippet).toBe('</script><!--<script>alert(1)</script>');

    // 2. Surgical #naizodb replacement preserving UTF-8 BOM and surrounding bytes (D16, D24)
    let diskContent =
      '\uFEFF<!doctype html>\n<html><head><script type="application/json" id="naizodb">\n{"_meta":{},"fields":{"snippet":"Safe"},"lists":{},"custom":{}}\n</script></head><body class="tailwind-mutated"><p>Exact body bytes</p></body></html>';
    let diskMtime = 1000;

    window.showSaveFilePicker = vi.fn().mockResolvedValue({
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
      getFile: vi.fn().mockImplementation(async () => ({
        lastModified: diskMtime,
        arrayBuffer: async () => new TextEncoder().encode(diskContent).buffer,
        text: async () => diskContent.replace(/^\uFEFF/, ''),
      })),
      createWritable: vi.fn().mockImplementation(async () => ({
        write: async (data: string) => {
          diskContent = data;
          diskMtime += 100;
        },
        close: async () => {},
      })),
    });

    const host = document.getElementById('__naizodb_host__');
    const actionBtn = host?.shadowRoot?.getElementById('action') as HTMLButtonElement | null;
    actionBtn?.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(diskContent.startsWith('\uFEFF')).toBe(true);
    expect(diskContent).toContain('<body class="tailwind-mutated"><p>Exact body bytes</p></body>');
    expect(diskContent).toContain('\\u003c/script>');

    // 3. Refuse to overwrite non-empty file lacking #naizodb without confirmation (EC28)
    let unrelatedFile = '<html><head><title>Unrelated</title></head><body>Keep me</body></html>';
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    window.showSaveFilePicker = vi.fn().mockResolvedValue({
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
      getFile: vi.fn().mockResolvedValue({
        lastModified: 2000,
        text: async () => unrelatedFile,
      }),
      createWritable: vi.fn().mockResolvedValue({
        write: async (data: string) => {
          unrelatedFile = data;
        },
        close: async () => {},
      }),
    });

    await Naizo.unlink();
    actionBtn?.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(confirmSpy).toHaveBeenCalled();
    expect(unrelatedFile).toBe(
      '<html><head><title>Unrelated</title></head><body>Keep me</body></html>',
    );
    expect(host?.shadowRoot?.getElementById('status')?.textContent).toBe(
      'Target file lacks #naizodb',
    );

    confirmSpy.mockRestore();
    Reflect.deleteProperty(window, 'showSaveFilePicker');
    warnSpy.mockRestore();
  });

  it('queues disk writes single-flight, records exact payload snapshots, and shows truthful status pill UX (D24, D27, EC26, EC36)', async () => {
    const initialJson = JSON.stringify(
      {
        _meta: {},
        fields: { a: 'zero' },
        lists: {},
        custom: {},
      },
      null,
      2,
    );
    let diskHtml = `<html><head><script id="naizodb" type="application/json">\n${initialJson}\n</script></head><body></body></html>`;
    let diskMtime = 1000;
    const writes: string[] = [];
    let resolveFirstClose: (() => void) | null = null;
    let closeCallCount = 0;

    document.head.innerHTML = `<script id="naizodb" type="application/json">\n${initialJson}\n</script>`;
    document.body.innerHTML = `<input id="a-in" type="text" naizo="a" value="zero">`;

    await initNaizo();

    window.showSaveFilePicker = vi.fn().mockResolvedValue({
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
      getFile: vi.fn().mockImplementation(async () => ({
        lastModified: diskMtime,
        text: async () => diskHtml,
      })),
      createWritable: vi.fn().mockImplementation(async () => {
        let pendingData = '';
        return {
          write: async (data: string) => {
            pendingData = data;
          },
          close: async () => {
            closeCallCount += 1;
            if (closeCallCount === 1) {
              await new Promise<void>((r) => {
                resolveFirstClose = r;
              });
            }
            diskHtml = pendingData;
            diskMtime += 100;
            writes.push(pendingData);
          },
        };
      }),
    });

    const host = document.getElementById('__naizodb_host__');
    const statusEl = host?.shadowRoot?.getElementById('status');
    const dotEl = host?.shadowRoot?.getElementById('dot');

    // Before linking, status pill is amber
    expect(statusEl?.textContent).toBe('Browser Cache · Click to Link Disk');
    expect(dotEl?.className).toBe('dot');

    // Link disk (first write starts and pauses at close)
    Naizo.setField('a', 'one');
    const actionBtn = host?.shadowRoot?.getElementById('action') as HTMLButtonElement | null;
    actionBtn?.click();
    await new Promise((r) => setTimeout(r, 10));

    // Edit 'a' to 'two' while first write is in flight (EC26)
    Naizo.setField('a', 'two');

    // Finish first write -> single-flight queue automatically executes second write
    (resolveFirstClose as (() => void) | null)?.();
    await new Promise((r) => setTimeout(r, 30));

    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect(diskHtml).toContain('"a": "two"');
    expect(localStorage.getItem('naizodb_disk_hash_/')).toMatch(/^fnv1a:[0-9a-f]{8}\|/);
    expect(statusEl?.textContent).toBe('Synced to Disk');
    expect(dotEl?.className).toBe('dot saved');

    // Test copyJSON() and unlink()
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextSpy },
    });
    const copied = await Naizo.copyJSON();
    expect(copied).toContain('"a": "two"');
    expect(writeTextSpy).toHaveBeenCalledWith(copied);

    await Naizo.unlink();
    expect(statusEl?.textContent).toBe('Browser Cache · Click to Link Disk');
    expect(dotEl?.className).toBe('dot');

    Reflect.deleteProperty(window, 'showSaveFilePicker');
  });

  it('merges external disk edits across unrelated keys, guards activeElement, and backs up same-key collisions with Restore (D20, D27, EC10, EC11, EC17, EC27)', async () => {
    vi.useFakeTimers();
    try {
      document.documentElement.setAttribute('naizo-id', 'doc-merge');
      const baseJson = JSON.stringify(
        {
          _meta: {},
          fields: { owner: 'Kenji', status: 'Draft', shared: 'v0' },
          lists: {},
          custom: {},
        },
        null,
        2,
      );
      let diskHtml = `<html><head><script id="naizodb" type="application/json">\n${baseJson}\n</script></head><body></body></html>`;
      let diskMtime = 1000;

      document.head.innerHTML = `<script id="naizodb" type="application/json">\n${baseJson}\n</script>`;
      document.body.innerHTML = `
        <input id="owner-in" type="text" naizo="owner" value="Kenji">
        <input id="status-in" type="text" naizo="status" value="Draft">
        <input id="shared-in" type="text" naizo="shared" value="v0">
      `;

      await initNaizo();
      expect(localStorage.getItem('naizodb_state_/::doc-merge')).not.toBeNull();

      window.showSaveFilePicker = vi.fn().mockResolvedValue({
        queryPermission: vi.fn().mockResolvedValue('granted'),
        requestPermission: vi.fn().mockResolvedValue('granted'),
        getFile: vi.fn().mockImplementation(async () => ({
          lastModified: diskMtime,
          text: async () => diskHtml,
        })),
        createWritable: vi.fn().mockImplementation(async () => ({
          write: async (data: string) => {
            diskHtml = data;
            diskMtime += 100;
          },
          close: async () => {},
        })),
      });

      const host = document.getElementById('__naizodb_host__');
      (host?.shadowRoot?.getElementById('action') as HTMLButtonElement | null)?.click();
      await vi.advanceTimersByTimeAsync(50);

      // Browser edits `owner` and `shared` while focusing `owner-in`
      const ownerIn = document.getElementById('owner-in') as HTMLInputElement;
      ownerIn.focus();
      ownerIn.value = 'Alice (Typing)';
      Naizo.setField('owner', 'Alice');
      ownerIn.value = 'Alice (Mid-Keystroke)';
      Naizo.setField('shared', 'browser-edit');

      // Before debounced disk write fires, external AI agent edits `status` and collides on `shared`
      const agentJson = JSON.stringify(
        {
          _meta: {},
          fields: { owner: 'Kenji', status: 'Approved by Agent', shared: 'agent-edit' },
          lists: {},
          custom: {},
        },
        null,
        2,
      );
      diskHtml = `<html><head><script id="naizodb" type="application/json">\n${agentJson}\n</script></head><body></body></html>`;
      diskMtime += 500;

      // Advance 2s watch interval to trigger live disk watch (EC10)
      await vi.advanceTimersByTimeAsync(2100);

      // Unrelated browser key `owner` ("Alice") and agent key `status` ("Approved by Agent") both survive!
      expect(Naizo.getField('owner')).toBe('Alice');
      expect(Naizo.getField('status')).toBe('Approved by Agent');
      // Same-key collision on `shared`: disk wins, browser state backed up to naizodb_backup_<key>
      expect(Naizo.getField('shared')).toBe('agent-edit');
      // Focused input was not clobbered mid-keystroke (EC10)
      expect(ownerIn.value).toBe('Alice (Mid-Keystroke)');

      const backupRaw = localStorage.getItem('naizodb_backup_/::doc-merge');
      expect(backupRaw).not.toBeNull();
      const restoreBtn = host?.shadowRoot?.getElementById('restore') as HTMLButtonElement | null;
      expect(restoreBtn?.style.display).toBe('inline-block');

      // Clicking ↺ Restore restores pre-merge browser state (EC17)
      restoreBtn?.click();
      await vi.advanceTimersByTimeAsync(50);
      expect(Naizo.getField('shared')).toBe('browser-edit');
      expect(restoreBtn?.style.display).toBe('none');

      // Cross-tab storage event refreshes in-memory store (EC27)
      ownerIn.blur();
      const crossTabState = JSON.stringify({
        _meta: {},
        fields: { owner: 'CrossTabUser', status: 'Approved by Agent', shared: 'browser-edit' },
        lists: {},
        custom: {},
      });
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'naizodb_state_/::doc-merge',
          newValue: crossTabState,
        }),
      );
      expect(Naizo.getField('owner')).toBe('CrossTabUser');
    } finally {
      await Naizo.unlink();
      document.documentElement.removeAttribute('naizo-id');
      Reflect.deleteProperty(window, 'showSaveFilePicker');
      vi.useRealTimers();
    }
  });

  it('supports number/range coercion, <details>, <select multiple>, contenteditable variants, non-leaf guard, and form.reset() (D14, EC12)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": {
          "points": 8,
          "volume": 75,
          "expanded": true,
          "tags": ["core", "ux"],
          "plain": "Plain text block",
          "non_leaf": "Should not wipe children"
        },
        "lists": {},
        "custom": {}
      }
      </script>
    `;
    document.body.innerHTML = `
      <form id="spec-form">
        <input id="points-in" type="number" naizo="points" value="1">
        <input id="vol-in" type="range" min="0" max="100" naizo="volume" value="20">
        <details id="det" naizo="expanded"><summary>Details</summary><p>Inner</p></details>
        <select id="tags-sel" naizo="tags" multiple>
          <option value="core">Core</option>
          <option value="docs">Docs</option>
          <option value="ux">UX</option>
        </select>
        <div id="plain-ce" contenteditable="plaintext-only" naizo="plain"></div>
        <div id="non-leaf" naizo="non_leaf"><span class="child-keep">Child survives</span></div>
      </form>
    `;

    await initNaizo();

    const pointsIn = document.getElementById('points-in') as HTMLInputElement;
    const volIn = document.getElementById('vol-in') as HTMLInputElement;
    const det = document.getElementById('det') as HTMLDetailsElement;
    const tagsSel = document.getElementById('tags-sel') as HTMLSelectElement;
    const plainCe = document.getElementById('plain-ce') as HTMLElement;
    const nonLeaf = document.getElementById('non-leaf') as HTMLElement;

    expect(pointsIn.value).toBe('8');
    expect(volIn.value).toBe('75');
    expect(det.open).toBe(true);
    expect(
      Array.from(tagsSel.options)
        .filter((o) => o.selected)
        .map((o) => o.value),
    ).toEqual(['core', 'ux']);
    expect(plainCe.textContent).toBe('Plain text block');
    expect(nonLeaf.querySelector('.child-keep')?.textContent).toBe('Child survives');

    // Numeric input coercion: number and empty -> null
    pointsIn.value = '13';
    pointsIn.dispatchEvent(new Event('input', { bubbles: true }));
    expect(Naizo.getField('points')).toBe(13);

    pointsIn.value = '';
    pointsIn.dispatchEvent(new Event('input', { bubbles: true }));
    expect(Naizo.getField('points')).toBeNull();

    // <details> toggle event capture
    det.open = false;
    det.dispatchEvent(new Event('toggle'));
    expect(Naizo.getField('expanded')).toBe(false);

    // <select multiple> change capture
    tagsSel.options[0]!.selected = false;
    tagsSel.options[1]!.selected = true;
    tagsSel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(Naizo.getField('tags')).toEqual(['docs', 'ux']);

    // Native form.reset() restores defaultValue ("1" -> 1) into store (EC12)
    const form = document.getElementById('spec-form') as HTMLFormElement;
    form.reset();
    await new Promise((r) => setTimeout(r, 10));
    expect(Naizo.getField('points')).toBe(1);
    expect(Naizo.getField('volume')).toBe(20);

    warnSpy.mockRestore();
  });

  it('handles auto-template lifecycle, self-bound [naizo-item], per-row radio scoping, table controls, @media print, user-only focus, and events (EC09, EC13, EC29, EC31, EC40)', async () => {
    const changeEvents: Array<Record<string, unknown>> = [];
    const itemEvents: Array<Record<string, unknown>> = [];
    const onChange = (e: Event) => changeEvents.push((e as CustomEvent).detail);
    const onItem = (e: Event) => itemEvents.push((e as CustomEvent).detail);
    window.addEventListener('naizo:change', onChange);
    window.addEventListener('naizo:item', onItem);

    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": {},
        "lists": {
          "bullets": [
            { "label": "First bullet" },
            { "label": "Second bullet" }
          ],
          "matrix": [
            { "title": "Row 1", "level": "high" },
            { "title": "Row 2", "level": "low" }
          ]
        },
        "custom": {}
      }
      </script>
    `;
    document.body.innerHTML = `
      <input id="outside-focus" type="text" value="keep focus">
      <ul naizo-list="bullets">
        <li naizo-item contenteditable="true" naizo="label">Seed</li>
      </ul>
      <table>
        <tbody naizo-list="matrix">
          <tr naizo-item>
            <td><input type="text" naizo="title" value=""></td>
            <td>
              <input type="radio" name="lvl" naizo="level" value="high">
              <input type="radio" name="lvl" naizo="level" value="low">
            </td>
          </tr>
        </tbody>
      </table>
    `;

    await initNaizo();

    // 1. Self-bound <li naizo-item naizo="label"> hydrated (EC13)
    const bulletItems = document.querySelectorAll<HTMLElement>('ul[naizo-list="bullets"] > li');
    expect(bulletItems.length).toBe(2);
    expect(bulletItems[0]?.textContent).toContain('First bullet');
    expect(bulletItems[1]?.textContent).toContain('Second bullet');

    // 2. Table controls placed inside last <td> and footer placed after <table> (EC13)
    const rows = document.querySelectorAll<HTMLTableRowElement>('tbody[naizo-list="matrix"] > tr');
    expect(rows.length).toBe(2);
    expect(rows[0]?.querySelector('td:last-child .naizo-item-tools')).not.toBeNull();
    const table = document.querySelector('table')!;
    expect(table.nextElementSibling?.classList.contains('naizo-list-footer')).toBe(true);

    // 3. Per-row radio name scoping keeps row 1 ("high") and row 2 ("low") checked simultaneously (EC13)
    const row1High = rows[0]?.querySelector<HTMLInputElement>('input[value="high"]');
    const row2Low = rows[1]?.querySelector<HTMLInputElement>('input[value="low"]');
    expect(row1High?.checked).toBe(true);
    expect(row2Low?.checked).toBe(true);
    expect(row1High?.name).not.toBe(row2Low?.name);

    // 4. @media print hiding rule exists in #__naizodb_styles__ and Shadow DOM (EC29)
    const styleEl = document.getElementById('__naizodb_styles__');
    expect(styleEl?.textContent).toContain('@media print');
    const hostShadow = document.getElementById('__naizodb_host__')?.shadowRoot;
    expect(hostShadow?.innerHTML).toContain('@media print');
    expect(hostShadow?.getElementById('status')?.getAttribute('aria-live')).toBe('polite');

    // 5. Programmatic addItem does NOT steal focus (EC31) and emits naizo:item & naizo:change (EC40)
    const outsideInput = document.getElementById('outside-focus') as HTMLInputElement;
    outsideInput.focus();
    expect(document.activeElement).toBe(outsideInput);

    Naizo.addItem('matrix', { title: 'Row 3', level: 'high' });
    expect(document.activeElement).toBe(outsideInput);
    expect(itemEvents.length).toBe(1);
    expect(itemEvents[0]?.list).toBe('matrix');
    expect(itemEvents[0]?.index).toBe(2);
    expect(changeEvents.some((ev) => ev.scope === 'lists' && ev.action === 'add')).toBe(true);

    // User-clicked [naizo-add] DOES focus the first text input of the new row (EC31)
    const addMatrixBtn = document.querySelector<HTMLButtonElement>('[naizo-add="matrix"]');
    addMatrixBtn?.click();
    const allMatrixRows = document.querySelectorAll<HTMLTableRowElement>(
      'tbody[naizo-list="matrix"] > tr',
    );
    expect(allMatrixRows.length).toBe(4);
    expect(document.activeElement).toBe(
      allMatrixRows[3]?.querySelector<HTMLInputElement>('input[type="text"]'),
    );

    // 6. Auto-template stripped on export when list has >= 1 item, kept when 0 items (EC09)
    const exportedWithItems = Naizo.exportHTML();
    expect(exportedWithItems).not.toContain('data-naizo-auto-template');
    expect(exportedWithItems).toContain('name="lvl"');

    // Remove all items from `bullets` -> auto-template is kept on export (EC09)
    Naizo.removeItem('bullets', 1);
    Naizo.removeItem('bullets', 0);
    const exportedEmptyList = Naizo.exportHTML();
    expect(exportedEmptyList).toContain('data-naizo-auto-template="true"');

    window.removeEventListener('naizo:change', onChange);
    window.removeEventListener('naizo:item', onItem);
  });

  it('executes the shipped dist/naizo.js IIFE bundle with full M4 behavioral parity (M4.4, EC30)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.documentElement.setAttribute('data-naizo-manual', '');
    // Evaluate the actual shipped dist/naizo.js browser IIFE bundle
    runInThisContext(iifeBundleCode);
    const bundleNaizo = window.Naizo;
    expect(bundleNaizo).toBeDefined();
    expect(window.NaizoDB).toBe(bundleNaizo);
    expect(bundleNaizo).not.toBe(Naizo);

    const initialJson = JSON.stringify(
      {
        _meta: {},
        fields: {
          title: 'Bundle Spec',
          unboundField: 'Kept by Bundle',
          status: 'Shipped',
          count: 7,
        },
        lists: {
          tasks: [{ id: 'b-1', title: 'Bundle Task 1', extra: 42 }],
          unboundList: [{ id: 'u-1' }],
        },
        custom: { rate: 100 },
      },
      null,
      2,
    );
    let diskHtml = `\uFEFF<html><head><script id="naizodb" type="application/json">\n${initialJson}\n</script></head><body class="keep-body"></body></html>`;
    let diskMtime = 5000;

    document.head.innerHTML = `<script id="naizodb" type="application/json">\n${initialJson}\n</script>`;
    document.body.innerHTML = `
      <input id="b-t1" type="text" naizo="title" value="">
      <input id="b-t2" type="text" naizo="title" value="">
      <input id="b-count" type="text" naizo="count" value="">
      <div id="b-note" contenteditable="true" naizo="note"></div>
      <select id="b-status" naizo="status">
        <option value="Draft">Draft</option>
      </select>
      <div naizo-ignore><input type="text" naizo="ignored" value="skip">Keep user ignore</div>
      <div naizo-list="tasks">
        <div naizo-item><input type="text" naizo="title" value=""></div>
      </div>
    `;

    await bundleNaizo.init();

    // Verify pass-through keys, unknown <select> preservation, and duplicate scalar propagation in dist/naizo.js
    expect(bundleNaizo.getField('unboundField')).toBe('Kept by Bundle');
    expect(bundleNaizo.getField('status')).toBe('Shipped');
    expect(bundleNaizo.getField('count')).toBe(7);
    expect(bundleNaizo.getList('unboundList')).toEqual([{ id: 'u-1' }]);
    expect(bundleNaizo.getList('tasks')).toEqual([
      { id: 'b-1', title: 'Bundle Task 1', extra: 42 },
    ]);

    const bt1 = document.getElementById('b-t1') as HTMLInputElement;
    const bt2 = document.getElementById('b-t2') as HTMLInputElement;
    bt1.value = 'Edited via Bundle';
    bt1.dispatchEvent(new Event('input', { bubbles: true }));
    expect(bt2.value).toBe('Edited via Bundle');
    expect(bundleNaizo.getField('title')).toBe('Edited via Bundle');

    // Plain-text contenteditable & \u003c escaping
    bundleNaizo.setField('note', '</script><img src=x onerror=alert(1)>');
    const noteEl = document.getElementById('b-note') as HTMLElement;
    expect(noteEl.querySelector('img')).toBeNull();
    expect(noteEl.textContent).toBe('</script><img src=x onerror=alert(1)>');

    // Surgical disk write + shallow key merge + conflict backup/restore + copyJSON + unlink + exportHTML
    window.showSaveFilePicker = vi.fn().mockResolvedValue({
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
      getFile: vi.fn().mockImplementation(async () => ({
        lastModified: diskMtime,
        arrayBuffer: async () => new TextEncoder().encode(diskHtml).buffer,
        text: async () => diskHtml.replace(/^\uFEFF/, ''),
      })),
      createWritable: vi.fn().mockImplementation(async () => ({
        write: async (data: string) => {
          diskHtml = data;
          diskMtime += 100;
        },
        close: async () => {},
      })),
    });

    const host = document.getElementById('__naizodb_host__');
    (host?.shadowRoot?.getElementById('action') as HTMLButtonElement | null)?.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(diskHtml.startsWith('\uFEFF')).toBe(true);
    expect(diskHtml).toContain('<body class="keep-body"></body>');
    expect(diskHtml).toContain('\\u003c/script>');

    const copied = await bundleNaizo.copyJSON();
    expect(copied).toContain('"Edited via Bundle"');

    const exported = bundleNaizo.exportHTML();
    expect(exported).toContain('Keep user ignore');
    expect(exported).not.toContain('__naizodb_host__');
    expect(exported).toContain('value="Edited via Bundle"');

    await bundleNaizo.unlink();
    expect(host?.shadowRoot?.getElementById('status')?.textContent).toBe(
      'Browser Cache · Click to Link Disk',
    );

    // Verify M4.5 Online Mode, reset(), and downloadHTML() in shipped dist/naizo.js bundle
    const bundleClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    document.documentElement.setAttribute('naizo-mode', 'online');
    bundleNaizo.reset();
    expect(bundleNaizo.getField('title')).toBe('Bundle Spec');
    expect(host?.shadowRoot?.getElementById('status')?.textContent).toBe('Saved in Browser');
    const bundlePortable = bundleNaizo.downloadHTML('bundle-export');
    expect(bundleClickSpy).toHaveBeenCalledTimes(1);
    expect(bundlePortable).not.toContain('naizo-mode="online"');
    expect(bundlePortable).toContain('value="Bundle Spec"');
    bundleClickSpy.mockRestore();

    Reflect.deleteProperty(window, 'showSaveFilePicker');
    document.documentElement.removeAttribute('naizo-mode');
    document.documentElement.removeAttribute('data-naizo-manual');
    window.Naizo = Naizo;
    window.NaizoDB = NaizoDB;
    warnSpy.mockRestore();
  });

  it('prevents self-bound item toolbar text pollution, preserves pre-write conflict status, and avoids DOM re-seeding on restore', async () => {
    const baseJson = JSON.stringify(
      {
        _meta: {},
        fields: { owner: 'Kenji', shared: 'v0', diskOnly: '' },
        lists: {
          steps: [{ label: 'Step One' }],
        },
        custom: {},
      },
      null,
      2,
    );
    let diskHtml = `<html><head><script id="naizodb" type="application/json">\n${baseJson}\n</script></head><body></body></html>`;
    let diskMtime = 1000;

    document.head.innerHTML = `<script id="naizodb" type="application/json">\n${baseJson}\n</script>`;
    document.body.innerHTML = `
      <input id="owner-in" type="text" naizo="owner" value="Kenji">
      <input id="shared-in" type="text" naizo="shared" value="v0">
      <input id="disk-only-in" type="text" naizo="diskOnly" value="">
      <ul naizo-list="steps">
        <li naizo-item contenteditable="true" naizo="label">Seed</li>
      </ul>
    `;

    await initNaizo();

    // 1. Compact FNV-1a hash manifest stored in naizodb_disk_hash_/ (D16)
    const initialHash = localStorage.getItem('naizodb_disk_hash_/');
    expect(initialHash).toMatch(/^fnv1a:[0-9a-f]{8}\|/);

    // 2. Self-bound <li naizo-item contenteditable="true" naizo="label"> excludes .naizo-item-tools text and keeps toolbar on update
    const li = document.querySelector('ul[naizo-list="steps"] > li') as HTMLElement;
    expect(li.querySelector('.naizo-item-tools')).not.toBeNull();
    expect(Naizo.getList('steps')).toEqual([{ label: 'Step One' }]);

    // Simulate user typing into self-bound <li> while .naizo-item-tools is mounted inside it
    const textNode = Array.from(li.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.nodeValue = 'Step One Edited';
    li.dispatchEvent(new Event('input', { bubbles: true }));
    expect(Naizo.getList('steps')).toEqual([{ label: 'Step One Edited' }]);

    // Programmatic updateItem preserves .naizo-item-tools child inside self-bound <li>
    Naizo.updateItem('steps', 0, { label: 'Step One Programmatic' });
    expect(li.querySelector('.naizo-item-tools')).not.toBeNull();
    expect(Naizo.getList('steps')).toEqual([{ label: 'Step One Programmatic' }]);

    // 3. Pre-write merge with both browserKeptKeys and hasCollision preserves conflict pill status
    Naizo.deleteField('diskOnly');
    Naizo.setField('owner', 'Alice');
    Naizo.setField('shared', 'browser-v1');

    const agentJson = JSON.stringify(
      {
        _meta: {},
        fields: { owner: 'Kenji', shared: 'agent-v1', diskOnly: 'AddedByAgent' },
        lists: {
          steps: [{ label: 'Step One Programmatic' }],
        },
        custom: {},
      },
      null,
      2,
    );
    diskHtml = `<html><head><script id="naizodb" type="application/json">\n${agentJson}\n</script></head><body></body></html>`;
    diskMtime += 500;

    window.showSaveFilePicker = vi.fn().mockResolvedValue({
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
      getFile: vi.fn().mockImplementation(async () => ({
        lastModified: diskMtime,
        text: async () => diskHtml,
      })),
      createWritable: vi.fn().mockImplementation(async () => ({
        write: async (data: string) => {
          diskHtml = data;
          diskMtime += 100;
        },
        close: async () => {},
      })),
    });

    const host = document.getElementById('__naizodb_host__');
    (host?.shadowRoot?.getElementById('action') as HTMLButtonElement | null)?.click();
    await new Promise((r) => setTimeout(r, 30));

    // Conflict status is preserved in pill even after merged write completes
    expect(host?.shadowRoot?.getElementById('status')?.textContent).toBe(
      'External Disk Edit · Conflict Backed Up',
    );
    expect(Naizo.getField('diskOnly')).toBe('AddedByAgent');

    // 4. Clicking Restore restores pre-merge browser state without re-seeding diskOnly from DOM
    const restoreBtn = host?.shadowRoot?.getElementById('restore') as HTMLButtonElement | null;
    restoreBtn?.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(Naizo.getField('shared')).toBe('browser-v1');
    expect(Naizo.getField('diskOnly')).toBeUndefined();
    expect((document.getElementById('disk-only-in') as HTMLInputElement).value).toBe('');

    // 5. Naizo.delete(key) removes custom key and Naizo.deleteField(key) clears bound DOM input (EC35)
    Naizo.set('customKey', 'tempVal');
    expect(Naizo.get('customKey')).toBe('tempVal');
    Naizo.delete('customKey');
    expect(Naizo.get('customKey')).toBeUndefined();

    Naizo.setField('owner', 'ToBeCleared');
    expect((document.getElementById('owner-in') as HTMLInputElement).value).toBe('ToBeCleared');
    Naizo.deleteField('owner');
    expect((document.getElementById('owner-in') as HTMLInputElement).value).toBe('');

    // 6. Cold-reload 3-way key merge via per-key FNV-1a hashes + EC04 explicit repair action
    await Naizo.unlink();
    localStorage.clear();
    const coldBase = JSON.stringify(
      { _meta: {}, fields: { author: 'Kenji', status: 'Draft' }, lists: {}, custom: {} },
      null,
      2,
    );
    document.head.innerHTML = `<script id="naizodb" type="application/json">\n${coldBase}\n</script>`;
    document.body.innerHTML = `
      <input id="author-in" type="text" naizo="author" value="Kenji">
      <input id="status-in" type="text" naizo="status" value="Draft">
    `;
    await initNaizo();

    // User edits `author` in browser while unlinked
    Naizo.setField('author', 'Alice');
    // External agent edits `status` on disk, then user reloads the page
    const coldDiskEdited = JSON.stringify(
      { _meta: {}, fields: { author: 'Kenji', status: 'Approved' }, lists: {}, custom: {} },
      null,
      2,
    );
    document.head.innerHTML = `<script id="naizodb" type="application/json">\n${coldDiskEdited}\n</script>`;
    await initNaizo();

    // Both unrelated edits survive cold page reload with no collision!
    expect(Naizo.getField('author')).toBe('Alice');
    expect(Naizo.getField('status')).toBe('Approved');
    expect(localStorage.getItem('naizodb_backup_/')).toBeNull();

    // Explicit repair button on broken startup JSON (EC04)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.head.innerHTML = `<script id="naizodb" type="application/json">{broken</script>`;
    await initNaizo();
    const pillHost = document.getElementById('__naizodb_host__');
    const repairBtn = pillHost?.shadowRoot?.getElementById('restore') as HTMLButtonElement | null;
    expect(repairBtn?.style.display).toBe('inline-block');
    expect(repairBtn?.textContent).toBe('↺ Repair');
    repairBtn?.click();
    expect(readScriptDb().fields.author).toBe('Alice');
    warnSpy.mockRestore();

    Reflect.deleteProperty(window, 'showSaveFilePicker');
  });

  it('covers O(1) key-scoped selector, visibilitychange flush, IDB granted handle dirty cache UX, /index.html normalization, auto-template regeneration, and plain self-bound items (EC09, EC10, EC11, EC12, EC16, EC36, EC46)', async () => {
    const origIdbDesc = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    const origPath = location.pathname;
    window.history.replaceState({}, '', '/specs/index.html');

    const diskInitial = JSON.stringify(
      {
        _meta: {},
        fields: { title: 'Disk v1', falseCe: 'Static text' },
        lists: {
          tags: [{ name: 'alpha' }],
        },
        custom: {},
      },
      null,
      2,
    );
    let diskHtml = `<html><head><script id="naizodb" type="application/json">\n${diskInitial}\n</script></head><body></body></html>`;
    let diskMtime = 1000;

    // Seed dirty localStorage cache under normalized /specs/ key while disk still has Disk v1 (EC11, EC36)
    localStorage.setItem(
      'naizodb_state_/specs/',
      JSON.stringify({
        _meta: {},
        fields: { title: 'Cached Newer v2', falseCe: 'Static text' },
        lists: { tags: [{ name: 'alpha' }] },
        custom: {},
      }),
    );

    const mockGrantedHandle = {
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
      getFile: vi.fn().mockImplementation(async () => ({
        lastModified: diskMtime,
        text: async () => diskHtml,
      })),
      createWritable: vi.fn().mockImplementation(async () => ({
        write: async (data: string) => {
          diskHtml = data;
          diskMtime += 100;
        },
        close: async () => {},
      })),
    };

    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        open: () => {
          const req: {
            result: unknown;
            onsuccess: null | (() => void);
            onerror: null | (() => void);
            onupgradeneeded: null | (() => void);
          } = {
            result: {
              createObjectStore: () => ({}),
              transaction: () => ({
                objectStore: () => ({
                  get: () => {
                    const getReq: { result: unknown; onsuccess: null | (() => void) } = {
                      result: mockGrantedHandle,
                      onsuccess: null,
                    };
                    queueMicrotask(() => getReq.onsuccess?.());
                    return getReq;
                  },
                  put: () => ({}),
                  delete: () => {
                    const delReq: { onsuccess: null | (() => void) } = { onsuccess: null };
                    queueMicrotask(() => delReq.onsuccess?.());
                    return delReq;
                  },
                }),
              }),
            },
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null,
          };
          queueMicrotask(() => req.onsuccess?.());
          return req;
        },
      },
    });

    document.head.innerHTML = `<script id="naizodb" type="application/json">\n${diskInitial}\n</script>`;
    // Include a stale data-naizo-auto-template alongside updated [naizo-item] markup (EC09),
    // a plain non-contenteditable self-bound <li naizo-item naizo="name"> (EC46),
    // and a contenteditable="false" element (EC12)
    document.body.innerHTML = `
      <input id="title-in" type="text" naizo="title" value="">
      <div id="false-ce" contenteditable="false" naizo="falseCe">Initial</div>
      <ul naizo-list="tags">
        <template naizo-template data-naizo-auto-template="true">
          <li naizo-item class="stale-class" naizo="name"></li>
        </template>
        <li naizo-item class="fresh-class" naizo="name">seed</li>
      </ul>
    `;

    await initNaizo();
    await new Promise((r) => setTimeout(r, 20));

    // 1. Granted IDB handle with dirty cache stays amber until Naizo.save() writes to disk (EC36)
    const host = document.getElementById('__naizodb_host__');
    const statusEl = host?.shadowRoot?.getElementById('status');
    const dotEl = host?.shadowRoot?.getElementById('dot');
    expect(statusEl?.textContent).toBe('Browser Cache · Click to Link Disk');
    expect(dotEl?.className).toBe('dot');

    const saveOk = await Naizo.save();
    expect(saveOk).toBe(true);
    expect(statusEl?.textContent).toBe('Synced to Disk');
    expect(dotEl?.className).toBe('dot saved');
    expect(diskHtml).toContain('"title": "Cached Newer v2"');

    // 2. Stale data-naizo-auto-template was regenerated from the fresh [naizo-item] on boot (EC09)
    // and plain non-contenteditable self-bound <li naizo-item naizo="name"> works with toolbar (EC46)
    Naizo.addItem('tags', { name: 'beta' });
    const tagItems = document.querySelectorAll<HTMLElement>('ul[naizo-list="tags"] > li');
    expect(tagItems.length).toBe(2);
    expect(tagItems[1]?.classList.contains('fresh-class')).toBe(true);
    expect(tagItems[1]?.classList.contains('stale-class')).toBe(false);
    expect(tagItems[1]?.querySelector('.naizo-item-tools')).not.toBeNull();
    Naizo.updateItem('tags', 1, { name: 'beta-updated' });
    expect(tagItems[1]?.querySelector('.naizo-item-tools')).not.toBeNull();
    expect(Naizo.getList('tags')[1]).toEqual({ name: 'beta-updated' });
    const exported = Naizo.exportHTML();
    expect(exported).toContain('beta-updated');
    expect(exported).not.toContain('naizo-item-tools');

    // 3. contenteditable="false" hydrated as plain text leaf and does not capture child input events as contenteditable (EC12)
    const falseCe = document.getElementById('false-ce') as HTMLElement;
    expect(falseCe.textContent).toBe('Static text');

    // 4. O(1) key-scoped selector & zero live setAttribute calls on input, plus visibilitychange: hidden flush (EC16)
    const titleIn = document.getElementById('title-in') as HTMLInputElement;
    const qsaSpy = vi.spyOn(document, 'querySelectorAll');
    const setAttrSpy = vi.spyOn(Element.prototype, 'setAttribute');

    titleIn.value = 'Typed O(1)';
    titleIn.dispatchEvent(new Event('input', { bubbles: true }));

    expect(qsaSpy).toHaveBeenCalledWith('[naizo="title"], [data-naizo="title"]');
    expect(setAttrSpy).not.toHaveBeenCalled();
    qsaSpy.mockRestore();
    setAttrSpy.mockRestore();

    // Flush pending debounced persistence via visibilitychange -> hidden (EC16)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(readScriptDb().fields.title).toBe('Typed O(1)');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    // 5. Window focus event triggers live disk sync (EC10)
    const focusDiskJson = JSON.stringify(
      {
        _meta: {},
        fields: { title: 'Typed O(1)', falseCe: 'Updated on Focus' },
        lists: { tags: [{ name: 'alpha' }, { name: 'beta-updated' }] },
        custom: {},
      },
      null,
      2,
    );
    diskHtml = `<html><head><script id="naizodb" type="application/json">\n${focusDiskJson}\n</script></head><body></body></html>`;
    diskMtime += 500;
    window.dispatchEvent(new Event('focus'));
    await new Promise((r) => setTimeout(r, 20));
    expect(Naizo.getField('falseCe')).toBe('Updated on Focus');

    await Naizo.unlink();
    window.history.replaceState({}, '', origPath);
    if (origIdbDesc) {
      Object.defineProperty(globalThis, 'indexedDB', origIdbDesc);
    } else {
      Reflect.deleteProperty(globalThis, 'indexedDB');
    }
  });

  it('intercepts Cmd/Ctrl+S save shortcut, flushes disk on tab hide, and merges uncommitted multi-tab storage events (M4.5a, M4.5b, D40, EC47)', async () => {
    const baseJson = JSON.stringify(
      {
        _meta: {},
        fields: { alpha: 'init-a', beta: 'init-b' },
        lists: {},
        custom: {},
      },
      null,
      2,
    );
    let diskHtml = `<html><head><script id="naizodb" type="application/json">\n${baseJson}\n</script></head><body></body></html>`;
    let diskMtime = 1000;

    document.head.innerHTML = `<script id="naizodb" type="application/json">\n${baseJson}\n</script>`;
    document.body.innerHTML = `
      <input id="alpha-in" type="text" naizo="alpha" value="init-a">
      <input id="beta-in" type="text" naizo="beta" value="init-b">
      <input id="orphan-alias" type="text" data-naizo-field="ignored_alias" value="should-not-bind">
    `;

    await initNaizo();

    // Verify orphaned data-naizo-field alias is no longer bound (M4.5e, EC49)
    expect(Naizo.getField('ignored_alias')).toBeUndefined();

    // 1. #action tooltip advertises ⌘S / Ctrl+S (M4.5a)
    const host = document.getElementById('__naizodb_host__');
    const actionBtn = host?.shadowRoot?.getElementById('action') as HTMLButtonElement | null;
    expect(actionBtn?.title).toContain('⌘S / Ctrl+S');

    // 2. Pressing Cmd+S while unlinked prevents default, flushes localStorage, and opens showSaveFilePicker
    let permissionState: PermissionState = 'granted';
    const requestPermSpy = vi.fn().mockImplementation(async () => {
      permissionState = 'granted';
      return 'granted';
    });
    const writeSpy = vi.fn().mockImplementation(async (data: string) => {
      diskHtml = data;
      diskMtime += 100;
    });

    const pickerSpy = vi.fn().mockResolvedValue({
      queryPermission: vi.fn().mockImplementation(async () => permissionState),
      requestPermission: requestPermSpy,
      getFile: vi.fn().mockImplementation(async () => ({
        lastModified: diskMtime,
        text: async () => diskHtml,
      })),
      createWritable: vi.fn().mockImplementation(async () => ({
        write: writeSpy,
        close: async () => {},
      })),
    });
    window.showSaveFilePicker = pickerSpy;

    const alphaIn = document.getElementById('alpha-in') as HTMLInputElement;
    alphaIn.value = 'cmd-s-linked';
    alphaIn.dispatchEvent(new Event('input', { bubbles: true }));

    // Shift+Cmd+S is ignored
    const shiftSaveEvt = new KeyboardEvent('keydown', {
      key: 's',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(shiftSaveEvt);
    expect(shiftSaveEvt.defaultPrevented).toBe(false);
    expect(pickerSpy).not.toHaveBeenCalled();

    // Cmd+S links disk and writes pending edit (even if event is non-cancelable, handledKeyEvents prevents double firing across document + window)
    const cmdSaveEvt = new KeyboardEvent('keydown', {
      key: 's',
      metaKey: true,
      bubbles: true,
      cancelable: false,
    });
    document.dispatchEvent(cmdSaveEvt);
    expect(pickerSpy).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 25));
    expect(diskHtml).toContain('"alpha": "cmd-s-linked"');
    expect(host?.shadowRoot?.getElementById('status')?.textContent).toBe('Synced to Disk');

    // 3. Pressing Ctrl+S when linked with 'granted' permission flushes via Naizo.save() immediately
    alphaIn.value = 'ctrl-s-saved';
    alphaIn.dispatchEvent(new Event('input', { bubbles: true }));
    const ctrlSaveEvt = new KeyboardEvent('keydown', {
      key: 'S',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(ctrlSaveEvt);
    expect(ctrlSaveEvt.defaultPrevented).toBe(true);
    await new Promise((r) => setTimeout(r, 25));
    expect(diskHtml).toContain('"alpha": "ctrl-s-saved"');

    // 4. When permission is 'prompt' (needs-permission), denied requestPermission stays in Resume Disk Sync without popping showSaveFilePicker; granted resumes
    permissionState = 'prompt';
    await Naizo.save();
    expect(host?.shadowRoot?.getElementById('status')?.textContent).toBe('Resume Disk Sync');
    expect(actionBtn?.title).toContain('⌘S / Ctrl+S');

    requestPermSpy.mockResolvedValueOnce('denied');
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 's',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(pickerSpy).toHaveBeenCalledTimes(1);
    expect(host?.shadowRoot?.getElementById('status')?.textContent).toBe('Resume Disk Sync');

    alphaIn.value = 'resumed-via-cmd-s';
    alphaIn.dispatchEvent(new Event('input', { bubbles: true }));
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 's',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await new Promise((r) => setTimeout(r, 25));
    expect(requestPermSpy).toHaveBeenCalled();
    expect(diskHtml).toContain('"alpha": "resumed-via-cmd-s"');

    // 5. visibilitychange: hidden starts writeToDisk() immediately while debounced edit is pending (M4.5b)
    alphaIn.value = 'flushed-on-tab-hide';
    alphaIn.dispatchEvent(new Event('input', { bubbles: true }));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 25));
    expect(diskHtml).toContain('"alpha": "flushed-on-tab-hide"');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    // 6. Cross-tab storage event merges uncommitted persistTimeout edits using e.oldValue as base and surfaces same-key collisions (M4.5b)
    await Naizo.unlink();
    const sharedBeforeTabA = JSON.stringify({
      _meta: {},
      fields: { alpha: 'session-shared-a', beta: 'init-b' },
      lists: {},
      custom: {},
    });
    Naizo.setField('alpha', 'session-shared-a');

    const betaIn = document.getElementById('beta-in') as HTMLInputElement;
    betaIn.value = 'tab-b-uncommitted';
    betaIn.dispatchEvent(new Event('input', { bubbles: true }));

    // Tab A commits an update to alpha while Tab B still has beta in its 150ms persistTimeout
    const tabAState = JSON.stringify({
      _meta: {},
      fields: { alpha: 'tab-a-committed', beta: 'init-b' },
      lists: {},
      custom: {},
    });
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'naizodb_state_/',
        oldValue: sharedBeforeTabA,
        newValue: tabAState,
      }),
    );

    expect(Naizo.getField('alpha')).toBe('tab-a-committed');
    expect(Naizo.getField('beta')).toBe('tab-b-uncommitted');

    // Same-key cross-tab collision while persistTimeout is active backs up Tab B and sets conflict status on pill
    betaIn.value = 'tab-b-conflict';
    betaIn.dispatchEvent(new Event('input', { bubbles: true }));
    const tabAConflictState = JSON.stringify({
      _meta: {},
      fields: { alpha: 'tab-a-committed', beta: 'tab-a-conflict' },
      lists: {},
      custom: {},
    });
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'naizodb_state_/',
        oldValue: tabAState,
        newValue: tabAConflictState,
      }),
    );
    expect(Naizo.getField('beta')).toBe('tab-a-conflict');
    expect(host?.shadowRoot?.getElementById('status')?.textContent).toBe(
      'External Disk Edit · Conflict Backed Up',
    );
    expect(
      (host?.shadowRoot?.getElementById('restore') as HTMLButtonElement | null)?.style.display,
    ).toBe('inline-block');

    // Flush Tab B's state, then simulate Tab A writing that exact state to disk and updating naizodb_disk_hash_/
    Naizo.setField('beta', 'tab-b-uncommitted');
    expect(host?.shadowRoot?.getElementById('status')?.textContent).toBe(
      'Browser Cache · Click to Link Disk',
    );

    // Re-init to compute canonical hash for the current state, then test snapshot storage event
    const currentRaw = document.getElementById('naizodb')?.textContent ?? '';
    await initNaizo();
    const matchingSnapshotHash = localStorage.getItem('naizodb_disk_hash_/')!;
    // Mark pill cached first
    Naizo.setField('beta', 'tab-b-uncommitted');
    document.head.querySelector('#naizodb')!.textContent = currentRaw;
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'naizodb_disk_hash_/',
        newValue: matchingSnapshotHash,
      }),
    );
    expect(
      document.getElementById('__naizodb_host__')?.shadowRoot?.getElementById('status')
        ?.textContent,
    ).toBe('Synced to Disk');

    // 7. EC04 startupInvalidDb blocks Cmd+S, downloadHTML(), and unlink() from overwriting the error status
    Reflect.deleteProperty(window, 'showSaveFilePicker');
    document.head.innerHTML = `<script id="naizodb" type="application/json">{ broken json </script>`;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await initNaizo();
    const errHost = document.getElementById('__naizodb_host__');
    expect(errHost?.shadowRoot?.getElementById('status')?.textContent).toBe(
      'Invalid #naizodb JSON',
    );
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true }),
    );
    Naizo.downloadHTML('should-not-overwrite-error');
    await Naizo.unlink();
    expect(errHost?.shadowRoot?.getElementById('status')?.textContent).toBe(
      'Invalid #naizodb JSON',
    );
    warnSpy.mockRestore();
  });

  it('supports Online Mode (naizo-mode), Naizo.reset() with Shadow DOM confirmation + backup, and portable Naizo.downloadHTML() (M4.5d, D41, EC48)', async () => {
    document.documentElement.setAttribute('naizo-mode', 'online');
    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": { "project": "Starter Cloud" },
        "lists": {
          "todos": [{ "text": "Initial cloud item" }]
        },
        "custom": { "zoom": 100 }
      }
      </script>
      <script src="../dist/naizo.js" defer></script>
      <script src="./dist/naizo.min.js" defer></script>
    `;
    document.body.innerHTML = `
      <input id="proj-in" type="text" naizo="project" value="Starter Cloud">
      <input id="dom-seed-in" type="text" naizo="domSeeded" value="SeedDefault">
      <ul naizo-list="todos">
        <li naizo-item><input type="text" naizo="text" value=""></li>
      </ul>
    `;

    await initNaizo();

    const host = document.getElementById('__naizodb_host__');
    const statusEl = host?.shadowRoot?.getElementById('status');
    const dotEl = host?.shadowRoot?.getElementById('dot');
    const actionBtn = host?.shadowRoot?.getElementById('action') as HTMLButtonElement | null;
    const resetBtn = host?.shadowRoot?.getElementById('reset') as HTMLButtonElement | null;
    const resetConfirm = host?.shadowRoot?.getElementById('reset-confirm') as HTMLElement | null;
    const resetYes = host?.shadowRoot?.getElementById('reset-yes') as HTMLButtonElement | null;
    const resetCancel = host?.shadowRoot?.getElementById(
      'reset-cancel',
    ) as HTMLButtonElement | null;
    const restoreBtn = host?.shadowRoot?.getElementById('restore') as HTMLButtonElement | null;

    // 1. Clean Online Mode boot shows green "Saved in Browser", "⬇ Save to PC", and hides "↺ Reset"
    expect(statusEl?.textContent).toBe('Saved in Browser');
    expect(dotEl?.className).toBe('dot saved');
    expect(actionBtn?.style.display).toBe('inline-block');
    expect(actionBtn?.textContent).toBe('⬇ Save to PC');
    expect(resetBtn?.style.display).toBe('none');

    // 2. Editing state in Online Mode keeps "Saved in Browser" and reveals "↺ Reset"
    Naizo.setField('project', 'Edited in Browser');
    Naizo.addItem('todos', { text: 'Added online' });
    expect(statusEl?.textContent).toBe('Saved in Browser');
    expect(resetBtn?.style.display).toBe('inline-block');

    // Cmd+S in Online Mode flashes "✓ Saved in Browser"
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true }),
    );
    expect(statusEl?.textContent).toBe('✓ Saved in Browser');

    // 3. Clicking "↺ Reset" opens Shadow DOM mini-confirmation popover; Escape or Cancel dismisses without resetting
    resetBtn?.click();
    expect(resetConfirm?.style.display).toBe('inline-flex');
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(resetConfirm?.style.display).toBe('none');
    resetBtn?.click();
    expect(resetConfirm?.style.display).toBe('inline-flex');
    resetCancel?.click();
    expect(resetConfirm?.style.display).toBe('none');
    expect(Naizo.getField('project')).toBe('Edited in Browser');

    // 4. Confirming Reset backs up pre-reset state, restores initialDiskDb (including DOM-seeded defaults), hides Reset, and shows Restore
    const changeEvents: Array<Record<string, unknown>> = [];
    const onResetChange = (e: Event) => {
      changeEvents.push((e as CustomEvent<Record<string, unknown>>).detail);
    };
    window.addEventListener('naizo:change', onResetChange);

    resetBtn?.click();
    expect(resetConfirm?.style.display).toBe('inline-flex');
    resetYes?.click();

    expect(resetConfirm?.style.display).toBe('none');
    expect(Naizo.getField('project')).toBe('Starter Cloud');
    expect(Naizo.getField('domSeeded')).toBe('SeedDefault');
    expect(Naizo.getList('todos')).toEqual([{ text: 'Initial cloud item' }]);
    expect(localStorage.getItem('naizodb_state_/')).toBeNull();
    expect(resetBtn?.style.display).toBe('none');
    expect(restoreBtn?.style.display).toBe('inline-block');
    expect(changeEvents.some((d) => d.scope === 'reset')).toBe(true);
    window.removeEventListener('naizo:change', onResetChange);

    // Calling Naizo.reset() again when already at initial state does not clobber the backup in naizodb_backup_<key>
    Naizo.reset();
    expect(restoreBtn?.style.display).toBe('inline-block');

    // 5. Clicking "↺ Restore" undoes the reset from naizodb_backup_<key>
    restoreBtn?.click();
    expect(Naizo.getField('project')).toBe('Edited in Browser');
    expect(Naizo.getList('todos')).toHaveLength(2);
    expect(resetBtn?.style.display).toBe('inline-block');

    // 6. Naizo.downloadHTML() and Online Mode Naizo.exportHTML() rewrite relative naizo(.min).js to npm CDN and strip naizo-mode="online"
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:portable-url');
    const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let downloadedFilename = '';
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedFilename = this.download;
    });

    const portableHtml = Naizo.downloadHTML('my-app');
    expect(downloadedFilename).toBe('my-app.html');
    expect(createUrlSpy).toHaveBeenCalled();
    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:portable-url');
    expect(statusEl?.textContent).toBe('Saved to PC · Ready for Local Mode');
    expect(portableHtml).toContain('https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js');
    expect(portableHtml).toContain('https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js');
    expect(portableHtml).not.toContain('src="../dist/naizo.js"');
    expect(portableHtml).not.toContain('naizo-mode="online"');
    expect(portableHtml).toContain('value="Edited in Browser"');

    // Online Mode exportHTML() also produces portable HTML
    const onlineExport = Naizo.exportHTML();
    expect(onlineExport).toContain('https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js');
    expect(onlineExport).not.toContain('naizo-mode="online"');

    // Switching to Local Mode preserves local relative <script src="../dist/naizo.js"> on Naizo.exportHTML()
    document.documentElement.setAttribute('naizo-mode', 'local');
    const localExport = Naizo.exportHTML();
    expect(localExport).toContain('src="../dist/naizo.js"');
    expect(localExport).toContain('src="./dist/naizo.min.js"');

    createUrlSpy.mockRestore();
    revokeUrlSpy.mockRestore();
    clickSpy.mockRestore();
    document.documentElement.removeAttribute('naizo-mode');
  });

  it('powers declarative master-detail notebook in examples/notes.html without wiping [naizo-item] panes (M4.5c, D40)', async () => {
    const notesDoc = new DOMParser().parseFromString(notesHtml, 'text/html');
    document.head.innerHTML = notesDoc.head.innerHTML;
    document.body.innerHTML = notesDoc.body.innerHTML;

    await initNaizo();

    // Verify all 4 [naizo-item] panes exist with wrapping <label> elements (EC39) and pass-through id/updatedAt keys (D15)
    const initialPanes = Array.from(
      document.querySelectorAll<HTMLElement>('#notes-list > [naizo-item]'),
    );
    expect(initialPanes.length).toBe(4);
    for (const pane of initialPanes) {
      const labels = Array.from(pane.querySelectorAll('label'));
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.control).not.toBeNull();
        expect(pane.contains(label.control)).toBe(true);
      }
    }
    expect(Naizo.getList('notes')[0]?.id).toBe('note-101');
    expect(Naizo.get('activeNoteId')).toBe('note-101');

    // Execute notes.html application script
    const appScript = notesDoc.body.querySelector('script')?.textContent || '';
    runInThisContext(appScript);

    // 1. Only note-101's [naizo-item] pane has .is-active; all 4 panes stay mounted in the DOM
    expect(initialPanes[0]?.classList.contains('is-active')).toBe(true);
    expect(initialPanes[1]?.classList.contains('is-active')).toBe(false);
    expect(document.getElementById('stat-tasks')?.textContent).toBe('2/3 tasks');
    expect(
      Number.parseInt(document.getElementById('stat-words')?.textContent ?? '0', 10),
    ).toBeGreaterThan(10);

    // 2. Clicking second sidebar note switches active pane without recreating DOM nodes
    const sidebarItems = Array.from(
      document.querySelectorAll<HTMLElement>('#note-index-list > .note-index-item'),
    );
    expect(sidebarItems.length).toBe(4);
    sidebarItems[1]?.click();

    expect(Naizo.get('activeNoteId')).toBe('note-102');
    expect(initialPanes[0]?.classList.contains('is-active')).toBe(false);
    expect(initialPanes[1]?.classList.contains('is-active')).toBe(true);
    // Exact same DOM element reference preserved (zero DOM wipe!)
    expect(document.querySelectorAll('#notes-list > [naizo-item]')[1]).toBe(initialPanes[1]);

    // 3. Filtering by category in sidebar narrows visible index, persists category_filter in #naizodb.fields, and activates first matching note without deleting from #naizodb
    const catFilter = document.getElementById('category-filter') as HTMLSelectElement;
    expect(Naizo.getField('category_filter')).toBe('all');
    catFilter.value = 'Research';
    catFilter.dispatchEvent(new Event('change', { bubbles: true }));
    expect(Naizo.getField('category_filter')).toBe('Research');
    expect(document.querySelectorAll('#note-index-list > .note-index-item').length).toBe(1);
    expect(Naizo.get('activeNoteId')).toBe('note-103');
    expect(Naizo.getList('notes').length).toBe(4);

    catFilter.value = 'all';
    catFilter.dispatchEvent(new Event('change', { bubbles: true }));
    expect(Naizo.getField('category_filter')).toBe('all');
    expect(document.querySelectorAll('#note-index-list > .note-index-item').length).toBe(4);

    // Searching with 0 matches shows empty state without overwriting activeNoteId in #naizodb
    const searchIn = document.getElementById('note-search') as HTMLInputElement;
    searchIn.value = 'nonexistent-query-xyz';
    searchIn.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelectorAll('#note-index-list > .note-index-item').length).toBe(0);
    expect(document.getElementById('empty-editor-state')?.style.display).toBe('block');
    expect(Naizo.get('activeNoteId')).toBe('note-103');
    searchIn.value = '';
    searchIn.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.getElementById('empty-editor-state')?.style.display).toBe('none');
    expect(Naizo.get('activeNoteId')).toBe('note-103');

    // 4. Theme field (naizo="theme") updates html[data-theme]
    Naizo.setField('theme', 'dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // 5. Alt+N (including macOS Option+N where key==='Dead' and code==='KeyN') creates a new note and activates it; Alt+ArrowUp cycles visible notes
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Dead',
        code: 'KeyN',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(Naizo.getList('notes').length).toBe(5);
    const createdNoteId = Naizo.getList('notes')[4]?.id;
    expect(Naizo.get('activeNoteId')).toBe(createdNoteId);

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(Naizo.get('activeNoteId')).not.toBe(createdNoteId);
  });

  it('validates M5 deliverables (docs/USAGE.md, skills/naizo/SKILL.md) and safe surgical #naizodb CLI replacement with $1/$& payloads', () => {
    const usagePath = resolve(process.cwd(), 'docs/USAGE.md');
    const skillPath = resolve(process.cwd(), 'skills/naizo/SKILL.md');
    const usageMd = readFileSync(usagePath, 'utf-8');
    const skillMd = readFileSync(skillPath, 'utf-8');

    // Verify skills/naizo/SKILL.md YAML frontmatter
    expect(skillMd.startsWith('---\n')).toBe(true);
    expect(skillMd).toContain('name: naizo\n');
    expect(skillMd).toContain('license: MIT\n');
    expect(skillMd).toContain('description: ');

    // Both docs/USAGE.md and skills/naizo/SKILL.md must use a replacement callback function
    // rather than `$1\n${json}\n$3` so dollar signs ($1, $&) in JSON values never corrupt #naizodb
    expect(usageMd).not.toContain('`$1\\n${json}\\n$3`');
    expect(skillMd).not.toContain('`$1\\n${json}\\n$3`');
    expect(usageMd).toContain('(_m, open, _inner, close) => `${open}\\n${json}\\n${close}`');
    expect(skillMd).toContain('(_m, open, _inner, close) => `${open}\\n${json}\\n${close}`');

    // Verify the documented surgical replacement regex & callback safely round-trip $1, $&, and </script>
    const sampleHtml = [
      '<!doctype html><html><head>',
      '<script id="naizodb-other" type="application/json">{"ignored":true}</script>',
      '<script id="naizodb" type="application/json">',
      '{"_meta":{},"fields":{"note":"initial"},"lists":{},"custom":{}}',
      '</script>',
      '</head><body></body></html>',
    ].join('\n');

    const re =
      /(<script\b[^>]*\bid\s*=\s*(?:"naizodb"|'naizodb'|naizodb(?=[>\s/]))[^>]*>)([\s\S]*?)(<\/script>)/i;
    const match = sampleHtml.match(re);
    expect(match).not.toBeNull();
    const db = JSON.parse(match![2]!);
    db.fields.note = 'Price is $100 ($1 / $& / $3) and </script> tag';
    const json = JSON.stringify(db, null, 2).replace(/</g, '\\u003c');
    const updatedHtml = sampleHtml.replace(
      re,
      (_m, open, _inner, close) => `${open}\n${json}\n${close}`,
    );

    // Ensure #naizodb-other was untouched and #naizodb parses back with exact $1/$& string intact
    expect(updatedHtml).toContain(
      '<script id="naizodb-other" type="application/json">{"ignored":true}</script>',
    );
    const verifyMatch = updatedHtml.match(re);
    expect(verifyMatch).not.toBeNull();
    const parsedBack = JSON.parse(verifyMatch![2]!);
    expect(parsedBack.fields.note).toBe('Price is $100 ($1 / $& / $3) and </script> tag');
  });

  it('hydrates and powers the M6.1 documentation & interactive demo website in site/index.html', async () => {
    const siteDoc = new DOMParser().parseFromString(siteHtml, 'text/html');
    document.head.innerHTML = siteDoc.head.innerHTML;
    document.body.innerHTML = siteDoc.body.innerHTML;

    await initNaizo();

    // 1. Verify all [naizo-item] rows wrap their form controls inside <label> (EC39) and preserve pass-through id keys (D15)
    const taskRows = Array.from(
      document.querySelectorAll<HTMLElement>('[naizo-list="tasks"] > [naizo-item]'),
    );
    expect(taskRows.length).toBe(3);
    for (const row of taskRows) {
      const labels = Array.from(row.querySelectorAll('label'));
      expect(labels.length).toBeGreaterThanOrEqual(3);
      for (const label of labels) {
        expect(label.control).not.toBeNull();
        expect(row.contains(label.control)).toBe(true);
      }
    }
    expect(Naizo.getList('tasks')[0]?.id).toBe('task-1');

    // 2. Verify M6.1 sections: dual meaning, architecture loop, starter template links, CDN snippets, and capability matrix
    expect(siteHtml).toContain('内蔵');
    expect(siteHtml).toContain('内臓');
    expect(siteHtml).toContain('../examples/starter.html');
    expect(siteHtml).toContain('../examples/checklist.html');
    expect(siteHtml).toContain('../examples/notes.html');
    expect(siteHtml).toContain('../examples/inventory.html');
    expect(siteHtml).toContain('https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js');
    expect(siteHtml).toContain('https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js');
    expect(siteHtml).toContain('https://unpkg.com/naizojs@latest/dist/naizo.js');
    expect(siteHtml).toContain('prefers-color-scheme: dark');
    expect(siteHtml).toContain('prefers-reduced-motion: reduce');

    // 3. Execute site/index.html script and verify live #naizodb JSON inspector, theme toggle, AI edit simulation, and reset
    const appScript = siteDoc.body.querySelector('script')?.textContent || '';
    runInThisContext(appScript);

    const inspector = document.getElementById('live-json-inspector');
    expect(inspector?.textContent).toContain('"feature_title": "OAuth2 & Rate-Limiting Spec"');
    expect(inspector?.textContent).toContain('"rateLimitRps": 120');
    expect(document.documentElement.getAttribute('data-theme')).toBe('system');

    // Theme toggle button updates fields.theme and html[data-theme]
    document.getElementById('theme-toggle-btn')?.click();
    expect(Naizo.getField('theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.getElementById('theme-toggle-label')?.textContent).toBe('Dark');

    // Simulate AI Edit button marks an unfinished task done and increments rateLimitRps
    document.getElementById('simulate-agent-btn')?.click();
    expect(Naizo.getList('tasks')[1]?.done).toBe(true);
    expect(Naizo.get('rateLimitRps')).toBe(170);
    expect(document.getElementById('rps-val')?.textContent).toBe('170');
    expect(inspector?.textContent).toContain('"rateLimitRps": 170');

    // Reset button restores initial baseline state
    document.getElementById('reset-playground-btn')?.click();
    expect(Naizo.getField('theme')).toBe('system');
    expect(Naizo.get('rateLimitRps')).toBe(120);
    expect(Naizo.getList('tasks')[1]?.done).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('system');
  });

  it('validates M6.2 AI-agent discovery endpoints (site/llms.txt, site/llms-full.txt, site/SKILL.md), site/CNAME, and ci.yml Pages staging', () => {
    const cname = readFileSync(resolve(process.cwd(), 'site/CNAME'), 'utf-8');
    const siteSkill = readFileSync(resolve(process.cwd(), 'site/SKILL.md'), 'utf-8');
    const rootSkill = readFileSync(resolve(process.cwd(), 'skills/naizo/SKILL.md'), 'utf-8');
    const llmsTxt = readFileSync(resolve(process.cwd(), 'site/llms.txt'), 'utf-8');
    const llmsFullTxt = readFileSync(resolve(process.cwd(), 'site/llms-full.txt'), 'utf-8');
    const ciYml = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf-8');

    // 1. CNAME for js.org registration
    expect(cname.trim()).toBe('naizo.js.org');

    // 2. site/SKILL.md is a relative symlink to ../skills/naizo/SKILL.md (single source of truth)
    expect(lstatSync(resolve(process.cwd(), 'site/SKILL.md')).isSymbolicLink()).toBe(true);
    expect(readlinkSync(resolve(process.cwd(), 'site/SKILL.md'))).toBe('../skills/naizo/SKILL.md');
    expect(siteSkill).toBe(rootSkill);

    // 3. site/llms.txt and site/llms-full.txt cover core contract, attributes, API, D45, and safe surgical replacement
    expect(llmsTxt.startsWith('# naizo.js\n')).toBe(true);
    expect(llmsTxt).toContain('https://naizo.js.org/llms-full.txt');
    expect(llmsTxt).toContain('https://naizo.js.org/SKILL.md');
    expect(llmsTxt).toContain('naizo-list="name"');
    expect(llmsTxt).toContain('window.Naizo');

    expect(llmsFullTxt.startsWith('# naizo.js')).toBe(true);
    expect(llmsFullTxt).toContain('<script id="naizodb" type="application/json">');
    expect(llmsFullTxt).toContain('(_m, open, _inner, close) => `${open}\\n${json}\\n${close}`');
    expect(llmsFullTxt).toContain('examples/starter.html');
    expect(llmsFullTxt).toContain('examples/notes.html');

    // 4. ci.yml stages site/. with -RL (dereferencing symlinks) to _site/ and rewrites ../dist/ and ../examples/
    expect(ciYml).toContain('cp -RL site/. _site/');
    expect(ciYml).toContain('cp -R examples _site/');
    expect(ciYml).toContain(
      "sed -e 's#\\.\\./dist/#./dist/#g' -e 's#\\.\\./examples/#./examples/#g' site/index.html > _site/index.html",
    );

    const stagedIndexHtml = siteHtml
      .replace(/\.\.\/dist\//g, './dist/')
      .replace(/\.\.\/examples\//g, './examples/');
    expect(stagedIndexHtml).not.toContain('../dist/');
    expect(stagedIndexHtml).not.toContain('../examples/');
    expect(stagedIndexHtml).toContain('./dist/naizo.js');
    expect(stagedIndexHtml).toContain('./examples/starter.html');
    expect(stagedIndexHtml).toContain('./examples/checklist.html');
    expect(stagedIndexHtml).toContain('./examples/notes.html');
    expect(stagedIndexHtml).toContain('./examples/inventory.html');
    expect(stagedIndexHtml).toContain('./llms.txt');
    expect(stagedIndexHtml).toContain('./llms-full.txt');
    expect(stagedIndexHtml).toContain('./SKILL.md');
  });
});
