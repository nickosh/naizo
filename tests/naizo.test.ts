import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runInThisContext } from 'node:vm';
import { gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import iifeBundleCode from '../dist/naizo.js?raw';
import checklistHtml from '../examples/checklist.html?raw';
import inventoryHtml from '../examples/inventory.html?raw';
import notesHtml from '../examples/notes.html?raw';
import starterHtml from '../examples/starter.html?raw';
import weatherHtml from '../examples/weather.html?raw';
import pkgJson from '../package.json';
import siteHtml from '../site/index.html?raw';
import * as NaizoModule from '../src/index';
import {
  initNaizo,
  Naizo,
  NaizoDB,
  type NaizoBatchOptions,
  type NaizoDatabase,
} from '../src/index';

function readScriptDb(): NaizoDatabase {
  const raw = document.getElementById('naizodb')?.textContent?.trim() ?? '';
  if (!raw) return { _meta: {}, fields: {}, lists: {}, custom: {} };
  return JSON.parse(raw) as NaizoDatabase;
}

describe('naizo.js core runtime', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-naizo-manual');
    document.documentElement.removeAttribute('naizo-manual');
    document.documentElement.removeAttribute('naizo-mode');
    document.documentElement.removeAttribute('data-naizo-mode');
    document.documentElement.removeAttribute('naizo-no-pill');
    document.documentElement.removeAttribute('data-naizo-no-pill');
    document.documentElement.removeAttribute('naizo-pill-corner');
    document.documentElement.removeAttribute('data-naizo-pill-corner');
    document.body.removeAttribute('naizo-mode');
    document.body.removeAttribute('data-naizo-mode');
    document.body.removeAttribute('naizo-no-pill');
    document.body.removeAttribute('data-naizo-no-pill');
    document.body.removeAttribute('naizo-pill-corner');
    document.body.removeAttribute('data-naizo-pill-corner');
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

  it('strips [naizo-strip] / [data-naizo-strip] UI while preserving user [naizo-ignore] elements in auto-templates and exportHTML (D12, D47, EC03, EC07)', async () => {
    document.head.insertAdjacentHTML(
      'beforeend',
      '<script defer src="https://example.com/analytics.js" naizo-strip></script>',
    );
    document.body.innerHTML = `
      <input type="text" naizo="project" value="naizo">
      <div naizo-list="items">
        <div naizo-item>
          <input type="text" naizo="name" value="One">
          <span class="item-custom-widget" naizo-ignore>Item custom badge</span>
          <span class="item-strip-hint" naizo-strip>Transient item hint</span>
        </div>
      </div>
      <div naizo-ignore><input type="range" id="user-widget" value="50">User widget</div>
      <div data-naizo-ignore>Legacy user widget</div>
      <div naizo-strip><input type="text" naizo="stripped_field" value="skip">Hosted demo banner</div>
      <div data-naizo-strip="true">Ephemeral runtime overlay</div>
    `;

    await initNaizo();
    expect(Naizo.getField('stripped_field')).toBeUndefined();
    Naizo.addItem('items', { name: 'Two' });

    const rows = document.querySelectorAll('[naizo-list="items"] > [naizo-item]');
    expect(rows.length).toBe(2);
    expect(rows[0]?.querySelector('.item-custom-widget')?.textContent).toBe('Item custom badge');
    expect(rows[1]?.querySelector('.item-custom-widget')?.textContent).toBe('Item custom badge');
    expect(rows[1]?.querySelector('.item-strip-hint')).toBeNull();

    const exported = Naizo.exportHTML();
    expect(exported).not.toContain('__naizodb_host__');
    expect(exported).not.toContain('__naizodb_styles__');
    expect(exported).not.toContain('naizo-item-tools');
    expect(exported).not.toContain('naizo-list-footer');
    expect(exported).not.toContain('analytics.js');
    expect(exported).not.toContain('Hosted demo banner');
    expect(exported).not.toContain('Transient item hint');
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
      const attrScopeId = parsedDoc.documentElement.getAttribute('naizo-id')?.trim() ?? '';
      expect(attrScopeId.length).toBeGreaterThan(0);
      const rawJson = parsedDoc.getElementById('naizodb')?.textContent?.trim() ?? '';
      expect(rawJson.length).toBeGreaterThan(0);
      const db = JSON.parse(rawJson) as { _meta?: { id?: string } };
      expect(db).toHaveProperty('_meta');
      expect(db._meta?.id).toBe(attrScopeId);
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

      // 7. Exported HTML strips runtime-rendered dict pills and modal KV rows via data-naizo-strip (D47)
      const exportedInvDoc = new DOMParser().parseFromString(Naizo.exportHTML(), 'text/html');
      expect(exportedInvDoc.querySelectorAll('[data-card-dict-tags] > *').length).toBe(0);
      expect(exportedInvDoc.querySelectorAll('#modal-kv-container .custom-kv-row').length).toBe(0);
    } finally {
      addSpy.mockRestore();
      for (const { type, listener } of registeredWinListeners) {
        window.removeEventListener(type, listener);
      }
      document.documentElement.classList.remove('dark');
      document.documentElement.removeAttribute('data-theme');
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
      <div naizo-strip><input type="text" naizo="stripped" value="skip">Strip hosted widget</div>
      <div naizo-list="tasks">
        <div naizo-item><input type="text" naizo="title" value=""></div>
      </div>
    `;

    await bundleNaizo.init();

    // Verify pass-through keys, unknown <select> preservation, and duplicate scalar propagation in dist/naizo.js
    expect(bundleNaizo.getField('unboundField')).toBe('Kept by Bundle');
    expect(bundleNaizo.getField('stripped')).toBeUndefined();
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
    expect(exported).not.toContain('Strip hosted widget');
    expect(exported).not.toContain('__naizodb_host__');
    expect(exported).toContain('value="Edited via Bundle"');

    await bundleNaizo.unlink();
    expect(host?.shadowRoot?.getElementById('status')?.textContent).toBe(
      'Browser Cache · Click to Link Disk',
    );

    // Verify M4.5 Online Mode, reset() (against advanced disk baseline per M11.1/D56), and downloadHTML() in shipped dist/naizo.js bundle
    const bundleClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    document.documentElement.setAttribute('naizo-mode', 'online');
    bundleNaizo.setField('title', 'Temporary Online Draft');
    expect(bundleNaizo.getField('title')).toBe('Temporary Online Draft');
    bundleNaizo.reset();
    expect(bundleNaizo.getField('title')).toBe('Edited via Bundle');
    expect(host?.shadowRoot?.getElementById('status')?.textContent).toBe('Saved in Browser');
    const bundlePortable = bundleNaizo.downloadHTML('bundle-export');
    expect(bundleClickSpy).toHaveBeenCalledTimes(1);
    expect(bundlePortable).not.toContain('naizo-mode="online"');
    expect(bundlePortable).toContain('value="Edited via Bundle"');
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
        <li naizo-item contenteditable="true" naizo="label"><span class="step-prefix" naizo-ignore>📌</span>Seed<span class="step-badge" naizo-ignore>TAG</span></li>
      </ul>
    `;

    await initNaizo();

    // 1. Compact FNV-1a hash manifest stored in naizodb_disk_hash_/ (D16)
    const initialHash = localStorage.getItem('naizodb_disk_hash_/');
    expect(initialHash).toMatch(/^fnv1a:[0-9a-f]{8}\|/);

    // 2. Self-bound <li naizo-item contenteditable="true" naizo="label"> excludes .naizo-item-tools / [naizo-ignore] text and keeps leading/trailing children in place without detaching on update (D47, EC46)
    const li = document.querySelector('ul[naizo-list="steps"] > li') as HTMLElement;
    const prefixEl = li.querySelector('.step-prefix');
    const badgeEl = li.querySelector('.step-badge');
    const toolsEl = li.querySelector('.naizo-item-tools');
    expect(prefixEl?.textContent).toBe('📌');
    expect(badgeEl?.textContent).toBe('TAG');
    expect(toolsEl).not.toBeNull();
    expect(toolsEl?.getAttribute('data-naizo-strip')).toBe('true');
    expect(toolsEl?.hasAttribute('naizo-ignore')).toBe(false);
    expect(li.firstElementChild).toBe(prefixEl);
    expect(Naizo.getList('steps')).toEqual([{ label: 'Step One' }]);

    // Simulate user typing into self-bound <li> while .step-prefix, .step-badge, and .naizo-item-tools are mounted inside it
    const textNode = Array.from(li.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.nodeValue = 'Step One Edited';
    li.dispatchEvent(new Event('input', { bubbles: true }));
    expect(Naizo.getList('steps')).toEqual([{ label: 'Step One Edited' }]);

    // Programmatic updateItem updates text in place without detaching or reordering leading/trailing [naizo-ignore] or [data-naizo-strip] children
    Naizo.updateItem('steps', 0, { label: 'Step One Programmatic' });
    expect(li.querySelector('.step-prefix')).toBe(prefixEl);
    expect(li.querySelector('.step-badge')).toBe(badgeEl);
    expect(li.querySelector('.naizo-item-tools')).toBe(toolsEl);
    expect(li.childNodes[0]).toBe(prefixEl);
    expect(li.childNodes[1]?.nodeValue).toBe('Step One Programmatic');
    expect(li.childNodes[2]).toBe(badgeEl);
    expect(li.childNodes[3]).toBe(toolsEl);
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
    expect(portableHtml).toContain('https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js');
    expect(portableHtml).not.toContain(
      'https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js"',
    );
    expect(portableHtml).not.toContain('src="../dist/naizo.js"');
    expect(portableHtml).not.toContain('src="./dist/naizo.min.js"');
    expect(portableHtml).not.toContain('naizo-mode="online"');
    expect(portableHtml).toContain('value="Edited in Browser"');

    // Online Mode exportHTML() also produces portable HTML with minified CDN URL
    const onlineExport = Naizo.exportHTML();
    expect(onlineExport).toContain('https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js');
    expect(onlineExport).not.toContain(
      'https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js"',
    );
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
    const notesListenerCleanup = new AbortController();
    const origWindowAdd = window.addEventListener.bind(window);
    const notesAddSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation(
        (
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: boolean | AddEventListenerOptions,
        ) => {
          const mergedOpts: AddEventListenerOptions =
            typeof options === 'boolean'
              ? { capture: options, signal: notesListenerCleanup.signal }
              : { ...options, signal: notesListenerCleanup.signal };
          origWindowAdd(type, listener, mergedOpts);
        },
      );
    try {
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

      // 6. Exported HTML strips runtime-rendered sidebar #note-index-list items via data-naizo-strip (D47)
      const exportedNotesDoc = new DOMParser().parseFromString(Naizo.exportHTML(), 'text/html');
      expect(exportedNotesDoc.querySelectorAll('#note-index-list > *').length).toBe(0);
    } finally {
      notesListenerCleanup.abort();
      notesAddSpy.mockRestore();
      document.documentElement.removeAttribute('data-theme');
    }
  });

  it('validates M5 deliverables (docs/USAGE.md, skills/naizo/SKILL.md) and safe surgical #naizodb CLI replacement with $1/$& payloads', () => {
    const usagePath = resolve(process.cwd(), 'docs/USAGE.md');
    const skillPath = resolve(process.cwd(), 'skills/naizo/SKILL.md');
    const usageMd = readFileSync(usagePath, 'utf-8');
    const skillMd = readFileSync(skillPath, 'utf-8');

    // Verify skills/naizo/SKILL.md YAML frontmatter (description must be quoted so ` #naizodb` is not treated as a YAML comment)
    expect(skillMd.startsWith('---\n')).toBe(true);
    expect(skillMd).toContain('name: naizo\n');
    expect(skillMd).toContain('license: MIT\n');
    expect(skillMd).toContain("description: 'Build and update");
    expect(skillMd).toContain('gh skill install nickosh/naizo naizo');
    expect(skillMd).toContain('gh skill install nickosh/naizo naizo@main');
    expect(skillMd).toContain('npx skills add nickosh/naizo --skill naizo');
    expect(skillMd).toContain('npx skills add nickosh/naizo@main --skill naizo');
    expect(skillMd).toContain('curl -fsSL https://naizo.js.org/SKILL.md');
    expect(skillMd).toContain('https://cdn.jsdelivr.net/gh/nickosh/naizo@main/dist/naizo.js');

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
    expect(siteHtml).toContain('../examples/weather.html');
    expect(siteHtml).toContain('https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js');
    expect(siteHtml).toContain('https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js');
    expect(siteHtml).toContain('https://unpkg.com/naizojs@latest/dist/naizo.js');
    expect(siteHtml).toContain('prefers-color-scheme: dark');
    expect(siteHtml).toContain('prefers-reduced-motion: reduce');

    // 3. Execute site/index.html script and verify live #naizodb JSON inspector, theme toggle, AI edit simulation, and reset
    const appScript = siteDoc.body.querySelector('script')?.textContent || '';
    const siteListenerCleanup = new AbortController();
    const origWindowAdd = window.addEventListener.bind(window);
    const siteAddSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation(
        (
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: boolean | AddEventListenerOptions,
        ) => {
          const mergedOpts: AddEventListenerOptions =
            typeof options === 'boolean'
              ? { capture: options, signal: siteListenerCleanup.signal }
              : { ...options, signal: siteListenerCleanup.signal };
          origWindowAdd(type, listener, mergedOpts);
        },
      );
    try {
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
    } finally {
      siteListenerCleanup.abort();
      siteAddSpy.mockRestore();
      document.documentElement.removeAttribute('data-theme');
    }

    // 4. Verify M6.4 Cloudflare Web Analytics script and SEO JSON-LD with naizo-strip are present in hosted DOM,
    // stripped by Naizo.exportHTML() / Naizo.downloadHTML() (Save to PC), and absent from examples/*.html (D47)
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://naizo.js.org/',
    );
    expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      'https://naizo.js.org/',
    );
    const jsonLdScript = document.head.querySelector<HTMLScriptElement>(
      'script[type="application/ld+json"]',
    );
    expect(jsonLdScript).not.toBeNull();
    expect(jsonLdScript?.hasAttribute('naizo-strip')).toBe(true);
    expect(JSON.parse(jsonLdScript?.textContent ?? '{}')['@type']).toBe('SoftwareSourceCode');

    const beaconScript = document.head.querySelector<HTMLScriptElement>('script[data-cf-beacon]');
    expect(beaconScript).not.toBeNull();
    expect(beaconScript?.getAttribute('src')).toBe(
      'https://static.cloudflareinsights.com/beacon.min.js',
    );
    expect(beaconScript?.getAttribute('data-cf-beacon')).toBe(
      '{"token": "37a058a9b8c9479cafdc2e5ea888c5df"}',
    );
    expect(beaconScript?.hasAttribute('naizo-strip')).toBe(true);

    const exportedSiteHtml = Naizo.exportHTML();
    expect(exportedSiteHtml).not.toContain('static.cloudflareinsights.com');
    expect(exportedSiteHtml).not.toContain('data-cf-beacon');
    expect(exportedSiteHtml).not.toContain('37a058a9b8c9479cafdc2e5ea888c5df');
    expect(exportedSiteHtml).not.toContain('application/ld+json');

    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:site-url');
    const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const downloadedSiteHtml = Naizo.downloadHTML('naizo-site.html');
    createUrlSpy.mockRestore();
    revokeUrlSpy.mockRestore();
    clickSpy.mockRestore();
    expect(downloadedSiteHtml).not.toContain('static.cloudflareinsights.com');
    expect(downloadedSiteHtml).not.toContain('data-cf-beacon');
    expect(downloadedSiteHtml).not.toContain('37a058a9b8c9479cafdc2e5ea888c5df');
    expect(downloadedSiteHtml).toContain(
      'https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js',
    );
    expect(downloadedSiteHtml).not.toContain('src="../dist/naizo.js"');
    expect(downloadedSiteHtml).toContain('<symbol id="naizo-crest-icon" viewBox="0 0 100 100">');
    expect(downloadedSiteHtml).toContain('<use href="#naizo-crest-icon"');

    for (const exampleHtml of [starterHtml, checklistHtml, notesHtml, inventoryHtml, weatherHtml]) {
      expect(exampleHtml).not.toContain('cloudflareinsights');
      expect(exampleHtml).not.toContain('data-cf-beacon');
    }
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
    expect(llmsTxt).toContain('https://naizo.js.org/examples/weather.html');

    expect(llmsFullTxt.startsWith('# naizo.js')).toBe(true);
    expect(llmsFullTxt).toContain('<script id="naizodb" type="application/json">');
    expect(llmsFullTxt).toContain('(_m, open, _inner, close) => `${open}\\n${json}\\n${close}`');
    expect(llmsFullTxt).toContain('examples/starter.html');
    expect(llmsFullTxt).toContain('examples/notes.html');
    expect(llmsFullTxt).toContain('examples/weather.html');

    // 4. ci.yml enforces dist/naizo.js freshness, stages site/. with -RL (dereferencing symlinks) to _site/,
    // gates Pages deploy on release or workflow_dispatch (D48), and supports pages_source: 'main' | 'latest-release' (M7.12, D49)
    expect(ciYml).toContain('pages_source:');
    expect(ciYml).toContain("default: 'main'");
    expect(ciYml).toContain('type: choice');
    expect(ciYml).toContain('- main\n');
    expect(ciYml).toContain('- latest-release\n');
    expect(ciYml).toContain("'ci-refs/heads/main-pages'");
    expect(ciYml).toContain("format('ci-{0}-verify', github.ref)");
    expect(ciYml).toContain(
      "fetch-depth: ${{ (github.event_name == 'workflow_dispatch' && inputs.pages_source == 'latest-release') && '0' || '1' }}",
    );
    expect(ciYml).toContain(
      "if: github.event_name == 'workflow_dispatch' && inputs.pages_source == 'latest-release'",
    );
    expect(ciYml).toContain('RELEASE_TAG=$(vp node scripts/release.ts latest-tag)');
    expect(ciYml).toContain('git merge-base --is-ancestor "$COMMIT" origin/main');
    expect(ciYml).toContain('git checkout --detach "$COMMIT"');
    expect(ciYml).toContain('vp node scripts/release.ts version "$RELEASE_TAG"');
    expect(ciYml).toContain('GITHUB_STEP_SUMMARY');
    expect(ciYml).toContain(
      "if: github.event_name != 'workflow_dispatch' || inputs.pages_source != 'latest-release'",
    );
    expect(ciYml).toContain('git diff --exit-code dist/naizo.js');
    expect(ciYml).toContain('cp -RL site/. _site/');
    expect(ciYml).toContain('cp -R examples _site/');
    expect(ciYml).toContain(
      "sed -e 's#\\.\\./dist/#./dist/#g' -e 's#\\.\\./examples/#./examples/#g' site/index.html > _site/index.html",
    );
    expect(ciYml).toContain("contains(github.event.head_commit.message, 'chore(main): release ')");

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
    expect(stagedIndexHtml).toContain('./examples/weather.html');
    expect(stagedIndexHtml).toContain('./llms.txt');
    expect(stagedIndexHtml).toContain('./llms-full.txt');
    expect(stagedIndexHtml).toContain('./SKILL.md');
    expect(stagedIndexHtml).toContain('./logo.png');
    expect(stagedIndexHtml).toContain('./logo.svg');
    expect(stagedIndexHtml).toContain('./logo-dark.svg');

    // Execute real _site/ staging copy (cp -RL site/. <stagedDir>/) to confirm logo.svg, logo-dark.svg,
    // binary logo.png, and dereferenced SKILL.md stage cleanly (M6.2, M11.2)
    const stagedDir = mkdtempSync(join(tmpdir(), 'naizo-site-stage-'));
    try {
      const siteSrcDir = resolve(process.cwd(), 'site');
      if (process.platform === 'win32') {
        cpSync(siteSrcDir, stagedDir, { recursive: true, dereference: true });
      } else {
        execFileSync('cp', ['-RL', `${siteSrcDir}/.`, `${stagedDir}/`]);
      }
      expect(existsSync(join(stagedDir, 'logo.svg'))).toBe(true);
      expect(existsSync(join(stagedDir, 'logo-dark.svg'))).toBe(true);
      expect(existsSync(join(stagedDir, 'logo.png'))).toBe(true);
      expect(
        readFileSync(join(stagedDir, 'logo.png')).equals(
          readFileSync(join(siteSrcDir, 'logo.png')),
        ),
      ).toBe(true);
      expect(lstatSync(join(stagedDir, 'SKILL.md')).isFile()).toBe(true);
      expect(lstatSync(join(stagedDir, 'SKILL.md')).isSymbolicLink()).toBe(false);
    } finally {
      rmSync(stagedDir, { recursive: true, force: true });
    }
  });

  it('replaces, clears, and validates lists via Naizo.setList() while preserving pass-through keys (M8.1)', async () => {
    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": {},
        "lists": {
          "issues": [
            { "id": 1, "title": "Original issue" }
          ]
        },
        "custom": {}
      }
      </script>
    `;
    document.body.innerHTML = `
      <ul naizo-list="issues">
        <li naizo-item naizo="title">Placeholder</li>
      </ul>
    `;

    await initNaizo();
    expect(document.querySelectorAll('[naizo-list="issues"] > [naizo-item]').length).toBe(1);

    const events: Array<Record<string, unknown>> = [];
    const onChange = (e: Event) => {
      events.push((e as CustomEvent).detail as Record<string, unknown>);
    };
    window.addEventListener('naizo:change', onChange);

    // Reject invalid payloads without mutating existing list
    Naizo.setList('issues', 'not-an-array' as unknown as Array<Record<string, unknown>>);
    Naizo.setList('issues', ['not-an-object'] as unknown as Array<Record<string, unknown>>);
    Naizo.setList('issues', [{ bad: Number.NaN }]);
    expect(Naizo.getList('issues')).toEqual([{ id: 1, title: 'Original issue' }]);
    expect(events.length).toBe(0);

    // Replace entire list with pass-through keys
    Naizo.setList('issues', [
      { id: 101, title: 'Ship setList()', html_url: 'https://example.com/101' },
      { id: 102, title: 'Wire #net globe', priority: 'high' },
    ]);

    const rendered = document.querySelectorAll<HTMLElement>('[naizo-list="issues"] > [naizo-item]');
    expect(rendered.length).toBe(2);
    expect(rendered[0]?.textContent).toContain('Ship setList()');
    expect(rendered[1]?.textContent).toContain('Wire #net globe');
    expect(readScriptDb().lists.issues).toEqual([
      { id: 101, title: 'Ship setList()', html_url: 'https://example.com/101' },
      { id: 102, title: 'Wire #net globe', priority: 'high' },
    ]);
    expect(events[0]?.scope).toBe('lists');
    expect(events[0]?.action).toBe('set');
    expect(events[0]?.list).toBe('issues');

    // Clear list cleanly and verify auto-inferred template still allows subsequent additions
    Naizo.setList('issues', []);
    expect(document.querySelectorAll('[naizo-list="issues"] > [naizo-item]').length).toBe(0);
    expect(readScriptDb().lists.issues).toEqual([]);

    Naizo.addItem('issues', { id: 103, title: 'Added after clear' });
    expect(document.querySelectorAll('[naizo-list="issues"] > [naizo-item]').length).toBe(1);
    expect(readScriptDb().lists.issues).toEqual([{ id: 103, title: 'Added after clear' }]);

    window.removeEventListener('naizo:change', onChange);
  });

  it('routes naizo-get / naizo-post, naizo-path (Object.hasOwn), naizo-into (XSS-safe), and naizo-body with CORS-safelisted POST (M8.1, EC50)', async () => {
    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": { "project": "naizo" },
        "lists": { "tasks": [{ "title": "Initial" }] },
        "custom": { "tokenCount": 3 }
      }
      </script>
    `;
    document.body.innerHTML = `
      <input id="proj-input" type="text" naizo="project">
      <div id="xss-box">Safe</div>
      <ul naizo-list="tasks">
        <li naizo-item naizo="title">Seed</li>
      </ul>
      <button id="get-field" type="button" naizo-get="https://api.example.com/meta" naizo-path="nested.items.0.label" naizo-into="field:project">Fetch Field</button>
      <button id="get-list" type="button" data-naizo-get="https://api.example.com/tasks" data-naizo-path="payload.rows" data-naizo-into="list:tasks">Fetch List</button>
      <button id="get-xss" type="button" naizo-get="https://api.example.com/xss" naizo-into="#xss-box">Fetch Preview</button>
      <button id="get-full-db" type="button" naizo-get="https://api.example.com/full-db">Hydrate DB</button>
      <button id="post-webhook" type="button" naizo-post="https://hooks.example.com/notify" naizo-body="fields">Send Fields</button>
    `;

    await initNaizo();

    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      fetchCalls.push({ url, init });
      if (url === 'https://api.example.com/meta') {
        return new Response(
          JSON.stringify({ nested: { items: [{ label: 'Updated from API' }] } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url === 'https://api.example.com/tasks') {
        // GitHub raw-style text/plain JSON response
        return new Response(
          JSON.stringify({
            payload: {
              rows: [
                { id: 't1', title: 'Fetched Task A' },
                { id: 't2', title: 'Fetched Task B' },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
        );
      }
      if (url === 'https://api.example.com/xss') {
        return new Response('<img src=x onerror="window.__xss=true"><b>Literal</b>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      }
      if (url === 'https://hooks.example.com/notify') {
        // Webhook acknowledgement with a "fields" property must NOT overwrite store in fire-and-forget POST mode
        return new Response(JSON.stringify({ id: 'rec_1', fields: { wiped: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === 'https://api.example.com/full-db') {
        return new Response(
          JSON.stringify({
            _meta: { source: 'remote' },
            fields: { project: 'Full Hydrate' },
            lists: { tasks: [{ title: 'Remote Row' }] },
            custom: { synced: true },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const fetchEvents: Array<Record<string, unknown>> = [];
      const onFetch = (e: Event) => {
        fetchEvents.push((e as CustomEvent).detail as Record<string, unknown>);
      };
      window.addEventListener('naizo:fetch', onFetch);

      // 1. Field target with dot-path extraction
      document.getElementById('get-field')?.click();
      await vi.waitFor(() => expect(Naizo.getField('project')).toBe('Updated from API'));
      expect((document.getElementById('proj-input') as HTMLInputElement).value).toBe(
        'Updated from API',
      );

      // 2. List target with data-naizo-* aliases
      document.getElementById('get-list')?.click();
      await vi.waitFor(() => expect(Naizo.getList('tasks').length).toBe(2));
      expect(readScriptDb().lists.tasks).toEqual([
        { id: 't1', title: 'Fetched Task A' },
        { id: 't2', title: 'Fetched Task B' },
      ]);

      // 3. Selector target uses textContent, never innerHTML (XSS guard)
      document.getElementById('get-xss')?.click();
      await vi.waitFor(() =>
        expect(document.getElementById('xss-box')?.textContent).toBe(
          '<img src=x onerror="window.__xss=true"><b>Literal</b>',
        ),
      );
      expect(document.querySelector('#xss-box img')).toBeNull();

      // 4. Prototype traversal via naizo-path is rejected without mutating store
      const protoRes = await Naizo.fetch('https://api.example.com/meta', {
        path: 'nested.constructor.name',
        into: 'field:project',
      });
      expect(protoRes.ok).toBe(false);
      expect(Naizo.getField('project')).toBe('Updated from API');

      // 5. Pending debounced input is flushed before POST, sent as text/plain;charset=UTF-8 with unescaped '<' over HTTP while #naizodb keeps \u003c, and fire-and-forget POST preserves store
      const projInput = document.getElementById('proj-input') as HTMLInputElement;
      projInput.value = 'Edited <Before> POST';
      projInput.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('post-webhook')?.click();
      await vi.waitFor(() =>
        expect(fetchCalls.some((c) => c.url === 'https://hooks.example.com/notify')).toBe(true),
      );
      const postCall = fetchCalls.find((c) => c.url === 'https://hooks.example.com/notify');
      expect(postCall?.init?.method).toBe('POST');
      const postHeaders = (postCall?.init?.headers ?? {}) as Record<string, string>;
      expect(postHeaders['Content-Type']).toBe('text/plain;charset=UTF-8');
      const rawPostBody = typeof postCall?.init?.body === 'string' ? postCall.init.body : '{}';
      expect(rawPostBody).toContain('Edited <Before> POST');
      expect(rawPostBody).not.toContain('\\u003c');
      expect(document.getElementById('naizodb')?.textContent ?? '').toContain('\\u003cBefore>');
      expect(JSON.parse(rawPostBody)).toEqual({ project: 'Edited <Before> POST' });
      expect(Naizo.getList('tasks').length).toBe(2);
      expect(Naizo.get('tokenCount')).toBe(3);

      // 6. Programmatic Naizo.fetch() literal string body, non-GET fire-and-forget (204 DELETE), bound #selector warning (D51), !res.ok guard, and full #naizodb hydration
      const badStatus = await Naizo.fetch('https://api.example.com/missing', {
        into: 'field:project',
      });
      expect(badStatus.ok).toBe(false);
      expect(badStatus.status).toBe(404);
      expect(Naizo.getField('project')).toBe('Edited <Before> POST');

      const rawStringPost = await Naizo.fetch('https://hooks.example.com/notify', {
        method: 'POST',
        body: 'field: literal <note>',
      });
      expect(rawStringPost.ok).toBe(true);
      const literalCall = fetchCalls[fetchCalls.length - 1];
      expect(literalCall?.init?.body).toBe('field: literal <note>');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const previewRes = await Naizo.fetch('https://api.example.com/xss', {
          into: '#proj-input',
        });
        expect(previewRes.ok).toBe(true);
        expect(projInput.value).toBe('<img src=x onerror="window.__xss=true"><b>Literal</b>');
        expect(Naizo.getField('project')).toBe('Edited <Before> POST');
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Use naizo-into="field:project" to persist.'),
        );
      } finally {
        warnSpy.mockRestore();
      }

      // Programmatic Naizo.fetch() without options.into returns parsed data without mutating store (D52);
      // declarative naizo-get without naizo-into and programmatic { into: 'db' } both hydrate #naizodb
      const rawExternalJson = await Naizo.fetch('https://api.example.com/meta');
      expect(rawExternalJson.ok).toBe(true);
      expect(rawExternalJson.target).toBeNull();
      expect(rawExternalJson.data).toEqual({ nested: { items: [{ label: 'Updated from API' }] } });

      const rawFetchOnly = await Naizo.fetch('https://api.example.com/full-db');
      expect(rawFetchOnly.ok).toBe(true);
      expect(rawFetchOnly.target).toBeNull();
      expect(Naizo.getField('project')).toBe('Edited <Before> POST');

      document.getElementById('get-full-db')?.click();
      await vi.waitFor(() => expect(Naizo.getField('project')).toBe('Full Hydrate'));
      expect(Naizo.getList('tasks')).toEqual([{ title: 'Remote Row' }]);
      expect(Naizo.get('synced')).toBe(true);

      Naizo.setField('project', 'Reset Before Programmatic DB');
      const fullHydrate = await Naizo.fetch('https://api.example.com/full-db', { into: 'db' });
      expect(fullHydrate.ok).toBe(true);
      expect(Naizo.getField('project')).toBe('Full Hydrate');
      expect(fetchEvents.length).toBeGreaterThanOrEqual(9);

      window.removeEventListener('naizo:fetch', onFetch);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps non-GET Naizo.fetch() without into non-mutating on 204/ack responses and runs list item controls before ancestor API attributes (M8.1, D51)', async () => {
    document.head.innerHTML = `
      <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": { "status": "keep" },
        "lists": { "rows": [{ "title": "Row A" }, { "title": "Row B" }] },
        "custom": {}
      }
      </script>
    `;
    document.body.innerHTML = `
      <ul naizo-list="rows">
        <li naizo-item naizo-post="https://hooks.example.com/row-click">
          <span naizo="title">Seed</span>
        </li>
      </ul>
    `;

    await initNaizo();

    const calledUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      calledUrls.push(url);
      if (url === 'https://api.example.com/items/1') {
        return new Response(null, {
          status: 204,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: true, fields: { clobbered: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const delRes = await Naizo.fetch('https://api.example.com/items/1', { method: 'DELETE' });
      expect(delRes.ok).toBe(true);
      expect(delRes.status).toBe(204);
      expect(delRes.data).toBeNull();
      expect(Naizo.getField('status')).toBe('keep');

      const putRes = await Naizo.fetch('https://api.example.com/items/2', {
        method: 'PUT',
        body: { updated: true },
      });
      expect(putRes.ok).toBe(true);
      expect(Naizo.getField('status')).toBe('keep');

      calledUrls.length = 0;
      const removeBtn = document.querySelector<HTMLButtonElement>(
        '[naizo-list="rows"] [naizo-item] [naizo-remove]',
      );
      expect(removeBtn).not.toBeNull();
      removeBtn?.click();
      expect(Naizo.getList('rows')).toEqual([{ title: 'Row B' }]);
      expect(calledUrls).toEqual([]);

      const remainingItem = document.querySelector<HTMLElement>('[naizo-list="rows"] [naizo-item]');
      remainingItem?.click();
      await vi.waitFor(() => expect(calledUrls).toEqual(['https://hooks.example.com/row-click']));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('enforces naizo-trigger="init|load|click", [naizo-ignore] exclusion, mid-flight export stripping, and rightmost #net wired-globe states (M8.1, D50, EC36, EC50)', async () => {
    vi.useFakeTimers();
    const slowResolvers: Array<(res: Response) => void> = [];
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === 'https://api.example.com/seed') {
        return Promise.resolve(
          new Response(JSON.stringify([{ title: 'Seeded Once' }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      if (url === 'https://api.example.com/live') {
        return Promise.resolve(
          new Response(JSON.stringify('Live Tick'), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      if (url === 'https://api.example.com/slow') {
        return new Promise<Response>((resolve) => {
          slowResolvers.push(resolve);
        });
      }
      return Promise.resolve(new Response('Server Error', { status: 500 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      // Page with only [naizo-ignore] API attributes keeps #net hidden
      document.head.innerHTML = `<script id="naizodb" type="application/json">{"_meta":{},"fields":{},"lists":{},"custom":{}}</script>`;
      document.body.innerHTML = `
        <div naizo-ignore>
          <button id="ignored-btn" naizo-get="https://api.example.com/live" naizo-trigger="load">Ignored</button>
        </div>
      `;
      await initNaizo();
      const shadow1 = document.getElementById('__naizodb_host__')?.shadowRoot;
      const net1 = shadow1?.getElementById('net') as HTMLButtonElement | null;
      expect(net1?.style.display).toBe('none');
      expect(fetchMock).not.toHaveBeenCalled();
      document.getElementById('ignored-btn')?.click();
      expect(fetchMock).not.toHaveBeenCalled();

      // Page with active init, load, and click triggers reveals #net at rightmost end of pill
      localStorage.clear();
      document.head.innerHTML = `<script id="naizodb" type="application/json">{"_meta":{},"fields":{},"lists":{},"custom":{}}</script>`;
      document.body.innerHTML = `
        <span naizo="live_feed"></span>
        <ul naizo-list="seeds"><template><li naizo-item naizo="title"></li></template></ul>
        <div naizo-get="https://api.example.com/seed" naizo-into="list:seeds" naizo-trigger="init"></div>
        <div naizo-get="https://api.example.com/live" naizo-into="field:live_feed" naizo-trigger="load"></div>
        <button id="slow-btn" type="button" naizo-get="https://api.example.com/slow" naizo-into="field:live_feed">Slow</button>
        <button id="preset-disabled" type="button" disabled>Static Disabled</button>
      `;

      await initNaizo();
      for (let i = 0; i < 6; i += 1) {
        await Promise.resolve();
      }

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(Naizo.getList('seeds')).toEqual([{ title: 'Seeded Once' }]);
      expect(Naizo.getField('live_feed')).toBe('Live Tick');

      const shadow2 = document.getElementById('__naizodb_host__')?.shadowRoot;
      const pill = shadow2?.querySelector('.pill');
      const netBtn = shadow2?.getElementById('net') as HTMLButtonElement;
      const statusSpan = shadow2?.getElementById('status');
      const dotSpan = shadow2?.getElementById('dot');

      expect(pill?.lastElementChild?.id).toBe('net');
      expect(netBtn.style.display).toBe('inline-flex');
      expect(netBtn.querySelector('#naizo-net-wave-clip')).not.toBeNull();
      expect(netBtn.querySelector('.globe-lit')).not.toBeNull();
      expect(shadow2?.querySelector('style')?.textContent ?? '').toContain(
        'prefers-reduced-motion: reduce',
      );

      // Fast 2xx completion holds #net active for >= 600ms before returning to idle
      expect(netBtn.classList.contains('active')).toBe(true);
      expect(netBtn.title).toBe('API active');
      vi.advanceTimersByTime(599);
      expect(netBtn.classList.contains('active')).toBe(true);
      vi.advanceTimersByTime(5);
      expect(netBtn.classList.contains('idle')).toBe(true);
      expect(netBtn.title).toBe('API idle');

      // Simulated reload (F5): "init" skips because list:seeds is now non-empty; "load" runs again
      fetchMock.mockClear();
      await initNaizo();
      for (let i = 0; i < 6; i += 1) {
        await Promise.resolve();
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.com/live');

      vi.advanceTimersByTime(650);

      // Mid-flight click sets data-naizo-loading & disabled, and Naizo.exportHTML() strips them cleanly
      const slowBtn = document.getElementById('slow-btn') as HTMLButtonElement;
      slowBtn.click();
      expect(slowBtn.getAttribute('data-naizo-loading')).toBe('true');
      expect(slowBtn.disabled).toBe(true);

      const midFlightExport = new DOMParser().parseFromString(Naizo.exportHTML(), 'text/html');
      const exportedSlowBtn = midFlightExport.getElementById('slow-btn');
      const exportedStaticDisabled = midFlightExport.getElementById('preset-disabled');
      expect(exportedSlowBtn?.hasAttribute('data-naizo-loading')).toBe(false);
      expect(exportedSlowBtn?.hasAttribute('data-naizo-loading-disabled')).toBe(false);
      expect(exportedSlowBtn?.hasAttribute('disabled')).toBe(false);
      expect(exportedStaticDisabled?.hasAttribute('disabled')).toBe(true);

      slowResolvers[0]?.(
        new Response(JSON.stringify('Slow Done'), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      for (let i = 0; i < 6; i += 1) {
        await Promise.resolve();
      }
      expect(slowBtn.disabled).toBe(false);
      expect(slowBtn.hasAttribute('data-naizo-loading')).toBe(false);
      vi.advanceTimersByTime(650);

      // Failed request turns #net red without altering #dot or #status (EC36), persists across subsequent successful requests, and clears on click
      const shadow3 = document.getElementById('__naizodb_host__')?.shadowRoot;
      const net3 = shadow3?.getElementById('net') as HTMLButtonElement;
      const statusBefore =
        statusSpan?.textContent ?? shadow3?.getElementById('status')?.textContent;
      const dotClassBefore = dotSpan?.className ?? shadow3?.getElementById('dot')?.className;

      const errRes = await Naizo.fetch('https://api.example.com/fail', {
        into: 'field:live_feed',
      });
      expect(errRes.ok).toBe(false);
      expect(net3.classList.contains('error')).toBe(true);
      expect(net3.title).toBe('API request failed');
      expect(shadow3?.getElementById('status')?.textContent).toBe(statusBefore);
      expect(shadow3?.getElementById('dot')?.className).toBe(dotClassBefore);
      expect(Naizo.getField('live_feed')).toBe('Slow Done');

      // Subsequent successful request updates data normally but keeps #net red until user clicks #net
      const okAfterErr = await Naizo.fetch('https://api.example.com/live', {
        into: 'field:live_feed',
      });
      expect(okAfterErr.ok).toBe(true);
      expect(Naizo.getField('live_feed')).toBe('Live Tick');
      expect(net3.classList.contains('error')).toBe(true);
      vi.advanceTimersByTime(650);
      expect(net3.classList.contains('error')).toBe(true);
      expect(net3.title).toBe('API request failed');

      net3.click();
      expect(net3.classList.contains('idle')).toBe(true);
      expect(net3.title).toBe('API idle');
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('executes the shipped dist/naizo.js IIFE bundle across Local Mode and Online Mode for Mini-API Client, Naizo.setList, and #net globe parity (M8.2, EC50)', async () => {
    vi.useFakeTimers();
    const postedPayloads: Array<{ url: string; init?: RequestInit }> = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (init?.method === 'POST') {
        postedPayloads.push({ url, init });
      }
      if (url === 'https://api.example.com/seed-issues') {
        return new Response(JSON.stringify([{ id: 10, title: 'Seeded Issue' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === 'https://api.example.com/live-tag') {
        return new Response(JSON.stringify('v0.2.0'), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === 'https://api.example.com/stats') {
        return new Response(JSON.stringify({ nested: { items: [{ count: 42 }] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === 'https://api.example.com/xss-preview') {
        return new Response('<script>window.__bundleXss=1</script><b>RawText</b>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      }
      if (url === 'https://api.example.com/full-bundle-db') {
        return new Response(
          JSON.stringify({
            _meta: { origin: 'api' },
            fields: { release_tag: 'v1.0.0' },
            lists: { issues: [{ id: 99, title: 'Full DB Issue' }] },
            custom: { issueCount: 99 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url === 'https://hooks.example.com/sync') {
        return new Response(JSON.stringify({ received: true, fields: { ignored: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === 'https://hooks.example.com/blind') {
        const opaqueRes = new Response(null, { status: 200 });
        Object.defineProperty(opaqueRes, 'type', { value: 'opaque' });
        Object.defineProperty(opaqueRes, 'status', { value: 0 });
        Object.defineProperty(opaqueRes, 'ok', { value: false });
        return opaqueRes;
      }
      if (url === './preset.json') {
        return new Response(
          JSON.stringify({ presets: [{ id: 'p-1', name: 'Online Preset', passThrough: true }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url === 'https://api.example.com/network-blocked') {
        throw new TypeError('Failed to fetch');
      }
      return new Response(JSON.stringify({ error: 'Unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const flushMicrotasks = async (ticks = 8): Promise<void> => {
      for (let i = 0; i < ticks; i += 1) {
        await Promise.resolve();
      }
    };

    document.documentElement.setAttribute('data-naizo-manual', '');
    runInThisContext(iifeBundleCode);
    const bundleNaizo = window.Naizo;

    try {
      expect(bundleNaizo).toBeDefined();
      expect(bundleNaizo).not.toBe(Naizo);

      // --- Part 1: Local Mode with linked FileSystemFileHandle ---
      const initialLocalJson = JSON.stringify(
        {
          _meta: {},
          fields: { release_tag: '' },
          lists: { issues: [] },
          custom: {},
        },
        null,
        2,
      );
      let diskHtml = `<!doctype html><html><head><script id="naizodb" type="application/json">\n${initialLocalJson}\n</script></head><body class="local-shell"></body></html>`;
      let diskMtime = 1000;

      window.showSaveFilePicker = vi.fn().mockResolvedValue({
        queryPermission: vi.fn().mockResolvedValue('granted'),
        requestPermission: vi.fn().mockResolvedValue('granted'),
        getFile: vi.fn().mockImplementation(async () => ({
          lastModified: diskMtime,
          arrayBuffer: async () => new TextEncoder().encode(diskHtml).buffer,
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

      document.head.innerHTML = `<script id="naizodb" type="application/json">\n${initialLocalJson}\n</script>`;
      document.body.innerHTML = `
        <input id="tag-input" type="text" naizo="release_tag" value="">
        <div id="preview-box">Initial</div>
        <ul naizo-list="issues">
          <template naizo-template><li naizo-item naizo="title"></li></template>
        </ul>
        <div naizo-get="https://api.example.com/seed-issues" naizo-into="list:issues" naizo-trigger="init"></div>
        <div naizo-get="https://api.example.com/live-tag" naizo-into="field:release_tag" naizo-trigger="load"></div>
        <button id="btn-stats" type="button" data-naizo-get="https://api.example.com/stats" data-naizo-path="nested.items.0.count" data-naizo-into="custom:issueCount">Stats</button>
        <button id="btn-xss" type="button" naizo-get="https://api.example.com/xss-preview" naizo-into="#preview-box">Preview</button>
        <button id="btn-post" type="button" naizo-post="https://hooks.example.com/sync" naizo-body="list:issues">Sync Webhook</button>
        <button id="btn-blind" type="button" naizo-post="https://hooks.example.com/blind" naizo-cors="no-cors">Blind Webhook</button>
      `;

      await bundleNaizo.init();
      await flushMicrotasks();

      const shadowLocal = document.getElementById('__naizodb_host__')?.shadowRoot;
      const netLocal = shadowLocal?.getElementById('net') as HTMLButtonElement;
      expect(shadowLocal?.querySelector('.pill')?.lastElementChild?.id).toBe('net');
      expect(netLocal.style.display).toBe('inline-flex');
      expect(netLocal.querySelector('#naizo-net-wave-clip')).not.toBeNull();
      expect(netLocal.classList.contains('active')).toBe(true);
      expect(netLocal.title).toBe('API active');

      // Hold >= 600 ms before returning to idle
      vi.advanceTimersByTime(599);
      expect(netLocal.classList.contains('active')).toBe(true);
      vi.advanceTimersByTime(5);
      expect(netLocal.classList.contains('idle')).toBe(true);
      expect(netLocal.title).toBe('API idle');

      expect(bundleNaizo.getList('issues')).toEqual([{ id: 10, title: 'Seeded Issue' }]);
      expect(bundleNaizo.getField('release_tag')).toBe('v0.2.0');

      // Link local file on disk first (diskHtml matches initial boot #naizodb baseline, so seeded state writes cleanly to disk)
      const shadowLinked = document.getElementById('__naizodb_host__')?.shadowRoot;
      (shadowLinked?.getElementById('action') as HTMLButtonElement | null)?.click();
      await flushMicrotasks(12);
      expect(shadowLinked?.getElementById('status')?.textContent).toBe('Synced to Disk');
      expect(diskHtml).toContain('"Seeded Issue"');

      // Naizo.setList() in shipped bundle replaces list, preserves pass-through keys, and surgically updates diskHtml
      bundleNaizo.setList('issues', [{ id: 11, title: 'Bundle Issue <A>', repo: 'nickosh/naizo' }]);
      vi.advanceTimersByTime(300);
      await flushMicrotasks(12);
      expect(document.querySelector('[naizo-list="issues"] > [naizo-item]')?.textContent).toContain(
        'Bundle Issue <A>',
      );
      expect(diskHtml).toContain('\\u003cA>');

      // Reload check (reading #naizodb from diskHtml): "init" skips non-empty list:issues while "load" runs again
      const reloadDoc = new DOMParser().parseFromString(diskHtml, 'text/html');
      document.head.innerHTML = reloadDoc.head.innerHTML;
      fetchMock.mockClear();
      await bundleNaizo.init();
      await flushMicrotasks();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(bundleNaizo.getList('issues')).toEqual([
        { id: 11, title: 'Bundle Issue <A>', repo: 'nickosh/naizo' },
      ]);
      vi.advanceTimersByTime(650);

      // Re-confirm disk link after simulated reload
      const shadowAfterReload = document.getElementById('__naizodb_host__')?.shadowRoot;
      (shadowAfterReload?.getElementById('action') as HTMLButtonElement | null)?.click();
      await flushMicrotasks(12);
      expect(shadowAfterReload?.getElementById('status')?.textContent).toBe('Synced to Disk');

      // Declarative custom:, #selector XSS guard, CORS-safelisted POST, and no-cors opaque webhook
      document.getElementById('btn-stats')?.click();
      await flushMicrotasks();
      vi.advanceTimersByTime(300);
      await flushMicrotasks(12);

      expect(bundleNaizo.get('issueCount')).toBe(42);
      expect(diskHtml).toContain('"issueCount": 42');
      expect(diskHtml).toContain('<body class="local-shell"></body>');

      document.getElementById('btn-xss')?.click();
      await flushMicrotasks();
      expect(document.getElementById('preview-box')?.textContent).toBe(
        '<script>window.__bundleXss=1</script><b>RawText</b>',
      );
      expect(document.querySelector('#preview-box script')).toBeNull();

      document.getElementById('btn-post')?.click();
      await flushMicrotasks();
      const syncCall = postedPayloads.find((p) => p.url === 'https://hooks.example.com/sync');
      const syncHeaders = (syncCall?.init?.headers ?? {}) as Record<string, string>;
      expect(syncHeaders['Content-Type']).toBe('text/plain;charset=UTF-8');
      const syncBody = typeof syncCall?.init?.body === 'string' ? syncCall.init.body : '[]';
      expect(syncBody).toContain('Bundle Issue <A>');
      expect(syncBody).not.toContain('\\u003c');

      document.getElementById('btn-blind')?.click();
      await flushMicrotasks();
      const blindCall = postedPayloads.find((p) => p.url === 'https://hooks.example.com/blind');
      expect(blindCall?.init?.mode).toBe('no-cors');

      // Full DB hydration via shipped bundle with explicit into: 'db'
      const fullRes = await bundleNaizo.fetch('https://api.example.com/full-bundle-db', {
        into: 'db',
      });
      vi.advanceTimersByTime(300);
      await flushMicrotasks(12);
      expect(fullRes.ok).toBe(true);
      expect(bundleNaizo.getField('release_tag')).toBe('v1.0.0');
      expect(diskHtml).toContain('"Full DB Issue"');

      // Prototype traversal, !res.ok (503), and file:// CORS network error leave Local Mode store & disk untouched
      const protoFail = await bundleNaizo.fetch('https://api.example.com/stats', {
        path: 'nested.__proto__.polluted',
        into: 'custom:issueCount',
      });
      expect(protoFail.ok).toBe(false);

      const httpFail = await bundleNaizo.fetch('https://api.example.com/down', {
        into: 'field:release_tag',
      });
      expect(httpFail.ok).toBe(false);
      expect(httpFail.status).toBe(503);

      const netFail = await bundleNaizo.fetch('https://api.example.com/network-blocked', {
        into: 'list:issues',
      });
      expect(netFail.ok).toBe(false);
      expect(bundleNaizo.getField('release_tag')).toBe('v1.0.0');
      expect(bundleNaizo.getList('issues')).toEqual([{ id: 99, title: 'Full DB Issue' }]);
      expect(shadowAfterReload?.getElementById('status')?.textContent).toBe('Synced to Disk');
      expect(shadowAfterReload?.getElementById('dot')?.className).toBe('dot saved');

      const netAfterErr = shadowAfterReload?.getElementById('net') as HTMLButtonElement;
      expect(netAfterErr.classList.contains('error')).toBe(true);
      expect(netAfterErr.title).toBe('API request failed');

      // Subsequent successful request in shipped bundle does not overwrite #net error state
      const okAfterBundleErr = await bundleNaizo.fetch('https://api.example.com/stats', {
        path: 'nested.items.0.count',
        into: 'custom:issueCount',
      });
      expect(okAfterBundleErr.ok).toBe(true);
      vi.advanceTimersByTime(650);
      await flushMicrotasks(12);
      expect(netAfterErr.classList.contains('error')).toBe(true);
      expect(netAfterErr.title).toBe('API request failed');

      netAfterErr.click();
      expect(netAfterErr.classList.contains('idle')).toBe(true);

      await bundleNaizo.unlink();

      // --- Part 2: Online Mode with relative .json fetch + Save to PC + non-destructive errors ---
      localStorage.clear();
      document.documentElement.setAttribute('naizo-mode', 'online');
      document.head.innerHTML = `
        <script id="naizodb" type="application/json">{"_meta":{},"fields":{},"lists":{"presets":[]},"custom":{}}</script>
        <script src="../dist/naizo.js" defer></script>
      `;
      document.body.innerHTML = `
        <ul naizo-list="presets">
          <template naizo-template><li naizo-item naizo="name"></li></template>
        </ul>
        <button id="btn-online-preset" type="button" naizo-get="./preset.json" naizo-path="presets" naizo-into="list:presets">Load Presets</button>
      `;

      await bundleNaizo.init();
      const shadowOnline = document.getElementById('__naizodb_host__')?.shadowRoot;
      expect(shadowOnline?.getElementById('status')?.textContent).toBe('Saved in Browser');
      expect((shadowOnline?.getElementById('reset') as HTMLButtonElement)?.style.display).toBe(
        'none',
      );

      document.getElementById('btn-online-preset')?.click();
      await flushMicrotasks();
      vi.advanceTimersByTime(650);

      expect(bundleNaizo.getList('presets')).toEqual([
        { id: 'p-1', name: 'Online Preset', passThrough: true },
      ]);
      expect((shadowOnline?.getElementById('reset') as HTMLButtonElement)?.style.display).not.toBe(
        'none',
      );
      expect(shadowOnline?.getElementById('status')?.textContent).toBe('Saved in Browser');

      // !res.ok and network/PNA errors in Online Mode preserve store & Saved in Browser status
      const online503 = await bundleNaizo.fetch('https://api.example.com/down', {
        into: 'list:presets',
      });
      const onlineNetErr = await bundleNaizo.fetch('https://api.example.com/network-blocked', {
        into: 'list:presets',
      });
      expect(online503.ok).toBe(false);
      expect(onlineNetErr.ok).toBe(false);
      expect(bundleNaizo.getList('presets')).toEqual([
        { id: 'p-1', name: 'Online Preset', passThrough: true },
      ]);
      expect(shadowOnline?.getElementById('status')?.textContent).toBe('Saved in Browser');
      expect(shadowOnline?.getElementById('dot')?.className).toBe('dot saved');
      expect(shadowOnline?.getElementById('net')?.classList.contains('error')).toBe(true);

      const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:online-preset');
      const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const anchorClickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});
      const portableOnlineHtml = bundleNaizo.downloadHTML('online-fetched.html');
      createUrlSpy.mockRestore();
      revokeUrlSpy.mockRestore();
      anchorClickSpy.mockRestore();

      expect(portableOnlineHtml).toContain('"Online Preset"');
      expect(portableOnlineHtml).toContain('"passThrough": true');
      expect(portableOnlineHtml).toContain(
        'https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js',
      );
      expect(portableOnlineHtml).not.toContain('naizo-mode="online"');
      expect(shadowOnline?.getElementById('status')?.textContent).toBe(
        'Saved to PC · Ready for Local Mode',
      );
    } finally {
      window.__naizoCleanup?.();
      Reflect.deleteProperty(window, 'showSaveFilePicker');
      document.documentElement.removeAttribute('naizo-mode');
      document.documentElement.removeAttribute('data-naizo-manual');
      window.Naizo = Naizo;
      window.NaizoDB = NaizoDB;
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('keeps all three documentation tiers synchronized for Mini-API Client, Naizo.setList, Status Pill 1-6 buttons (including Repair JSON), #dot Logo States, #net rules, M12.2 naizo-no-pill & Naizo.link(), M13.2 Naizo.batch, Naizo.ready, naizo-pill-corner, 9 Golden Rules, & omitted directives, and M15.2 Browser Matrix, live-reload server rules, two-tier list merge, live malformed-JSON protection, & wrong-file guard (M8.2, M9.3, M11.2, M12.2, M13.2, M15.2, D46, D50, D53, D56, D57, D58, D59, EC53-EC61)', () => {
    const readmeMd = readFileSync(resolve(process.cwd(), 'README.md'), 'utf-8');
    const usageMd = readFileSync(resolve(process.cwd(), 'docs/USAGE.md'), 'utf-8');
    const productMd = readFileSync(resolve(process.cwd(), 'docs/PRODUCT.md'), 'utf-8');
    const agentsMd = readFileSync(resolve(process.cwd(), 'AGENTS.md'), 'utf-8');
    const claudeMd = readFileSync(resolve(process.cwd(), 'CLAUDE.md'), 'utf-8');
    const currentSiteHtml = readFileSync(resolve(process.cwd(), 'site/index.html'), 'utf-8');
    const skillMd = readFileSync(resolve(process.cwd(), 'skills/naizo/SKILL.md'), 'utf-8');
    const siteSkillMd = readFileSync(resolve(process.cwd(), 'site/SKILL.md'), 'utf-8');
    const llmsTxt = readFileSync(resolve(process.cwd(), 'site/llms.txt'), 'utf-8');
    const llmsFullTxt = readFileSync(resolve(process.cwd(), 'site/llms-full.txt'), 'utf-8');

    expect(lstatSync(resolve(process.cwd(), 'CLAUDE.md')).isSymbolicLink()).toBe(true);
    expect(readlinkSync(resolve(process.cwd(), 'CLAUDE.md'))).toBe('AGENTS.md');
    expect(claudeMd).toBe(agentsMd);
    expect(siteSkillMd).toBe(skillMd);

    for (const docSurface of [
      readmeMd,
      usageMd,
      productMd,
      agentsMd,
      currentSiteHtml,
      skillMd,
      llmsTxt,
      llmsFullTxt,
    ]) {
      expect(docSurface).toContain('naizo-get');
      expect(docSurface).toContain('naizo-post');
      expect(docSurface).toContain('setList');
      expect(docSurface).toContain('fetch');
      expect(docSurface).toContain('#net');
      expect(docSurface).toContain('丸に三つ石');
      expect(docSurface).toContain('Repair JSON');
      expect(docSurface).toContain('Restore Backup');
      expect(docSurface).toContain('naizodb_ui_');
      expect(docSurface).toContain('naizo-no-pill');
      expect(docSurface).toContain('data-naizo-no-pill');
      expect(docSurface).toContain('Naizo.link');
      expect(docSurface).toContain('Naizo.batch');
      expect(docSurface).toContain('Naizo.ready');
      expect(docSurface).toContain('naizo-pill-corner');
      expect(docSurface).toContain('data-naizo-pill-corner');
      expect(docSurface).toContain('brave://flags/#file-system-access-api');
      expect(docSurface).toContain('Opera');
      expect(docSurface).toContain('Replace?');
      expect(docSurface).toContain('Safari');
      expect(docSurface).toContain('Firefox');
      expect(docSurface).toContain('Copy JSON');
      expect(docSurface).toContain('Vite');
      expect(docSurface).toContain('Live Server');
      expect(docSurface).toContain('BrowserSync');
      expect(docSurface).toContain('python3 -m http.server');
      expect(docSurface).toContain('Invalid #naizodb JSON');
    }

    // M12.2, M13.2, & M15.2 / D53: Tier-1 public entry surfaces stay free of internal runtime identifiers
    for (const tier1Surface of [readmeMd, currentSiteHtml]) {
      expect(tier1Surface).not.toContain('isNoPillMode');
      expect(tier1Surface).not.toContain('startupInvalidDb');
      expect(tier1Surface).not.toContain('connectOrResumeDisk');
      expect(tier1Surface).not.toContain('dispatchChangeEvent');
      expect(tier1Surface).not.toContain('pendingChangeQueue');
      expect(tier1Surface).not.toContain('isInteractiveBoundElement');
      expect(tier1Surface).not.toContain('orderInteractiveFirst');
      expect(tier1Surface).not.toContain('bootHydrated');
      expect(tier1Surface).not.toContain('batchDepth');
      expect(tier1Surface).not.toContain('readSavedUiCorner');
      expect(tier1Surface).not.toContain('writeElementValue');
      expect(tier1Surface).not.toContain('shallowMergeDatabases');
      expect(tier1Surface).not.toContain('hydrateSubtreeFromStore');
      expect(tier1Surface).not.toContain('checkDiskForExternalChanges');
      expect(tier1Surface).not.toContain('performSingleDiskWrite');
      expect(tier1Surface).not.toContain('extractDbScriptBody');
      expect(tier1Surface).not.toContain('replaceDbScriptInHtml');
      expect(tier1Surface).not.toContain('injectDbScriptIntoHtml');
      expect(tier1Surface).not.toContain('itemDataMap');
      expect(tier1Surface).not.toContain('findListElements');
      expect(tier1Surface).not.toContain('mergeList3Way');
      expect(tier1Surface).not.toContain('reconcileListItems');
      expect(tier1Surface).not.toContain('liveDiskInvalidJson');
      expect(tier1Surface).not.toContain('scanHtmlTags');
      expect(tier1Surface).not.toContain('getSuggestedFilename');
      expect(tier1Surface).toContain('onclick="Naizo.link()"');
      expect(tier1Surface).toContain('deferPersist');
      expect(tier1Surface).toContain('selectedIndex = -1');
      expect(tier1Surface).toContain('Chrome, Edge, Arc');
      expect(tier1Surface).toContain('per-item');
      expect(tier1Surface).toContain('unique primitive');
      expect(tier1Surface).toContain('activeElement');
      expect(tier1Surface).toContain('raw text backup');
      expect(tier1Surface.replace(/\s+/g, ' ')).toContain('different existing');
      expect(tier1Surface.replace(/\s+/g, ' ')).toContain(
        "{ scope: 'lists', action: 'update', list, index, key, value, source: 'dom', db }",
      );
    }

    // M15.2: Tier-2 & Tier-3 cover two-tier 3-way list merge, in-place list reconciliation,
    // live malformed-JSON protection, rename-friendly wrong-file guard, & O(1) read-only view semantics
    for (const techSurface of [productMd, usageMd, agentsMd, skillMd, llmsTxt, llmsFullTxt]) {
      expect(techSurface).toContain('Path A');
      expect(techSurface).toContain('Path B');
      expect(techSurface).toContain('naizodb_disk_hash_');
      expect(techSurface).toContain('naizodb_raw_backup_');
      expect(techSurface).toContain('activeElement');
      expect(techSurface).toContain('suggestedName');
      expect(techSurface).toContain('mtime');
    }
    for (const devAiSurface of [usageMd, agentsMd, skillMd, llmsTxt, llmsFullTxt]) {
      expect(devAiSurface).toContain('read-only');
      expect(devAiSurface).toContain('`db`');
      expect(devAiSurface).toContain('naizodb_backup_');
    }
    expect(usageMd).toContain('"tasks":{"h":"fnv1a:');

    // M12.2 & M13.2: Tier-2 & Tier-3 contracts cover ="false" opt-out, #__naizodb_styles__, console.warn,
    // AI authoring rules, 9 modernized framework-free Golden Rules, and omitted-directive HTML5 patterns (a)-(g)
    expect(usageMd).toContain('`Naizo.link()`');
    expect(usageMd).toContain('`Promise<boolean>`');
    expect(usageMd).toContain('#__naizodb_styles__');
    expect(usageMd).toContain('console.warn');
    expect(usageMd).toContain('NaizoBatchOptions');
    for (const aiSurface of [agentsMd, skillMd, llmsTxt, llmsFullTxt]) {
      expect(aiSurface).toContain('when the user asks to hide the Status Pill');
      expect(aiSurface).toContain('await Naizo.link()');
      expect(aiSurface).toContain('<template naizo-template>');
      expect(aiSurface).toContain('slotSignature');
      expect(aiSurface).toContain('selectedIndex = -1');
      expect(aiSurface).toContain('DOMContentLoaded');
      expect(aiSurface).toContain('"theme": "system"');
    }
    for (const patternSurface of [usageMd, skillMd, llmsFullTxt]) {
      expect(patternSurface).toContain('naizo-tab');
      expect(patternSurface).toContain('naizo-panel');
      expect(patternSurface).toContain('naizo-text');
      expect(patternSurface).toContain('naizo-href');
      expect(patternSurface).toContain('naizo-index');
      expect(patternSurface).toContain('naizo-options');
      expect(patternSurface).toContain('naizo-autocreate-option');
      expect(patternSurface).toContain('naizo-lazy');
      expect(patternSurface).toContain('naizo-cloak');
      expect(patternSurface).toContain(':has(');
      expect(patternSurface).toContain('<datalist');
      expect(patternSurface).toContain('deferPersist: true');
      expect(patternSurface).toContain('template[naizo-template]');
    }
    for (const summarySurface of [productMd, llmsTxt]) {
      expect(summarySurface).toContain('naizo-tab');
      expect(summarySurface).toContain('naizo-text');
      expect(summarySurface).toContain('naizo-options');
      expect(summarySurface).toContain('naizo-lazy');
    }

    expect(currentSiteHtml).not.toContain('class="status-dot');
    expect(currentSiteHtml).toContain('class="status-crest is-amber"');
    expect(currentSiteHtml).toContain('class="status-crest is-green"');
    expect(currentSiteHtml).toContain('class="status-crest-lg is-green anim-saving"');
    expect(currentSiteHtml).toContain('class="status-crest-lg is-amber anim-wave"');
    expect(currentSiteHtml).toContain('class="status-crest-lg is-amber anim-conflict"');
    expect(currentSiteHtml).toContain('class="status-crest-lg is-red anim-error"');
    expect(currentSiteHtml).toContain('class="pill-icon-inline"');
    expect(currentSiteHtml).toContain(
      'Status Pill (<code>#dot</code> Crest &amp; <code>1..6</code> Buttons)',
    );
    expect(readmeMd).toContain('Status Pill (`#dot` Crest & `1..6` Buttons)');
    expect(readmeMd).toContain('docs/design/human-ai-sync-flow.svg');
    expect(readmeMd).toContain('docs/design/status-pill-anatomy.svg');
    expect(readmeMd).toContain('docs/design/status-crest-animations.svg');
    expect(usageMd).toContain('design/human-ai-sync-flow.svg');
    expect(usageMd).toContain('design/status-pill-anatomy.svg');
    expect(usageMd).toContain('design/status-crest-animations.svg');
    expect(currentSiteHtml).toContain('Status Pill Anatomy — Strict Left-to-Right Slot Order');

    for (const svgPath of [
      'docs/design/human-ai-sync-flow.svg',
      'docs/design/status-pill-anatomy.svg',
      'docs/design/status-crest-animations.svg',
    ]) {
      const svgRaw = readFileSync(resolve(process.cwd(), svgPath), 'utf-8');
      const svgDoc = new DOMParser().parseFromString(svgRaw, 'image/svg+xml');
      expect(svgDoc.querySelector('parsererror')).toBeNull();
      expect(svgDoc.querySelectorAll('svg svg').length).toBe(0);
      expect(svgDoc.querySelectorAll('rect[width="18"][height="18"]').length).toBe(0);
      expect(
        svgDoc.querySelectorAll('rect[width="22"][height="22"][rx="4.5"]').length,
      ).toBeGreaterThanOrEqual(3);
      const styleBlock = svgDoc.querySelector('style')?.textContent ?? '';
      expect(styleBlock).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
      if (svgPath !== 'docs/design/status-pill-anatomy.svg') {
        expect(styleBlock).toContain('transform-box: fill-box');
        expect(styleBlock).toContain('transform-origin: center');
      }
    }

    // M11.2: Verify <symbol id="naizo-crest-icon">, zero 18x18 crest drift in site/index.html,
    // unlinked Local Mode Reset & D52 docs/USAGE.md alignment, and real min+gzip KB sync within ±1.0 KB
    expect(currentSiteHtml).toContain('<symbol id="naizo-crest-icon" viewBox="0 0 100 100">');
    expect(currentSiteHtml).toContain('<use href="#naizo-crest-icon"');
    expect(currentSiteHtml).not.toContain('width="18" height="18"');
    expect(usageMd).toContain(
      'keeping omitted `options.into` non-mutating across all HTTP methods',
    );
    expect(readmeMd).toContain('before linking a local file');
    expect(currentSiteHtml).toContain('before linking a local file');
    expect(usageMd).toContain('(online || !fileHandle) && isDirtyFromInitial()');
    expect(productMd).toContain('Online Mode or unlinked Local Mode');
    expect(skillMd).toContain('unlinked Local Mode');
    expect(llmsTxt).toContain('unlinked Local Mode');
    expect(llmsFullTxt).toContain('unlinked Local Mode');

    const actualMinGzipKb =
      gzipSync(readFileSync(resolve(process.cwd(), 'dist/naizo.min.js')), { level: 9 }).byteLength /
      1000;
    const actualReadableGzipKb =
      gzipSync(readFileSync(resolve(process.cwd(), 'dist/naizo.js')), { level: 9 }).byteLength /
      1000;
    for (const kbSurface of [
      readmeMd,
      productMd,
      usageMd,
      currentSiteHtml,
      skillMd,
      llmsTxt,
      llmsFullTxt,
    ]) {
      expect(kbSurface).not.toContain('15.7 KB');
      expect(kbSurface).not.toContain('22.2 KB');
      expect(kbSurface).not.toContain('22.4 KB');
      expect(kbSurface).not.toContain('23.0 KB');
      expect(kbSurface).not.toContain('23.0_KB');
      expect(kbSurface).not.toContain('23.2 KB');
      expect(kbSurface).not.toContain('31.5 KB');
      expect(kbSurface).not.toContain('31.9 KB');
      expect(kbSurface).not.toContain('32.9 KB');
      expect(kbSurface).not.toContain('144.8 KB');
      const minKbMatch = kbSurface.match(
        /(?:min(?:ified)?[^\n~]{0,25}~(\d+\.\d+)\s*KB|~(\d+\.\d+)\s*KB\s*min)/i,
      );
      expect(minKbMatch).not.toBeNull();
      const documentedMinKb = Number.parseFloat(minKbMatch?.[1] ?? minKbMatch?.[2] ?? '0');
      expect(Math.abs(documentedMinKb - actualMinGzipKb)).toBeLessThanOrEqual(1.0);

      const readableKbMatch = kbSurface.match(
        /(?:readable[^\n~]{0,25}~(\d+\.\d+)\s*KB|~(\d+\.\d+)\s*KB\s*gzipped\s*(?:readable|\/))/i,
      );
      if (readableKbMatch) {
        const documentedReadableKb = Number.parseFloat(
          readableKbMatch[1] ?? readableKbMatch[2] ?? '0',
        );
        expect(Math.abs(documentedReadableKb - actualReadableGzipKb)).toBeLessThanOrEqual(1.0);
      }
    }

    for (const referenceSurface of [
      readmeMd,
      usageMd,
      currentSiteHtml,
      skillMd,
      llmsTxt,
      llmsFullTxt,
    ]) {
      expect(referenceSurface).toContain('naizo-into');
      expect(referenceSurface).toContain('naizo-path');
      expect(referenceSurface).toContain('naizo-body');
      expect(referenceSurface).toContain('naizo-trigger');
      expect(referenceSurface).toContain('naizo-cors');
      expect(referenceSurface).toContain('naizo:fetch');
      expect(referenceSurface).toContain('Access-Control-Allow-Origin');
      expect(referenceSurface).toContain('examples/weather.html');
      expect(referenceSurface).toContain('DevTools');
      expect(referenceSurface).toContain('Network');
    }
    expect(agentsMd).toContain('examples/weather.html');
    expect(productMd).toContain('DevTools');
    expect(productMd).toContain('Network');

    // Verify every TOC #anchor in docs/USAGE.md resolves to a matching ## section heading
    const headingSlugs = new Set(
      Array.from(usageMd.matchAll(/^##\s+(.+)$/gm)).map((m) =>
        (m[1] ?? '')
          .toLowerCase()
          .replace(/[^\w -]/g, '')
          .trim()
          .replace(/ /g, '-'),
      ),
    );
    const tocAnchors = Array.from(usageMd.matchAll(/^\d+\.\s+\[[^\]]+\]\(#([a-z0-9-]+)\)/gm)).map(
      (m) => m[1] ?? '',
    );
    expect(tocAnchors.length).toBe(15);
    for (const anchor of tocAnchors) {
      expect(headingSlugs.has(anchor)).toBe(true);
    }
  });

  it('hydrates examples/weather.html cleanly with wrapping <label> controls, pass-through route coordinates, #net auto-show, and clean HTML export (EC39, D15, D45, D47)', async () => {
    expect(weatherHtml).toContain('https://cdn.jsdelivr.net/npm/ol@v10.8.0/ol.css');
    expect(weatherHtml).toContain('https://cdn.jsdelivr.net/npm/ol@v10.8.0/dist/ol.js');
    expect(weatherHtml.toLowerCase()).not.toContain('leaflet');

    const weatherDoc = new DOMParser().parseFromString(weatherHtml, 'text/html');
    document.documentElement.setAttribute(
      'naizo-id',
      weatherDoc.documentElement.getAttribute('naizo-id') ?? '',
    );
    document.head.innerHTML = weatherDoc.head.innerHTML;
    document.body.innerHTML = weatherDoc.body.innerHTML;

    const initialRaw = document.getElementById('naizodb')?.textContent ?? '';
    const parsedInitial = JSON.parse(initialRaw) as NaizoDatabase;
    expect(parsedInitial._meta.id).toBe('naizo-weather-route-planner');
    expect(parsedInitial.fields.theme).toBe('system');

    await initNaizo();

    // 1. Route list items hydrate with wrapping <label> controls (EC39) and pass-through geo/elevation keys (D15)
    const routeItems = Array.from(
      document.querySelectorAll<HTMLElement>('[naizo-list="route"] > [naizo-item]'),
    );
    expect(routeItems.length).toBe(2);
    for (const item of routeItems) {
      const labels = Array.from(item.querySelectorAll('label'));
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.control).not.toBeNull();
        expect(item.contains(label.control)).toBe(true);
      }
    }
    const route = Naizo.getList('route');
    expect(route[0]?.id).toBe('stop-taisho-pond');
    expect(route[0]?.elevation_m).toBe(1495);
    expect(route[1]?.id).toBe('stop-myojin-pond');

    // 2. Declarative naizo-get and naizo-post controls auto-reveal the rightmost #net wired-globe indicator
    const host = document.getElementById('__naizodb_host__');
    const netBtn = host?.shadowRoot?.getElementById('net') as HTMLButtonElement | null;
    expect(netBtn).not.toBeNull();
    expect(netBtn?.style.display).not.toBe('none');
    expect(netBtn?.getAttribute('title')).toBe('API idle');

    // 3. Clean HTML export strips [naizo-strip] / [data-naizo-strip] transient DOM elements while preserving #naizodb (D47)
    const exportedHtml = Naizo.exportHTML();
    const exportedDoc = new DOMParser().parseFromString(exportedHtml, 'text/html');
    expect(exportedDoc.querySelectorAll('[naizo-strip], [data-naizo-strip]').length).toBe(0);
    expect(exportedHtml).not.toContain('__naizodb_host__');
    expect(exportedHtml).toContain('"trip_title": "Nagano Alpine Valley & Trail Outing"');
  });

  it('validates M9.1 & M11.2 brand logo assets: site/logo.svg, site/logo-dark.svg, 512x512 site/logo.png, media=(prefers-color-scheme: light|dark) favicons, 62x62 Hero Crest, and README.md header without changing npm package files (M9.1, M11.2, D50, D56)', () => {
    vi.useFakeTimers();
    try {
      const logoSvg = readFileSync(resolve(process.cwd(), 'site/logo.svg'), 'utf-8');
      const logoDarkSvg = readFileSync(resolve(process.cwd(), 'site/logo-dark.svg'), 'utf-8');
      const logoPng = readFileSync(resolve(process.cwd(), 'site/logo.png'));
      const currentSiteHtml = readFileSync(resolve(process.cwd(), 'site/index.html'), 'utf-8');
      const readmeMd = readFileSync(resolve(process.cwd(), 'README.md'), 'utf-8');

      // 1. Standalone site/logo.svg, site/logo-dark.svg (hardcoded #f5f5f4), & 512x512 raster site/logo.png
      expect(logoSvg).toContain('viewBox="0 0 100 100"');
      expect(logoSvg).toContain('color-scheme: light dark');
      expect(logoSvg).toContain('#1c1917');
      expect(logoSvg).toContain('@media (prefers-color-scheme: dark)');
      expect(logoSvg).toContain('#f5f5f4');
      expect(logoSvg).not.toContain('currentColor');

      const logoDoc = new DOMParser().parseFromString(logoSvg, 'image/svg+xml');
      const circle = logoDoc.querySelector('circle.ring');
      expect(circle?.getAttribute('cx')).toBe('50');
      expect(circle?.getAttribute('cy')).toBe('50');
      expect(circle?.getAttribute('r')).toBe('42');
      expect(circle?.getAttribute('stroke')).toBe('#1c1917');
      expect(circle?.getAttribute('stroke-width')).toBe('8');
      const rects = Array.from(logoDoc.querySelectorAll('rect.stone'));
      expect(
        rects.map((r) => ({
          x: r.getAttribute('x'),
          y: r.getAttribute('y'),
          w: r.getAttribute('width'),
          h: r.getAttribute('height'),
          rx: r.getAttribute('rx'),
          fill: r.getAttribute('fill'),
        })),
      ).toEqual([
        { x: '39', y: '26', w: '22', h: '22', rx: '4.5', fill: '#1c1917' },
        { x: '26', y: '52', w: '22', h: '22', rx: '4.5', fill: '#1c1917' },
        { x: '52', y: '52', w: '22', h: '22', rx: '4.5', fill: '#1c1917' },
      ]);

      expect(logoDarkSvg).toContain('viewBox="0 0 100 100"');
      expect(logoDarkSvg).not.toContain('<style>');
      expect(logoDarkSvg).not.toContain('currentColor');
      const logoDarkDoc = new DOMParser().parseFromString(logoDarkSvg, 'image/svg+xml');
      expect(logoDarkDoc.querySelector('circle')?.getAttribute('stroke')).toBe('#f5f5f4');
      expect(
        Array.from(logoDarkDoc.querySelectorAll('rect')).map((r) => ({
          x: r.getAttribute('x'),
          y: r.getAttribute('y'),
          w: r.getAttribute('width'),
          rx: r.getAttribute('rx'),
          fill: r.getAttribute('fill'),
        })),
      ).toEqual([
        { x: '39', y: '26', w: '22', rx: '4.5', fill: '#f5f5f4' },
        { x: '26', y: '52', w: '22', rx: '4.5', fill: '#f5f5f4' },
        { x: '52', y: '52', w: '22', rx: '4.5', fill: '#f5f5f4' },
      ]);

      // Verify PNG signature (89 50 4E 47 0D 0A 1A 0A) and IHDR 512x512 dimensions
      expect(logoPng.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
        true,
      );
      expect(logoPng.subarray(12, 16).toString('ascii')).toBe('IHDR');
      expect(logoPng.readUInt32BE(16)).toBe(512);
      expect(logoPng.readUInt32BE(20)).toBe(512);

      // 2. site/index.html light/dark favicons + PNG touch/social card metadata, examples/*.html + status-pill-reference.html dual favicons, and 62x62 Hero Crest
      const siteDoc = new DOMParser().parseFromString(currentSiteHtml, 'text/html');
      const headIcons = Array.from(siteDoc.querySelectorAll('head link[rel="icon"]'));
      expect(
        headIcons.map((l) => ({
          type: l.getAttribute('type'),
          sizes: l.getAttribute('sizes'),
          media: l.getAttribute('media'),
          href: l.getAttribute('href'),
        })),
      ).toEqual([
        { type: 'image/png', sizes: '32x32', media: null, href: './logo.png' },
        {
          type: 'image/svg+xml',
          sizes: 'any',
          media: '(prefers-color-scheme: light)',
          href: './logo.svg',
        },
        {
          type: 'image/svg+xml',
          sizes: 'any',
          media: '(prefers-color-scheme: dark)',
          href: './logo-dark.svg',
        },
      ]);
      expect(siteDoc.querySelector('head link[rel="shortcut icon"]')).toBeNull();
      expect(
        siteDoc.querySelector(
          'head link[rel="apple-touch-icon"][sizes="512x512"][href="./logo.png"]',
        ),
      ).not.toBeNull();
      expect(siteDoc.querySelector('head meta[property="og:image"]')?.getAttribute('content')).toBe(
        'https://naizo.js.org/logo.png',
      );
      expect(
        siteDoc.querySelector('head meta[property="og:image:type"]')?.getAttribute('content'),
      ).toBe('image/png');
      expect(
        siteDoc.querySelector('head meta[property="og:image:width"]')?.getAttribute('content'),
      ).toBe('512');
      expect(
        siteDoc.querySelector('head meta[property="og:image:height"]')?.getAttribute('content'),
      ).toBe('512');
      expect(
        siteDoc.querySelector('head meta[property="og:image:alt"]')?.getAttribute('content'),
      ).toContain('Maru ni Mitsuishi');
      expect(
        siteDoc.querySelector('head meta[name="twitter:image"]')?.getAttribute('content'),
      ).toBe('https://naizo.js.org/logo.png');
      expect(
        siteDoc.querySelector('head meta[name="twitter:image:alt"]')?.getAttribute('content'),
      ).toContain('Maru ni Mitsuishi');
      const siteJsonLd = JSON.parse(
        siteDoc.querySelector('head script[type="application/ld+json"]')?.textContent ?? '{}',
      ) as { image?: string };
      expect(siteJsonLd.image).toBe('https://naizo.js.org/logo.png');

      for (const exFile of [
        'examples/starter.html',
        'examples/checklist.html',
        'examples/notes.html',
        'examples/inventory.html',
        'examples/weather.html',
        'docs/design/status-pill-reference.html',
      ]) {
        const exHtml = readFileSync(resolve(process.cwd(), exFile), 'utf-8');
        const exDoc = new DOMParser().parseFromString(exHtml, 'text/html');
        const lightIcon = exDoc.querySelector(
          'head link[rel="icon"][type="image/svg+xml"][media="(prefers-color-scheme: light)"]',
        );
        const darkIcon = exDoc.querySelector(
          'head link[rel="icon"][type="image/svg+xml"][media="(prefers-color-scheme: dark)"]',
        );
        expect(lightIcon?.getAttribute('href')).toContain('%231c1917');
        expect(lightIcon?.getAttribute('href')).toContain("width='22'");
        expect(darkIcon?.getAttribute('href')).toContain('%23f5f5f4');
        expect(darkIcon?.getAttribute('href')).toContain("width='22'");
      }

      const heroCrest = siteDoc.getElementById('hero-crest-link');
      expect(heroCrest).not.toBeNull();
      expect(heroCrest?.nextElementSibling?.tagName).toBe('H1');
      expect(heroCrest?.nextElementSibling?.textContent).toBe('naizo.js');

      const heroSvg = heroCrest?.querySelector('svg.hero-crest-svg');
      expect(heroSvg?.getAttribute('viewBox')).toBe('0 0 100 100');
      expect(heroSvg?.querySelector('circle.ring')?.getAttribute('r')).toBe('42');
      expect(heroSvg?.querySelector('rect.c-top')?.getAttribute('x')).toBe('39');
      expect(heroSvg?.querySelector('rect.c-top')?.getAttribute('y')).toBe('26');
      expect(heroSvg?.querySelector('rect.c-bl')?.getAttribute('x')).toBe('26');
      expect(heroSvg?.querySelector('rect.c-bl')?.getAttribute('y')).toBe('52');
      expect(heroSvg?.querySelector('rect.c-br')?.getAttribute('x')).toBe('52');
      expect(heroSvg?.querySelector('rect.c-br')?.getAttribute('y')).toBe('52');

      expect(currentSiteHtml).toContain('width: 62px;');
      expect(currentSiteHtml).toContain('height: 62px;');
      expect(currentSiteHtml).toContain('margin: 1.5rem auto 2px;');
      expect(currentSiteHtml).toContain('cursor: default;');
      expect(currentSiteHtml).toContain('@keyframes naizoHeartTop');
      expect(currentSiteHtml).toContain('11.5%');
      expect(currentSiteHtml).toContain('@keyframes naizoHeartBR');
      expect(currentSiteHtml).toContain('44.83%');
      expect(currentSiteHtml).toContain('@keyframes naizoHeartBL');
      expect(currentSiteHtml).toContain('78.17%');
      expect(currentSiteHtml).toContain('@keyframes naizoRingBreath');
      expect(currentSiteHtml).toContain('18.5%');
      expect(currentSiteHtml).toContain('51.83%');
      expect(currentSiteHtml).toContain('85.17%');
      expect(currentSiteHtml).toContain('scale(1.064)');
      expect(currentSiteHtml).toContain('1.55s');
      expect(currentSiteHtml).toContain('const HERO_BEAT_MS = 1550 / 3;');

      // Exercise the inline script's Hero Crest hover controller in DOM
      document.head.innerHTML = siteDoc.head.innerHTML;
      document.body.innerHTML = siteDoc.body.innerHTML;
      const scripts = Array.from(siteDoc.body.querySelectorAll('script'));
      const inlineScript = scripts[scripts.length - 1]?.textContent ?? '';
      let nowMs = 1000;
      const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
      const inlineListenerCleanup = new AbortController();
      const origWindowAddEventListener = window.addEventListener.bind(window);
      const addListenerSpy = vi
        .spyOn(window, 'addEventListener')
        .mockImplementation(
          (
            type: string,
            listener: EventListenerOrEventListenerObject,
            options?: boolean | AddEventListenerOptions,
          ) => {
            const mergedOpts: AddEventListenerOptions =
              typeof options === 'boolean'
                ? { capture: options, signal: inlineListenerCleanup.signal }
                : { ...options, signal: inlineListenerCleanup.signal };
            origWindowAddEventListener(type, listener, mergedOpts);
          },
        );
      try {
        runInThisContext(inlineScript);
        const liveCrest = document.getElementById('hero-crest-link');
        expect(liveCrest).not.toBeNull();
        expect(liveCrest?.classList.contains('is-beating')).toBe(false);

        liveCrest?.dispatchEvent(new MouseEvent('mouseenter'));
        expect(liveCrest?.classList.contains('is-beating')).toBe(true);

        // Leave 200ms into the first 516.67ms single-block beat: should finish only the active block (~317ms left)
        nowMs = 1200;
        liveCrest?.dispatchEvent(new MouseEvent('mouseleave'));
        expect(liveCrest?.classList.contains('is-beating')).toBe(true);

        vi.advanceTimersByTime(310);
        expect(liveCrest?.classList.contains('is-beating')).toBe(true);

        vi.advanceTimersByTime(10);
        expect(liveCrest?.classList.contains('is-beating')).toBe(false);
      } finally {
        inlineListenerCleanup.abort();
        addListenerSpy.mockRestore();
        perfSpy.mockRestore();
      }

      // 3. README.md header crest & unchanged 8-file npm package distribution
      expect(readmeMd).toContain(
        '<img src="site/logo.svg" width="62" height="62" alt="naizo.js logo" />',
      );
      expect(pkgJson.files).toEqual([
        'dist/naizo.js',
        'dist/naizo.min.js',
        'dist/index.mjs',
        'dist/index.d.mts',
        'README.md',
        'CHANGELOG.md',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('implements M9.2 translucent frosted-glass Status Pill, strict 1-6 icon buttons, 5 narrative #dot animations with 1.55s saving cycle completion, theme sync, and 4-corner snap drag persistence across source and dist/naizo.js (M9.2, D50, EC48)', async () => {
    vi.useFakeTimers();
    let nowMs = 1000;
    const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    try {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.className = '';
      document.body.removeAttribute('data-theme');
      document.body.className = '';
      document.documentElement.setAttribute('naizo-id', 'm9-2-pill-suite');
      document.documentElement.setAttribute('naizo-mode', 'online');
      document.head.innerHTML = `<script id="naizodb" type="application/json">
{
  "_meta": {},
  "fields": { "title": "Initial Title" },
  "lists": {},
  "custom": {}
}
</script>`;
      document.body.innerHTML = `<input type="text" naizo="title" value="Initial Title" /><button type="button" naizo-get="https://api.example.com/ping">Ping</button>`;

      await initNaizo();

      const host = document.getElementById('__naizodb_host__') as
        | (HTMLDivElement & { _setDot?: (s: string) => void })
        | null;
      const shadow = host?.shadowRoot;
      expect(host).not.toBeNull();
      expect(shadow).not.toBeNull();

      // 1. Strict 1..6 left-to-right element order inside .pill & 20px Balanced #dot SVG geometry
      const pill = shadow?.getElementById('pill');
      expect(pill).not.toBeNull();
      const pillChildIds = Array.from(pill?.children ?? []).map((el) => el.id);
      expect(pillChildIds).toEqual([
        'status',
        'dot',
        'dot-sep',
        'action',
        'unlink',
        'copy',
        'restore',
        'reset',
        'net-sep',
        'net',
      ]);
      expect(pill?.lastElementChild?.id).toBe('net');

      const dotEl = shadow?.getElementById('dot') as HTMLButtonElement | null;
      expect(dotEl?.className).toBe('dot saved');
      expect(dotEl?.dataset.naizoBoot).toBe('1');
      const dotSvg = dotEl?.querySelector('svg.naizo-logo-svg');
      expect(dotSvg?.getAttribute('viewBox')).toBe('0 0 100 100');
      expect(dotSvg?.querySelector('circle.ring')?.getAttribute('r')).toBe('42');
      expect(dotSvg?.querySelector('rect.c-top')?.getAttribute('x')).toBe('39');
      expect(dotSvg?.querySelector('rect.c-top')?.getAttribute('y')).toBe('26');
      expect(dotSvg?.querySelector('rect.c-top')?.getAttribute('width')).toBe('22');
      expect(dotSvg?.querySelector('rect.c-top')?.getAttribute('height')).toBe('22');
      expect(dotSvg?.querySelector('rect.c-top')?.getAttribute('rx')).toBe('4.5');
      expect(dotSvg?.querySelector('rect.c-bl')?.getAttribute('x')).toBe('26');
      expect(dotSvg?.querySelector('rect.c-bl')?.getAttribute('y')).toBe('52');
      expect(dotSvg?.querySelector('rect.c-bl')?.getAttribute('width')).toBe('22');
      expect(dotSvg?.querySelector('rect.c-bl')?.getAttribute('rx')).toBe('4.5');
      expect(dotSvg?.querySelector('rect.c-br')?.getAttribute('x')).toBe('52');
      expect(dotSvg?.querySelector('rect.c-br')?.getAttribute('y')).toBe('52');
      expect(dotSvg?.querySelector('rect.c-br')?.getAttribute('width')).toBe('22');
      expect(dotSvg?.querySelector('rect.c-br')?.getAttribute('rx')).toBe('4.5');

      // Boot animation attribute clears after 1250ms
      vi.advanceTimersByTime(1250);
      expect(dotEl?.dataset.naizoBoot).toBeUndefined();

      // 2. Light/Dark theme synchronization via MutationObserver on <html> and <body>
      expect(host?.getAttribute('data-naizo-theme')).toBeNull();
      document.documentElement.setAttribute('data-theme', 'dark');
      await Promise.resolve();
      expect(host?.getAttribute('data-naizo-theme')).toBe('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      await Promise.resolve();
      expect(host?.getAttribute('data-naizo-theme')).toBe('light');
      document.documentElement.removeAttribute('data-theme');
      document.body.classList.add('dark');
      await Promise.resolve();
      expect(host?.getAttribute('data-naizo-theme')).toBe('dark');
      document.body.classList.remove('dark');
      await Promise.resolve();
      expect(host?.getAttribute('data-naizo-theme')).toBeNull();

      // 3. Sweet-spot Saving -> Static cycle completion (1550ms) & urgent state immediate interrupt
      nowMs = 2000;
      host?._setDot?.('saving');
      expect(dotEl?.className).toBe('dot saving');
      expect(dotEl?.dataset.naizoSaving).toBe('1');

      // Fast 10ms save finishes at t = 2010ms: dot class becomes 'dot saved', but data-naizo-saving holds for remaining 1540ms
      nowMs = 2010;
      host?._setDot?.('saved');
      expect(dotEl?.className).toBe('dot saved');
      expect(dotEl?.dataset.naizoSaving).toBe('1');

      vi.advanceTimersByTime(1530);
      expect(dotEl?.dataset.naizoSaving).toBe('1');
      vi.advanceTimersByTime(15);
      expect(dotEl?.dataset.naizoSaving).toBeUndefined();

      // Urgent state (conflict / needs-permission / error) interrupts saving cycle immediately with 0ms lag
      nowMs = 4000;
      host?._setDot?.('saving');
      expect(dotEl?.dataset.naizoSaving).toBe('1');
      nowMs = 4100;
      host?._setDot?.('conflict');
      expect(dotEl?.className).toBe('dot conflict');
      expect(dotEl?.dataset.naizoSaving).toBeUndefined();
      host?._setDot?.('needs-permission');
      expect(dotEl?.className).toBe('dot needs-permission');
      host?._setDot?.('saved');
      expect(dotEl?.className).toBe('dot saved');

      // 4. Hover tooltip (#pill-tooltip) & #copy 1.5s checkmark morph (.copied)
      const tooltipEl = shadow?.getElementById('pill-tooltip');
      const tooltipText = shadow?.getElementById('tooltip-text');
      const copyBtn = shadow?.getElementById('copy') as HTMLButtonElement | null;
      expect(copyBtn?.textContent).toBe('📋 Copy');

      copyBtn?.dispatchEvent(new MouseEvent('mouseenter'));
      expect(tooltipEl?.classList.contains('visible')).toBe(true);
      expect(tooltipText?.textContent).toBe('Copy JSON');
      copyBtn?.dispatchEvent(new MouseEvent('mouseleave'));
      expect(tooltipEl?.classList.contains('visible')).toBe(false);

      copyBtn?.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(copyBtn?.classList.contains('copied')).toBe(true);
      expect(copyBtn?.textContent).toBe('✓ Copied');
      expect(copyBtn?.querySelector('svg')?.innerHTML).toContain('points="20 6.5 9.5 17 4 11.5"');

      vi.advanceTimersByTime(1500);
      expect(copyBtn?.classList.contains('copied')).toBe(false);
      expect(copyBtn?.textContent).toBe('📋 Copy');

      // 5. 4-corner pointer snap drag, .pill-drop-zone placeholders, and naizodb_ui_<suffix> persistence (EC48)
      const anchorEl = shadow?.getElementById('pill-anchor');
      const resetBtn = shadow?.getElementById('reset') as HTMLButtonElement | null;
      const beforeDbRaw = document.getElementById('naizodb')?.textContent;
      expect(anchorEl?.dataset.corner).toBe('bottom-right');
      expect(resetBtn?.style.display).toBe('none');

      const makePointerEvent = (type: string, clientX: number, clientY: number) => {
        const ev = new MouseEvent(type, { bubbles: true, clientX, clientY }) as PointerEvent;
        Object.defineProperty(ev, 'pointerId', { value: 1 });
        return ev;
      };

      dotEl?.dispatchEvent(makePointerEvent('pointerdown', 900, 700));
      pill?.dispatchEvent(makePointerEvent('pointermove', 40, 40));
      expect(host?.getAttribute('data-naizo-dragging')).toBe('1');
      expect(anchorEl?.classList.contains('is-dragging')).toBe(true);
      const topLeftZone = shadow?.querySelector('.pill-drop-zone[data-corner="top-left"]');
      expect(topLeftZone?.classList.contains('active-target')).toBe(true);

      pill?.dispatchEvent(makePointerEvent('pointerup', 40, 40));
      expect(host?.getAttribute('data-naizo-dragging')).toBeNull();
      expect(anchorEl?.classList.contains('is-dragging')).toBe(false);
      expect(anchorEl?.dataset.corner).toBe('top-left');
      expect(localStorage.getItem('naizodb_ui_/::m9-2-pill-suite')).toBe('{"corner":"top-left"}');

      // Dragging the pill must NOT mutate #naizodb or dirty initialDiskDb (EC48)
      expect(document.getElementById('naizodb')?.textContent).toBe(beforeDbRaw);
      expect(resetBtn?.style.display).toBe('none');

      // 6. Verify Repair mode (Wrench icon) vs Restore Backup mode and corner restoration across initNaizo() + shipped dist/naizo.js
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const scriptEl = document.getElementById('naizodb');
        if (scriptEl) scriptEl.textContent = '{ broken json ';
        window.__naizoCleanup?.();
        document.getElementById('__naizodb_host__')?.remove();
        document.documentElement.setAttribute('data-naizo-manual', 'true');
        runInThisContext(iifeBundleCode);
        await window.Naizo.init();

        const distHost = document.getElementById('__naizodb_host__');
        const distShadow = distHost?.shadowRoot;
        const distAnchor = distShadow?.getElementById('pill-anchor');
        const distRestoreBtn = distShadow?.getElementById('restore') as HTMLButtonElement | null;
        const distDotEl = distShadow?.getElementById('dot') as HTMLButtonElement | null;
        expect(distAnchor?.dataset.corner).toBe('top-left');
        expect(distDotEl?.className).toBe('dot error');
        expect(distRestoreBtn?.style.display).toBe('inline-block');
        expect(distRestoreBtn?.textContent).toBe('↺ Repair');
        expect(distRestoreBtn?.dataset.tip).toBe('Repair JSON');
        expect(distRestoreBtn?.querySelector('svg')?.innerHTML).toContain('M14.7 6.3');
      } finally {
        warnSpy.mockRestore();
      }
    } finally {
      perfSpy.mockRestore();
      window.__naizoCleanup?.();
      document.documentElement.removeAttribute('naizo-id');
      document.documentElement.removeAttribute('naizo-mode');
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.removeAttribute('data-naizo-manual');
      document.body.classList.remove('dark', 'light');
      window.Naizo = Naizo;
      window.NaizoDB = NaizoDB;
      vi.useRealTimers();
    }
  });

  it('hardens Status Pill hit-testing, 22x22 crest geometry, FLIP snap drag, unlinked Local Mode Reset, EC36 cached green-hold fix, live non-duplicated tooltips, Online Cmd+S flash, OS dark sync, and <100 KB dist/naizo.min.js compaction (M11.1, D50, D56, EC36, EC47, EC48, EC52)', async () => {
    vi.useFakeTimers();
    let nowMs = 5000;
    const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    const origMatchMedia = window.matchMedia;
    let osDarkMatches = false;
    let reducedMotionMatches = false;
    const mqDarkListeners = new Set<() => void>();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-color-scheme: dark')
        ? osDarkMatches
        : query.includes('prefers-reduced-motion: reduce')
          ? reducedMotionMatches
          : false,
      media: query,
      onchange: null,
      addEventListener: (ev: string, cb: () => void) => {
        if (ev === 'change' && query.includes('prefers-color-scheme: dark')) {
          mqDarkListeners.add(cb);
        }
      },
      removeEventListener: (ev: string, cb: () => void) => {
        if (ev === 'change' && query.includes('prefers-color-scheme: dark')) {
          mqDarkListeners.delete(cb);
        }
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }));

    const flushMicrotasks = async (ticks = 10): Promise<void> => {
      for (let i = 0; i < ticks; i += 1) {
        await Promise.resolve();
      }
    };

    try {
      document.documentElement.setAttribute('naizo-id', 'm11-1-hardening');
      document.documentElement.setAttribute('naizo-mode', 'local');
      document.head.innerHTML = `<script id="naizodb" type="application/json">
{
  "_meta": {},
  "fields": { "note": "Disk Baseline" },
  "lists": {},
  "custom": {}
}
</script>`;
      document.body.innerHTML = `<input id="note-in" type="text" naizo="note" value="Disk Baseline" /><button type="button" naizo-get="https://api.example.com/ping">Ping</button>`;

      await initNaizo();

      const host = document.getElementById('__naizodb_host__') as
        | (HTMLDivElement & { _setDot?: (s: string) => void })
        | null;
      const shadow = host?.shadowRoot;
      const styleText = shadow?.querySelector('style')?.textContent ?? '';
      const anchorEl = shadow?.getElementById('pill-anchor') as HTMLElement | null;
      const pillEl = shadow?.getElementById('pill') as HTMLElement | null;
      const dotEl = shadow?.getElementById('dot') as HTMLButtonElement | null;
      const actionBtn = shadow?.getElementById('action') as HTMLButtonElement | null;
      const unlinkBtn = shadow?.getElementById('unlink') as HTMLButtonElement | null;
      const copyBtn = shadow?.getElementById('copy') as HTMLButtonElement | null;
      const restoreBtn = shadow?.getElementById('restore') as HTMLButtonElement | null;
      const resetBtn = shadow?.getElementById('reset') as HTMLButtonElement | null;
      const resetConfirmEl = shadow?.getElementById('reset-confirm') as HTMLElement | null;
      const resetYesBtn = shadow?.getElementById('reset-yes') as HTMLButtonElement | null;
      const tooltipEl = shadow?.getElementById('pill-tooltip') as HTMLElement | null;
      const tooltipTextEl = shadow?.getElementById('tooltip-text') as HTMLElement | null;

      // 1. Hit-testing, absolute tooltip flip, spaceless display:none guard, :focus-visible, single dark block, and fill-box center
      expect(styleText).toContain('.pill-anchor');
      expect(styleText).toContain('pointer-events: none;');
      expect(styleText).toContain('gap: 8px;');
      expect(styleText).toContain('transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);');
      expect(styleText).toContain('pointer-events: auto; touch-action: none;');
      expect(styleText).toContain('position: absolute; bottom: calc(100% + 7px); right: 0;');
      expect(styleText).toContain('.pill-anchor[data-corner$="-left"] .pill-tooltip');
      expect(styleText).toContain('.pill-anchor[data-corner^="top-"] .pill-tooltip');
      expect(styleText).toContain(
        '.icon-btn:not([style*="display: none"]):not([style*="display:none"])',
      );
      expect(styleText).toContain(':focus-visible');
      expect(styleText).toContain('.anim-net-error');
      expect(styleText).toContain('transform-box: fill-box;');
      expect(styleText).toContain('transform-origin: center;');
      expect(styleText).not.toContain(':host(:not([data-naizo-theme="light"]))');

      // 2. OS @media (prefers-color-scheme: dark) dynamic sync via syncHostTheme() + explicit light override
      expect(host?.getAttribute('data-naizo-theme')).toBeNull();
      expect(mqDarkListeners.size).toBe(1);
      osDarkMatches = true;
      mqDarkListeners.forEach((cb) => cb());
      expect(host?.getAttribute('data-naizo-theme')).toBe('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      await Promise.resolve();
      expect(host?.getAttribute('data-naizo-theme')).toBe('light');
      document.documentElement.removeAttribute('data-theme');
      await Promise.resolve();
      expect(host?.getAttribute('data-naizo-theme')).toBe('dark');
      osDarkMatches = false;
      mqDarkListeners.forEach((cb) => cb());
      expect(host?.getAttribute('data-naizo-theme')).toBeNull();

      // 3. EC36 syncSavingBeat() 'cached' fix: failed write or unlink immediately clears data-naizo-saving instead of holding green
      nowMs = 6000;
      host?._setDot?.('saving');
      expect(dotEl?.dataset.naizoSaving).toBe('1');
      nowMs = 6010;
      host?._setDot?.('cached');
      expect(dotEl?.className).toBe('dot');
      expect(dotEl?.dataset.naizoSaving).toBeUndefined();

      // 4. Native title stash/restore on hover, live tooltip refresh, touch suppression, and auto-hide when button hides
      const makeMousePointer = (type: string, pointerType = 'mouse') => {
        const ev = new MouseEvent(type, { bubbles: true }) as PointerEvent;
        Object.defineProperty(ev, 'pointerType', { value: pointerType });
        return ev;
      };

      expect(copyBtn?.getAttribute('title')).toBe('Copy #naizodb JSON state');
      copyBtn?.dispatchEvent(makeMousePointer('pointerenter', 'mouse'));
      expect(copyBtn?.hasAttribute('title')).toBe(false);
      expect(copyBtn?.dataset.savedTitle).toBe('Copy #naizodb JSON state');
      expect(tooltipEl?.classList.contains('visible')).toBe(true);
      expect(tooltipTextEl?.textContent).toBe('Copy JSON');

      // Clicking #copy while hovered updates tooltip live to '✓ Copied', then back to 'Copy JSON' after 1500ms while still hovered
      copyBtn?.click();
      await flushMicrotasks(4);
      expect(tooltipTextEl?.textContent).toBe('✓ Copied');
      vi.advanceTimersByTime(1500);
      expect(tooltipEl?.classList.contains('visible')).toBe(true);
      expect(tooltipTextEl?.textContent).toBe('Copy JSON');

      copyBtn?.dispatchEvent(makeMousePointer('pointerleave', 'mouse'));
      expect(copyBtn?.getAttribute('title')).toBe('Copy #naizodb JSON state');
      expect(copyBtn?.dataset.savedTitle).toBeUndefined();
      expect(tooltipEl?.classList.contains('visible')).toBe(false);

      // Touch tap suppresses sticky hover tooltip
      actionBtn?.dispatchEvent(makeMousePointer('pointerdown', 'touch'));
      actionBtn?.dispatchEvent(makeMousePointer('pointerenter', 'touch'));
      expect(tooltipEl?.classList.contains('visible')).toBe(false);

      // 5. Unlinked Local Mode #reset: appears when dirty, opens #reset-confirm (hiding #pill-tooltip), backs up & restores,
      // auto-hides (closing #reset-confirm) on disk link, and stays hidden across × Unlink after disk save/merge
      expect(resetBtn?.style.display).toBe('none');
      Naizo.setField('note', 'Unlinked Scratch Edit');
      expect(resetBtn?.style.display).toBe('inline-block');

      resetBtn?.dispatchEvent(makeMousePointer('pointerenter', 'mouse'));
      expect(tooltipEl?.classList.contains('visible')).toBe(true);
      resetBtn?.click();
      expect(resetConfirmEl?.style.display).toBe('inline-flex');
      expect(tooltipEl?.classList.contains('visible')).toBe(false);

      resetYesBtn?.click();
      expect(resetConfirmEl?.style.display).toBe('none');
      expect(Naizo.getField('note')).toBe('Disk Baseline');
      expect(resetBtn?.style.display).toBe('none');
      expect(restoreBtn?.style.display).toBe('inline-block');

      // Hovering #restore and clicking it restores 'Unlinked Scratch Edit' and immediately hides orphaned tooltip when #restore hides
      restoreBtn?.dispatchEvent(makeMousePointer('pointerenter', 'mouse'));
      expect(tooltipEl?.classList.contains('visible')).toBe(true);
      expect(tooltipTextEl?.textContent).toBe('Restore Backup');
      restoreBtn?.click();
      expect(Naizo.getField('note')).toBe('Unlinked Scratch Edit');
      expect(restoreBtn?.style.display).toBe('none');
      expect(tooltipEl?.classList.contains('visible')).toBe(false);
      expect(restoreBtn?.getAttribute('title')).toBe(
        'Restore browser state before conflict or reset',
      );
      expect(resetBtn?.style.display).toBe('inline-block');

      // Open #reset-confirm, then click #dot (non-drag!) to link disk: connects disk, auto-hides #reset, and auto-closes #reset-confirm
      resetBtn?.click();
      expect(resetConfirmEl?.style.display).toBe('inline-flex');

      let diskHtml = `<!doctype html><html><head><script id="naizodb" type="application/json">\n${JSON.stringify(
        {
          _meta: {},
          fields: { note: 'Disk Baseline' },
          lists: {},
          custom: {},
        },
        null,
        2,
      )}\n</script></head><body></body></html>`;
      let diskMtime = 2000;
      let handlePerm: PermissionState = 'granted';
      const pickerSpy = vi.fn().mockResolvedValue({
        queryPermission: vi.fn().mockImplementation(async () => handlePerm),
        requestPermission: vi.fn().mockImplementation(async () => handlePerm),
        getFile: vi.fn().mockImplementation(async () => ({
          lastModified: diskMtime,
          arrayBuffer: async () => new TextEncoder().encode(diskHtml).buffer,
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
      window.showSaveFilePicker = pickerSpy;

      dotEl?.click();
      await flushMicrotasks(14);
      expect(pickerSpy).toHaveBeenCalledTimes(1);
      expect(shadow?.getElementById('status')?.textContent).toBe('Synced to Disk');
      expect(diskHtml).toContain('"Unlinked Scratch Edit"');
      expect(resetBtn?.style.display).toBe('none');
      expect(resetConfirmEl?.style.display).toBe('none');
      expect(unlinkBtn?.style.display).toBe('inline-block');

      // Programmatic Naizo.reset() when fileHandle permission is 'prompt' keeps 'needs-permission' instead of scheduling 'saving'
      handlePerm = 'prompt';
      expect(await Naizo.save()).toBe(false);
      expect(dotEl?.className).toBe('dot needs-permission');
      Naizo.setField('note', 'Edited While Prompt');
      Naizo.reset();
      expect(dotEl?.className).toBe('dot needs-permission');
      expect(dotEl?.dataset.naizoSaving).toBeUndefined();

      // Re-grant permission via #dot click and save new disk state ('Saved V2'), then × Unlink: #reset stays hidden because initialDiskDb advanced
      handlePerm = 'granted';
      Naizo.setField('note', 'Saved V2');
      dotEl?.click();
      await flushMicrotasks(14);
      expect(diskHtml).toContain('"Saved V2"');

      await Naizo.unlink();
      expect(unlinkBtn?.style.display).toBe('none');
      expect(resetBtn?.style.display).toBe('none');

      // Making a new unlinked edit after × Unlink reveals #reset; resetting restores 'Saved V2' (the last saved disk state)
      Naizo.setField('note', 'Post-Unlink Scratch');
      expect(resetBtn?.style.display).toBe('inline-block');
      Naizo.reset();
      expect(Naizo.getField('note')).toBe('Saved V2');
      expect(resetBtn?.style.display).toBe('none');

      // 6. FLIP 4-corner snap drag release + multi-pointer, non-primary button, pointercancel, releasePointerCapture, and drag-click suppression
      pickerSpy.mockClear();
      const releaseSpy = vi.fn();
      if (pillEl) {
        pillEl.setPointerCapture = vi.fn();
        pillEl.releasePointerCapture = releaseSpy;
      }
      const makeRect = (left: number, top: number): DOMRect => ({
        left,
        top,
        right: left + 146,
        bottom: top + 30,
        width: 146,
        height: 30,
        x: left,
        y: top,
        toJSON: () => ({}),
      });
      let simulatedCornerRect: DOMRect = makeRect(840, 720);
      if (anchorEl) {
        vi.spyOn(anchorEl, 'getBoundingClientRect').mockImplementation(() => simulatedCornerRect);
      }

      const makeDragEv = (
        type: string,
        clientX: number,
        clientY: number,
        opts: { pointerId?: number; button?: number; pointerType?: string } = {},
      ) => {
        const ev = new MouseEvent(type, {
          bubbles: true,
          clientX,
          clientY,
          button: opts.button ?? 0,
        }) as PointerEvent;
        Object.defineProperty(ev, 'pointerId', { value: opts.pointerId ?? 7 });
        Object.defineProperty(ev, 'pointerType', { value: opts.pointerType ?? 'mouse' });
        return ev;
      };

      // Non-primary mouse button (button: 2) is ignored
      dotEl?.dispatchEvent(makeDragEv('pointerdown', 900, 730, { button: 2 }));
      pillEl?.dispatchEvent(makeDragEv('pointermove', 50, 50, { button: 2 }));
      expect(host?.getAttribute('data-naizo-dragging')).toBeNull();

      // Start primary drag with pointerId: 7; pointermove from pointerId: 99 is ignored
      dotEl?.dispatchEvent(makeDragEv('pointerdown', 900, 730, { pointerId: 7 }));
      pillEl?.dispatchEvent(makeDragEv('pointermove', 50, 50, { pointerId: 99 }));
      expect(host?.getAttribute('data-naizo-dragging')).toBeNull();

      // Move pointerId: 7 to top-left; pointercancel reverts without overwriting saved bottom-right corner
      pillEl?.dispatchEvent(makeDragEv('pointermove', 50, 50, { pointerId: 7 }));
      expect(host?.getAttribute('data-naizo-dragging')).toBe('1');
      pillEl?.dispatchEvent(makeDragEv('pointercancel', 0, 0, { pointerId: 7 }));
      expect(releaseSpy).toHaveBeenCalledWith(7);
      expect(anchorEl?.dataset.corner).toBe('bottom-right');

      // Real drag to top-left with FLIP transition + suppressed trailing #dot click
      const appliedTransforms: string[] = [];
      if (anchorEl) {
        const origStyle = anchorEl.style;
        const setPropSpy = vi.spyOn(origStyle, 'transform', 'set');
        setPropSpy.mockImplementation((val: string) => {
          appliedTransforms.push(val);
        });
      }
      dotEl?.dispatchEvent(makeDragEv('pointerdown', 900, 730, { pointerId: 8 }));
      simulatedCornerRect = makeRect(60, 55);
      pillEl?.dispatchEvent(makeDragEv('pointermove', 60, 55, { pointerId: 8 }));
      if (anchorEl) {
        vi.spyOn(anchorEl, 'getBoundingClientRect')
          .mockReturnValueOnce(makeRect(60, 55))
          .mockReturnValueOnce(makeRect(16, 16));
      }
      pillEl?.dispatchEvent(makeDragEv('pointerup', 60, 55, { pointerId: 8 }));
      expect(anchorEl?.dataset.corner).toBe('top-left');
      expect(appliedTransforms).toContain('translate3d(44px, 39px, 0)');
      expect(anchorEl?.classList.contains('is-dragging')).toBe(false);

      // Trailing click right after dragging #dot must NOT invoke showSaveFilePicker
      dotEl?.click();
      expect(pickerSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(80);

      // 7. Online Mode Cmd+S 1200ms #pill-tooltip flash & platform-aware Ctrl+S / ⌘S kbd badge
      document.documentElement.setAttribute('naizo-mode', 'online');
      await initNaizo();
      const onlineShadow = document.getElementById('__naizodb_host__')?.shadowRoot;
      const onlineTip = onlineShadow?.getElementById('pill-tooltip');
      const onlineTipText = onlineShadow?.getElementById('tooltip-text');

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true }),
      );
      expect(onlineTip?.classList.contains('visible')).toBe(true);
      expect(onlineTipText?.textContent).toBe('✓ Saved in Browser');
      vi.advanceTimersByTime(1190);
      expect(onlineTip?.classList.contains('visible')).toBe(true);
      vi.advanceTimersByTime(20);
      expect(onlineTip?.classList.contains('visible')).toBe(false);

      // Platform-aware kbd badge ('Ctrl+S' on Windows/Linux vs '⌘S' on macOS) while keeping '⌘S / Ctrl+S' in .title
      const origPlatform = navigator.platform;
      const origUa = navigator.userAgent;
      Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true,
      });
      try {
        document.documentElement.setAttribute('naizo-mode', 'local');
        await initNaizo();
        const winAction = document
          .getElementById('__naizodb_host__')
          ?.shadowRoot?.getElementById('action') as HTMLButtonElement | null;
        expect(winAction?.dataset.kbd).toBe('Ctrl+S');
        expect(winAction?.title).toContain('⌘S / Ctrl+S');
      } finally {
        Object.defineProperty(navigator, 'platform', { value: origPlatform, configurable: true });
        Object.defineProperty(navigator, 'userAgent', { value: origUa, configurable: true });
      }

      // 8. Shipped dist/naizo.js & dist/naizo.min.js bundle parity + < 100 KB raw dist/naizo.min.js size guardrail
      const minBundleBytes = readFileSync(resolve(process.cwd(), 'dist/naizo.min.js'));
      const minGzipBytes = gzipSync(minBundleBytes, { level: 9 });
      expect(minBundleBytes.byteLength).toBeLessThan(100_000);
      expect(minGzipBytes.byteLength).toBeLessThan(30_000);

      window.__naizoCleanup?.();
      expect(mqDarkListeners.size).toBe(0);
      document.documentElement.setAttribute('data-naizo-manual', 'true');
      document.documentElement.setAttribute('naizo-mode', 'local');
      runInThisContext(minBundleBytes.toString('utf-8'));
      await window.Naizo.init();

      const minShadow = document.getElementById('__naizodb_host__')?.shadowRoot;
      const minDot = minShadow?.getElementById('dot');
      const minReset = minShadow?.getElementById('reset') as HTMLButtonElement | null;
      expect(minDot?.querySelector('rect.c-top')?.getAttribute('width')).toBe('22');
      expect(minDot?.querySelector('rect.c-top')?.getAttribute('rx')).toBe('4.5');
      expect(minReset?.style.display).toBe('none');
      window.Naizo.setField('note', 'Minified Unlinked Edit');
      expect(minReset?.style.display).toBe('inline-block');
    } finally {
      window.matchMedia = origMatchMedia;
      perfSpy.mockRestore();
      window.__naizoCleanup?.();
      Reflect.deleteProperty(window, 'showSaveFilePicker');
      document.documentElement.removeAttribute('naizo-id');
      document.documentElement.removeAttribute('naizo-mode');
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.removeAttribute('data-naizo-manual');
      window.Naizo = Naizo;
      window.NaizoDB = NaizoDB;
      vi.useRealTimers();
    }
  });

  it('supports naizo-no-pill / data-naizo-no-pill headless mode, Naizo.link(): Promise<boolean>, startupInvalidDb headless console.warn, and shipped dist/naizo.js parity (M12.1, D08, D56, EC02, EC04, EC33, EC47, EC53)', async () => {
    vi.useFakeTimers();
    const origIndexedDB = globalThis.indexedDB;
    const idbHandles = new Map<string, unknown>();
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
                  get: (key: string) => {
                    const getReq: { result: unknown; onsuccess: null | (() => void) } = {
                      result: idbHandles.get(key),
                      onsuccess: null,
                    };
                    queueMicrotask(() => getReq.onsuccess?.());
                    return getReq;
                  },
                  put: (val: unknown, key: string) => {
                    idbHandles.set(key, val);
                    return {};
                  },
                  delete: (key: string) => {
                    idbHandles.delete(key);
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

    const flushMicrotasks = async (ticks = 12): Promise<void> => {
      for (let i = 0; i < ticks; i += 1) {
        await Promise.resolve();
      }
    };

    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === 'https://api.example.com/kiosk-status') {
        return new Response(JSON.stringify({ headline: 'Live Kiosk Feed' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      // Verify TypeScript declaration surface includes link(): Promise<boolean>
      const dtsText = readFileSync(resolve(process.cwd(), 'dist/index.d.mts'), 'utf-8');
      expect(dtsText).toContain('link(): Promise<boolean>;');
      expect(typeof Naizo.link).toBe('function');
      expect(typeof NaizoDB.link).toBe('function');
      expect(NaizoDB).toBe(Naizo);

      // 1. Dual-attribute precedence (body over html) & explicit "false" opt-out
      document.documentElement.setAttribute('naizo-id', 'm12-1-headless-suite');
      document.documentElement.setAttribute('naizo-mode', 'local');
      document.head.innerHTML = `<script id="naizodb" type="application/json">
{
  "_meta": {},
  "fields": { "headline": "Initial Kiosk" },
  "lists": { "items": [{ "label": "Row A" }] },
  "custom": {}
}
</script>`;
      document.body.innerHTML = `
        <div id="__naizodb_host__" data-stale="1">Stale host</div>
        <input id="headline-in" type="text" naizo="headline" value="Initial Kiosk" />
        <ul naizo-list="items">
          <li naizo-item><label><input type="text" naizo="label" /></label></li>
        </ul>
        <button id="btn-kiosk-fetch" type="button" naizo-get="https://api.example.com/kiosk-status" naizo-path="headline" naizo-into="field:headline">Refresh</button>
      `;

      // Bare <html naizo-no-pill> removes pre-existing #__naizodb_host__ while injecting #__naizodb_styles__
      document.documentElement.setAttribute('naizo-no-pill', '');
      await initNaizo();
      expect(document.getElementById('__naizodb_host__')).toBeNull();
      expect(document.getElementById('__naizodb_styles__')).not.toBeNull();

      // Explicit "false" on <body> overrides <html naizo-no-pill> and mounts the pill
      document.body.setAttribute('data-naizo-no-pill', 'false');
      await initNaizo();
      expect(document.getElementById('__naizodb_host__')).not.toBeNull();

      // Explicit "false" on <html> with no <body> attr also opts out and mounts the pill
      document.body.removeAttribute('data-naizo-no-pill');
      document.documentElement.setAttribute('naizo-no-pill', 'FALSE');
      await initNaizo();
      expect(document.getElementById('__naizodb_host__')).not.toBeNull();

      // <body data-naizo-no-pill> overrides <html naizo-no-pill="false">, tearing down the mounted pill & resetting refs
      document.body.setAttribute('data-naizo-no-pill', '');
      await initNaizo();
      expect(document.getElementById('__naizodb_host__')).toBeNull();
      expect(document.getElementById('__naizodb_styles__')).not.toBeNull();

      // <html naizo-no-pill="true"> also hides the pill
      document.body.removeAttribute('data-naizo-no-pill');
      document.documentElement.setAttribute('naizo-no-pill', 'true');
      await initNaizo();
      expect(document.getElementById('__naizodb_host__')).toBeNull();

      // 2. List CRUD, Escape keydown, declarative naizo-get + Naizo.fetch() without #net crash, and Online Mode Cmd+S without tooltip crash
      const addBtn = document.querySelector<HTMLButtonElement>('[naizo-add="items"]');
      expect(addBtn).not.toBeNull();
      addBtn?.click();
      expect(Naizo.getList('items')).toHaveLength(2);
      Naizo.updateItem('items', 1, { label: 'Row B' });
      Naizo.moveItem('items', 1, 0);
      expect(Naizo.getList('items')[0]?.label).toBe('Row B');
      Naizo.removeItem('items', 1);
      expect(Naizo.getList('items')).toEqual([{ label: 'Row B' }]);

      const escEvt = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(escEvt);
      expect(escEvt.defaultPrevented).toBe(false);

      document.getElementById('btn-kiosk-fetch')?.click();
      await flushMicrotasks();
      vi.advanceTimersByTime(650);
      expect(Naizo.getField('headline')).toBe('Live Kiosk Feed');

      const failFetchRes = await Naizo.fetch('https://api.example.com/down', {
        into: 'field:headline',
      });
      expect(failFetchRes.ok).toBe(false);
      expect(Naizo.getField('headline')).toBe('Live Kiosk Feed');

      // Online Mode Cmd+S flushes localStorage cleanly with no pill or tooltip timer crash
      document.documentElement.setAttribute('naizo-mode', 'online');
      await initNaizo();
      expect(document.getElementById('__naizodb_host__')).toBeNull();
      const headlineIn = document.getElementById('headline-in') as HTMLInputElement;
      headlineIn.value = 'Online Headless CmdS';
      headlineIn.dispatchEvent(new Event('input', { bubbles: true }));

      const onlineCmdS = new KeyboardEvent('keydown', {
        key: 's',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(onlineCmdS);
      expect(onlineCmdS.defaultPrevented).toBe(true);
      vi.advanceTimersByTime(1500);
      expect(localStorage.getItem('naizodb_state_/::m12-1-headless-suite')).toContain(
        'Online Headless CmdS',
      );

      // 3. Local Mode headless persistence: Naizo.link(), Cmd+S / Ctrl+S, ~2s watch + 3-way merge, and tab-hide flush
      document.documentElement.setAttribute('naizo-mode', 'local');
      await initNaizo();
      expect(document.getElementById('__naizodb_host__')).toBeNull();

      let diskHtml = `<!doctype html><html naizo-no-pill="true"><head><script id="naizodb" type="application/json">\n${JSON.stringify(
        {
          _meta: {},
          fields: { headline: 'Online Headless CmdS' },
          lists: { items: [{ label: 'Row B' }] },
          custom: {},
        },
        null,
        2,
      )}\n</script></head><body></body></html>`;
      let diskMtime = 4000;
      let handlePerm: PermissionState = 'granted';
      let failWrite = false;

      const requestPermSpy = vi.fn().mockImplementation(async () => handlePerm);
      const pickerSpy = vi.fn().mockResolvedValue({
        queryPermission: vi.fn().mockImplementation(async () => handlePerm),
        requestPermission: requestPermSpy,
        getFile: vi.fn().mockImplementation(async () => ({
          lastModified: diskMtime,
          arrayBuffer: async () => new TextEncoder().encode(diskHtml).buffer,
          text: async () => diskHtml,
        })),
        createWritable: vi.fn().mockImplementation(async () => {
          if (failWrite) {
            throw new Error('Disk write failed');
          }
          return {
            write: async (data: string) => {
              diskHtml = data;
              diskMtime += 100;
            },
            close: async () => {},
          };
        }),
      });

      // Non-FSAA fallback (EC02): Naizo.link() triggers downloadHTML() and returns false
      Reflect.deleteProperty(window, 'showSaveFilePicker');
      const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:headless-snap');
      const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const anchorClickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});
      expect(await Naizo.link()).toBe(false);
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      createUrlSpy.mockRestore();
      revokeUrlSpy.mockRestore();
      anchorClickSpy.mockRestore();

      // Cancelled showSaveFilePicker: Naizo.link() returns false
      window.showSaveFilePicker = vi
        .fn()
        .mockRejectedValueOnce(new DOMException('User cancelled', 'AbortError'));
      expect(await Naizo.link()).toBe(false);

      // Granted showSaveFilePicker + completed writeToDisk: Naizo.link() returns true & persists handle in NaizoDB_Handles
      window.showSaveFilePicker = pickerSpy;
      Naizo.setField('headline', 'Linked Headless V1');
      expect(await Naizo.link()).toBe(true);
      expect(pickerSpy).toHaveBeenCalledTimes(1);
      expect(diskHtml).toContain('"Linked Headless V1"');
      expect(idbHandles.has('naizodb_state_/::m12-1-headless-suite')).toBe(true);

      // Booting again with naizo-no-pill auto-resumes persisted IndexedDB handle without re-prompting showSaveFilePicker
      await initNaizo();
      await flushMicrotasks(14);
      expect(document.getElementById('__naizodb_host__')).toBeNull();
      Naizo.setField('headline', 'Auto Resumed Headless Save');
      expect(await Naizo.save()).toBe(true);
      expect(pickerSpy).toHaveBeenCalledTimes(1);
      expect(diskHtml).toContain('"Auto Resumed Headless Save"');

      // Failed writeToDisk: Naizo.link() returns false
      const warnWriteSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      Naizo.setField('headline', 'Dirty Before Failed Write');
      failWrite = true;
      expect(await Naizo.link()).toBe(false);
      failWrite = false;
      warnWriteSpy.mockRestore();

      // Permission 'denied' / 'prompt' / thrown SecurityError on existing fileHandle: returns false without re-opening showSaveFilePicker
      handlePerm = 'denied';
      expect(await Naizo.link()).toBe(false);
      expect(pickerSpy).toHaveBeenCalledTimes(1);

      requestPermSpy.mockRejectedValueOnce(new DOMException('No user gesture', 'SecurityError'));
      expect(await Naizo.link()).toBe(false);
      expect(pickerSpy).toHaveBeenCalledTimes(1);

      // Resuming permission via Cmd+S in headless mode invokes requestPermission and writes to disk
      handlePerm = 'granted';
      headlineIn.value = 'Resumed By Headless CmdS';
      headlineIn.dispatchEvent(new Event('input', { bubbles: true }));
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true }),
      );
      await flushMicrotasks(14);
      expect(requestPermSpy).toHaveBeenCalled();
      expect(diskHtml).toContain('"Resumed By Headless CmdS"');

      // Ctrl+S when already granted flushes immediately via Naizo.save()
      headlineIn.value = 'Saved By Headless CtrlS';
      headlineIn.dispatchEvent(new Event('input', { bubbles: true }));
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }),
      );
      await flushMicrotasks(14);
      expect(diskHtml).toContain('"Saved By Headless CtrlS"');

      // ~2s external disk watch + 3-way shallow merge works with no pill mounted
      const agentEditJson = JSON.stringify(
        {
          _meta: {},
          fields: { headline: 'Saved By Headless CtrlS', agent_note: 'Added on disk' },
          lists: { items: [{ label: 'Row B' }] },
          custom: { fromAgent: 7 },
        },
        null,
        2,
      );
      diskHtml = `<!doctype html><html naizo-no-pill="true"><head><script id="naizodb" type="application/json">\n${agentEditJson}\n</script></head><body></body></html>`;
      diskMtime += 500;
      vi.advanceTimersByTime(2100);
      await flushMicrotasks(14);
      expect(Naizo.getField('agent_note')).toBe('Added on disk');
      expect(Naizo.get('fromAgent')).toBe(7);

      // visibilitychange: hidden flushes pending debounced edit to disk immediately
      headlineIn.value = 'Flushed On Headless Hide';
      headlineIn.dispatchEvent(new Event('input', { bubbles: true }));
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await flushMicrotasks(14);
      expect(diskHtml).toContain('"Flushed On Headless Hide"');
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

      // Unlink and verify Local Mode Cmd+S from unlinked state invokes showSaveFilePicker with no pill
      await Naizo.unlink();
      pickerSpy.mockClear();
      headlineIn.value = 'Relinked Via Unlinked CmdS';
      headlineIn.dispatchEvent(new Event('input', { bubbles: true }));
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true }),
      );
      await flushMicrotasks(14);
      expect(pickerSpy).toHaveBeenCalledTimes(1);
      expect(diskHtml).toContain('"Relinked Via Unlinked CmdS"');

      // 4. Export preservation in Naizo.exportHTML() and Naizo.downloadHTML()
      document.body.setAttribute('data-naizo-no-pill', '');
      const exportedLocal = Naizo.exportHTML();
      const exportedLocalDoc = new DOMParser().parseFromString(exportedLocal, 'text/html');
      expect(exportedLocalDoc.documentElement.getAttribute('naizo-no-pill')).toBe('true');
      expect(exportedLocalDoc.body.hasAttribute('data-naizo-no-pill')).toBe(true);
      expect(exportedLocalDoc.getElementById('__naizodb_host__')).toBeNull();
      expect(exportedLocalDoc.getElementById('__naizodb_styles__')).toBeNull();

      const dlCreateSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dl-preserve');
      const dlRevokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const dlClickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});
      const downloadedHtml = Naizo.downloadHTML('kiosk.html');
      dlCreateSpy.mockRestore();
      dlRevokeSpy.mockRestore();
      dlClickSpy.mockRestore();
      const downloadedDoc = new DOMParser().parseFromString(downloadedHtml, 'text/html');
      expect(downloadedDoc.documentElement.getAttribute('naizo-no-pill')).toBe('true');
      expect(downloadedDoc.body.hasAttribute('data-naizo-no-pill')).toBe(true);

      // 5. startupInvalidDb (EC04 / EC33) under naizo-no-pill emits console.warn once per boot & Naizo.link() returns false
      await Naizo.unlink();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const dbEl = document.getElementById('naizodb');
        if (dbEl) dbEl.textContent = '{ malformed headless json';
        await initNaizo();

        const headlessRepairWarnings = warnSpy.mock.calls.filter((args) =>
          String(args[0] ?? '').includes('Repair JSON'),
        );
        expect(headlessRepairWarnings).toHaveLength(1);
        expect(String(headlessRepairWarnings[0]?.[0])).toContain('<script id="naizodb">');
        expect(String(headlessRepairWarnings[0]?.[0])).toContain('automatic writes are paused');
        expect(String(headlessRepairWarnings[0]?.[0])).toContain('naizo-no-pill');
        expect(String(headlessRepairWarnings[0]?.[0])).toContain('data-naizo-no-pill');

        // Subsequent save / link attempts return false and do NOT re-emit the boot warning
        expect(await Naizo.save()).toBe(false);
        expect(await Naizo.link()).toBe(false);
        expect(
          warnSpy.mock.calls.filter((args) => String(args[0] ?? '').includes('Repair JSON')),
        ).toHaveLength(1);

        // Removing naizo-no-pill / data-naizo-no-pill exposes the Repair JSON button without emitting the headless warning
        warnSpy.mockClear();
        document.documentElement.removeAttribute('naizo-no-pill');
        document.body.removeAttribute('data-naizo-no-pill');
        await initNaizo();
        expect(
          warnSpy.mock.calls.filter((args) => String(args[0] ?? '').includes('Repair JSON')),
        ).toHaveLength(0);
        const restoredShadow = document.getElementById('__naizodb_host__')?.shadowRoot;
        expect(restoredShadow?.getElementById('restore')?.dataset.tip).toBe('Repair JSON');
      } finally {
        warnSpy.mockRestore();
      }

      // 6. Shipped dist/naizo.js IIFE bundle parity for data-naizo-no-pill & window.Naizo.link / window.NaizoDB.link
      window.__naizoCleanup?.();
      document.documentElement.setAttribute('data-naizo-manual', 'true');
      document.documentElement.removeAttribute('naizo-no-pill');
      document.body.setAttribute('data-naizo-no-pill', '');
      document.head.innerHTML = `<script id="naizodb" type="application/json">{"_meta":{},"fields":{"k":"bundle-v0"},"lists":{},"custom":{}}</script>`;
      document.body.innerHTML = `<input id="bundle-k" type="text" naizo="k" value="bundle-v0" />`;

      runInThisContext(iifeBundleCode);
      const bundleNaizo = window.Naizo;
      expect(typeof bundleNaizo.link).toBe('function');
      expect(typeof window.NaizoDB.link).toBe('function');
      expect(window.NaizoDB).toBe(bundleNaizo);

      await bundleNaizo.init();
      expect(document.getElementById('__naizodb_host__')).toBeNull();
      expect(document.getElementById('__naizodb_styles__')).not.toBeNull();

      let bundleDiskHtml = `<!doctype html><html><head><script id="naizodb" type="application/json">{"_meta":{},"fields":{"k":"bundle-v0"},"lists":{},"custom":{}}</script></head><body data-naizo-no-pill></body></html>`;
      window.showSaveFilePicker = vi
        .fn()
        .mockRejectedValueOnce(new DOMException('Cancel', 'AbortError'))
        .mockResolvedValue({
          queryPermission: vi.fn().mockResolvedValue('granted'),
          requestPermission: vi.fn().mockResolvedValue('granted'),
          getFile: vi.fn().mockImplementation(async () => ({
            lastModified: 9000,
            text: async () => bundleDiskHtml,
          })),
          createWritable: vi.fn().mockImplementation(async () => ({
            write: async (data: string) => {
              bundleDiskHtml = data;
            },
            close: async () => {},
          })),
        });

      expect(await bundleNaizo.link()).toBe(false);
      bundleNaizo.setField('k', 'bundle-linked-ok');
      expect(await bundleNaizo.link()).toBe(true);
      expect(bundleDiskHtml).toContain('"bundle-linked-ok"');
      expect(bundleNaizo.exportHTML()).toContain('data-naizo-no-pill');

      await bundleNaizo.unlink();
      const bundleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const bundleDbEl = document.getElementById('naizodb');
        if (bundleDbEl) bundleDbEl.textContent = '[]';
        await bundleNaizo.init();
        expect(await bundleNaizo.link()).toBe(false);
        expect(
          bundleWarnSpy.mock.calls.some((args) => String(args[0] ?? '').includes('Repair JSON')),
        ).toBe(true);
      } finally {
        bundleWarnSpy.mockRestore();
      }
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: origIndexedDB,
      });
      window.__naizoCleanup?.();
      Reflect.deleteProperty(window, 'showSaveFilePicker');
      document.documentElement.removeAttribute('naizo-id');
      document.documentElement.removeAttribute('naizo-mode');
      document.documentElement.removeAttribute('naizo-no-pill');
      document.documentElement.removeAttribute('data-naizo-no-pill');
      document.documentElement.removeAttribute('data-naizo-manual');
      document.body.removeAttribute('naizo-no-pill');
      document.body.removeAttribute('data-naizo-no-pill');
      window.Naizo = Naizo;
      window.NaizoDB = NaizoDB;
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('implements M13.1 naizo:change list index/action/source symmetry, FIFO non-reentrant queue + 10-pass cycle cap, and nestable Naizo.batch() (M13.1, D57, EC49, EC54)', async () => {
    vi.useFakeTimers();
    const recordedDetails: Array<Record<string, unknown>> = [];
    const onChange = (e: Event) => {
      recordedDetails.push({ ...(e as CustomEvent<Record<string, unknown>>).detail });
    };
    window.addEventListener('naizo:change', onChange);

    try {
      // TypeScript declaration & runtime ESM export surface (EC49)
      const dtsText = readFileSync(resolve(process.cwd(), 'dist/index.d.mts'), 'utf-8');
      expect(dtsText).toContain('interface NaizoBatchOptions');
      expect(dtsText).toContain('silent?: boolean;');
      expect(dtsText).toContain('deferPersist?: boolean;');
      expect(dtsText).toContain('batch<T>(fn: () => T, options?: NaizoBatchOptions): T;');
      expect(dtsText).toContain('ready(callback: (db: NaizoDatabase) => void): void;');
      expect(Object.keys(NaizoModule).sort()).toEqual(['Naizo', 'NaizoDB', 'initNaizo']);
      expect(typeof Naizo.batch).toBe('function');
      expect(typeof NaizoDB.batch).toBe('function');

      document.documentElement.setAttribute('naizo-id', 'm13-1-events-batch');
      document.head.innerHTML = `<script id="naizodb" type="application/json">
{
  "_meta": {},
  "fields": { "headline": "Initial", "scrub": 10 },
  "lists": {
    "tasks": [
      { "id": "t0", "title": "First", "done": false },
      { "id": "t1", "title": "Second", "done": false }
    ],
    "unbound": [{ "id": "u0" }]
  },
  "custom": { "count": 0 }
}
</script>`;
      document.body.innerHTML = `
        <form id="m13-form">
          <input id="headline-in" type="text" naizo="headline" value="Reset Headline" />
          <span id="headline-mirror" naizo="headline"></span>
          <input id="scrub-in" type="range" min="0" max="100" naizo="scrub" value="10" />
          <div naizo-list="tasks">
            <template naizo-template>
              <div naizo-item>
                <label><input type="checkbox" naizo="done" /></label>
                <label><input type="text" naizo="title" value="New Task" /></label>
                <span class="row-title-mirror" naizo="title"></span>
              </div>
            </template>
          </div>
        </form>
      `;

      await initNaizo();
      recordedDetails.length = 0;

      // 1. DOM list edit includes action: 'update', exact current index (even after moveItem), key, value, & source: 'dom'
      Naizo.moveItem('tasks', 0, 1);
      expect(recordedDetails).toHaveLength(1);
      expect(recordedDetails[0]).toMatchObject({
        scope: 'lists',
        action: 'move',
        list: 'tasks',
        fromIndex: 0,
        toIndex: 1,
        source: 'api',
      });
      recordedDetails.length = 0;

      const rowInputs = document.querySelectorAll<HTMLInputElement>(
        '[naizo-list="tasks"] [naizo-item] input[naizo="title"]',
      );
      expect(rowInputs).toHaveLength(2);
      rowInputs[1]!.value = 'First Edited In DOM';
      rowInputs[1]!.dispatchEvent(new Event('input', { bubbles: true }));
      expect(recordedDetails).toHaveLength(1);
      expect(recordedDetails[0]).toMatchObject({
        scope: 'lists',
        action: 'update',
        list: 'tasks',
        index: 1,
        key: 'title',
        value: 'First Edited In DOM',
        source: 'dom',
      });

      // Standalone DOM field edit & <form>.reset() emit source: 'dom'
      recordedDetails.length = 0;
      const headlineIn = document.getElementById('headline-in') as HTMLInputElement;
      headlineIn.value = 'Edited Headline';
      headlineIn.dispatchEvent(new Event('input', { bubbles: true }));
      expect(recordedDetails).toHaveLength(1);
      expect(recordedDetails[0]).toMatchObject({
        scope: 'fields',
        key: 'headline',
        value: 'Edited Headline',
        source: 'dom',
      });

      recordedDetails.length = 0;
      (document.getElementById('m13-form') as HTMLFormElement).reset();
      vi.advanceTimersByTime(5);
      expect(recordedDetails).toHaveLength(1);
      expect(recordedDetails[0]).toMatchObject({
        scope: 'reset',
        source: 'dom',
      });

      // Programmatic Naizo.* & fetch({ into: 'db' }) mutations emit source: 'api' across every call site
      recordedDetails.length = 0;
      Naizo.set('count', 1);
      Naizo.delete('count');
      Naizo.setField('temp', 'v');
      Naizo.deleteField('temp');
      Naizo.addItem('unbound', { id: 'u1' });
      Naizo.addItem('tasks', { id: 't2', title: 'Third', done: true });
      Naizo.updateItem('tasks', 2, { title: 'Third API' });
      Naizo.removeItem('tasks', 2);
      Naizo.setList('tasks', [
        { id: 't0', title: 'First', done: false },
        { id: 't1', title: 'Second', done: false },
      ]);
      Naizo.reset();

      const fetchDbMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            _meta: {},
            fields: { headline: 'From Fetch DB', scrub: 20 },
            lists: {
              tasks: [
                { id: 't0', title: 'First', done: false },
                { id: 't1', title: 'Second', done: false },
              ],
            },
            custom: { count: 5 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
      vi.stubGlobal('fetch', fetchDbMock);
      await Naizo.fetch('https://api.example.com/db', { into: 'db' });
      vi.advanceTimersByTime(700);
      vi.unstubAllGlobals();

      expect(recordedDetails.length).toBe(11);
      for (const detail of recordedDetails) {
        expect(detail.source).toBe('api');
      }
      expect(recordedDetails.at(-1)).toMatchObject({
        scope: 'db',
        action: 'set',
        source: 'api',
      });

      // 2. Non-reentrant FIFO dispatchChangeEvent() queue: outer listener finishes before queued follow-ups run
      recordedDetails.length = 0;
      const executionOrder: string[] = [];
      const reentrantListener = (e: Event) => {
        const d = (
          e as CustomEvent<{ scope?: string; key?: string; action?: string; value?: unknown }>
        ).detail;
        const step = `${d.scope ?? ''}:${d.key ?? d.action ?? ''}`;
        executionOrder.push(`enter:${step}`);
        if (d.scope === 'fields' && d.key === 'headline' && d.value === 'Trigger Chain') {
          Naizo.set('derivedA', 'A1');
          Naizo.set('derivedB', 'B1');
          executionOrder.push('after-enqueue:fields:headline');
        } else if (d.scope === 'custom' && d.key === 'derivedA') {
          Naizo.set('derivedC', 'C1');
        }
        executionOrder.push(`exit:${step}`);
      };
      window.addEventListener('naizo:change', reentrantListener);
      try {
        Naizo.setField('headline', 'Trigger Chain');
        expect(executionOrder).toEqual([
          'enter:fields:headline',
          'after-enqueue:fields:headline',
          'exit:fields:headline',
          'enter:custom:derivedA',
          'exit:custom:derivedA',
          'enter:custom:derivedB',
          'exit:custom:derivedB',
          'enter:custom:derivedC',
          'exit:custom:derivedC',
        ]);
      } finally {
        window.removeEventListener('naizo:change', reentrantListener);
      }

      // 1-pass fan-out of > 10 updates drains all 12 items without false-positive cycle warning
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const twelveItems = Array.from({ length: 12 }, (_, idx) => ({
        id: `item-${idx}`,
        title: `Task ${idx}`,
        done: false,
      }));
      Naizo.setList('tasks', twelveItems);
      recordedDetails.length = 0;

      const fanOutListener = (e: Event) => {
        const d = (e as CustomEvent<Record<string, unknown>>).detail;
        if (d.scope === 'fields' && d.key === 'headline' && d.value === 'Mark All Done') {
          for (let i = 0; i < 12; i += 1) {
            Naizo.updateItem('tasks', i, { done: true });
          }
        }
      };
      window.addEventListener('naizo:change', fanOutListener);
      try {
        Naizo.setField('headline', 'Mark All Done');
        expect(recordedDetails).toHaveLength(13);
        expect(warnSpy).not.toHaveBeenCalled();
        expect(Naizo.getList('tasks').every((t) => t.done === true)).toBe(true);
      } finally {
        window.removeEventListener('naizo:change', fanOutListener);
      }

      // Infinite cycle stops at MAX_REENTRANT_CHANGE_PASSES = 10 with console.warn & clean recovery
      recordedDetails.length = 0;
      let cycleCounter = 0;
      const infiniteListener = () => {
        cycleCounter += 1;
        Naizo.set('loopCounter', cycleCounter);
      };
      window.addEventListener('naizo:change', infiniteListener);
      try {
        Naizo.set('loopCounter', 0);
        // 1 initial dispatch + 10 re-entrant passes = 11 total listener invocations
        expect(cycleCounter).toBe(11);
        expect(recordedDetails).toHaveLength(11);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(String(warnSpy.mock.calls[0]?.[0] ?? '')).toContain(
          '10 re-entrant naizo:change passes',
        );
      } finally {
        window.removeEventListener('naizo:change', infiniteListener);
        warnSpy.mockRestore();
      }

      // Subsequent normal dispatch after cycle cap still works cleanly
      recordedDetails.length = 0;
      Naizo.set('healthyAgain', true);
      expect(recordedDetails).toHaveLength(1);
      expect(recordedDetails[0]).toMatchObject({
        scope: 'custom',
        key: 'healthyAgain',
        value: true,
        source: 'api',
      });

      // 3. Synchronous nestable Naizo.batch<T>(fn, options?)
      recordedDetails.length = 0;
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      try {
        // No-op batch: 0 persistence writes & 0 events
        const noopReturn = Naizo.batch(() => 'unchanged');
        expect(noopReturn).toBe('unchanged');
        expect(setItemSpy).not.toHaveBeenCalled();
        expect(recordedDetails).toHaveLength(0);

        // Nested multi-scope batch: synchronous store + DOM inside fn(), 1 flush + 1 batch event on outermost exit
        const batchReturn = Naizo.batch(() => {
          Naizo.setField('headline', 'Batched Headline');
          expect(Naizo.getField('headline')).toBe('Batched Headline');
          expect(document.getElementById('headline-mirror')?.textContent).toBe('Batched Headline');
          expect(setItemSpy).not.toHaveBeenCalled();
          expect(recordedDetails).toHaveLength(0);

          Naizo.batch(() => {
            Naizo.updateItem('tasks', 0, { title: 'Batched Row 0' });
            Naizo.addItem('tasks', { id: 'item-12', title: 'Batched Row 12', done: true });
            expect(
              document.querySelectorAll('[naizo-list="tasks"] [naizo-item] .row-title-mirror')[0]
                ?.textContent,
            ).toBe('Batched Row 0');
            expect(document.querySelectorAll('[naizo-list="tasks"] > [naizo-item]').length).toBe(
              13,
            );
            expect(setItemSpy).not.toHaveBeenCalled();
            expect(recordedDetails).toHaveLength(0);
          });

          // Still inside outer batch: nothing flushed or emitted yet
          expect(setItemSpy).not.toHaveBeenCalled();
          expect(recordedDetails).toHaveLength(0);
          return Naizo.getList('tasks').length;
        });

        expect(batchReturn).toBe(13);
        expect(setItemSpy).toHaveBeenCalledTimes(1);
        expect(readScriptDb().fields.headline).toBe('Batched Headline');
        expect(recordedDetails).toHaveLength(1);
        expect(recordedDetails[0]).toMatchObject({
          scope: 'batch',
          action: 'batch',
          source: 'api',
        });

        // silent: true batch & outer batch wrapping only silent inner mutations suppress naizo:change while persisting
        setItemSpy.mockClear();
        recordedDetails.length = 0;
        const silentOpts: NaizoBatchOptions = { silent: true };
        Naizo.batch(() => {
          Naizo.set('silentKey', 's1');
        }, silentOpts);
        expect(setItemSpy).toHaveBeenCalledTimes(1);
        expect(Naizo.get('silentKey')).toBe('s1');
        expect(recordedDetails).toHaveLength(0);

        setItemSpy.mockClear();
        Naizo.batch(() => {
          Naizo.batch(
            () => {
              Naizo.set('silentNestedOnly', 's2');
            },
            { silent: true },
          );
        });
        expect(setItemSpy).toHaveBeenCalledTimes(1);
        expect(Naizo.get('silentNestedOnly')).toBe('s2');
        expect(recordedDetails).toHaveLength(0);

        // Mixed outer audible + inner silent batch emits 1 batch event
        setItemSpy.mockClear();
        Naizo.batch(() => {
          Naizo.setField('headline', 'Audible Outer');
          Naizo.batch(
            () => {
              Naizo.set('silentCompanion', 's3');
            },
            { silent: true },
          );
        });
        expect(setItemSpy).toHaveBeenCalledTimes(1);
        expect(recordedDetails).toHaveLength(1);
        expect(recordedDetails[0]).toMatchObject({
          scope: 'batch',
          action: 'batch',
          source: 'api',
        });

        // deferPersist: true coalesces 60fps scrubs onto schedulePersist() and still flushes synchronously on exportHTML / pagehide
        setItemSpy.mockClear();
        recordedDetails.length = 0;
        for (const v of [25, 50, 75]) {
          Naizo.batch(
            () => {
              Naizo.setField('scrub', v);
            },
            { deferPersist: true },
          );
        }
        expect((document.getElementById('scrub-in') as HTMLInputElement).value).toBe('75');
        expect(setItemSpy).not.toHaveBeenCalled();
        expect(recordedDetails).toHaveLength(3);

        // Synchronous flush on exportHTML() before 150ms timer expires
        const exportedMidScrub = Naizo.exportHTML();
        expect(exportedMidScrub).toContain('"scrub": 75');
        expect(setItemSpy).toHaveBeenCalledTimes(1);

        // Synchronous flush on pagehide for another deferred scrub
        setItemSpy.mockClear();
        Naizo.batch(
          () => {
            Naizo.setField('scrub', 90);
          },
          { deferPersist: true },
        );
        expect(setItemSpy).not.toHaveBeenCalled();
        window.dispatchEvent(new Event('pagehide'));
        expect(setItemSpy).toHaveBeenCalledTimes(1);
        expect(readScriptDb().fields.scrub).toBe(90);

        // Synchronous flush on Naizo.copyJSON(), Naizo.save(), Naizo.downloadHTML(), Cmd+S, and 150ms debounce
        setItemSpy.mockClear();
        Naizo.batch(() => Naizo.setField('scrub', 91), { deferPersist: true });
        expect(setItemSpy).not.toHaveBeenCalled();
        expect(await Naizo.copyJSON()).toContain('"scrub": 91');
        expect(setItemSpy).toHaveBeenCalledTimes(1);

        setItemSpy.mockClear();
        Naizo.batch(() => Naizo.setField('scrub', 92), { deferPersist: true });
        expect(setItemSpy).not.toHaveBeenCalled();
        expect(await Naizo.save()).toBe(true);
        expect(setItemSpy).toHaveBeenCalledTimes(1);

        const dlCreate = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:scrub');
        const dlRevoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const dlClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        setItemSpy.mockClear();
        Naizo.batch(() => Naizo.setField('scrub', 93), { deferPersist: true });
        expect(setItemSpy).not.toHaveBeenCalled();
        expect(Naizo.downloadHTML('scrub.html')).toContain('"scrub": 93');
        expect(setItemSpy).toHaveBeenCalledTimes(1);

        document.documentElement.setAttribute('naizo-mode', 'online');
        setItemSpy.mockClear();
        Naizo.batch(() => Naizo.setField('scrub', 94), { deferPersist: true });
        expect(setItemSpy).not.toHaveBeenCalled();
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 's',
            metaKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
        expect(setItemSpy).toHaveBeenCalledTimes(1);
        document.documentElement.removeAttribute('naizo-mode');
        dlCreate.mockRestore();
        dlRevoke.mockRestore();
        dlClick.mockRestore();

        setItemSpy.mockClear();
        Naizo.batch(() => Naizo.setField('scrub', 95), { deferPersist: true });
        expect(setItemSpy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(160);
        expect(setItemSpy).toHaveBeenCalledTimes(1);
        expect(readScriptDb().fields.scrub).toBe(95);

        // Exception safety: thrown error inside batch unwinds batchDepth cleanly
        recordedDetails.length = 0;
        expect(() =>
          Naizo.batch(() => {
            Naizo.set('beforeThrow', true);
            throw new Error('batch-abort');
          }),
        ).toThrow('batch-abort');

        recordedDetails.length = 0;
        Naizo.setField('headline', 'Recovered After Throw');
        expect(recordedDetails).toHaveLength(1);
        expect(recordedDetails[0]).toMatchObject({
          scope: 'fields',
          key: 'headline',
          value: 'Recovered After Throw',
          source: 'api',
        });
      } finally {
        setItemSpy.mockRestore();
      }
    } finally {
      window.removeEventListener('naizo:change', onChange);
      document.documentElement.removeAttribute('naizo-id');
      vi.useRealTimers();
    }
  });

  it('supports blank single <select> selectedIndex = -1 without false warn, interactive-over-passive naizo="key" precedence, Naizo.ready(), naizo-pill-corner, and shipped dist/naizo.js parity (M13.1, D08, D50, D57, EC15, EC19, EC55, EC56, EC57)', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // 1. Naizo.ready() BEFORE initNaizo() (pre-boot) vs AFTER initNaizo() (post-boot) + startupInvalidDb path (EC57)
      window.__naizoCleanup?.();
      document.documentElement.setAttribute('naizo-id', 'm13-1-select-ready-corner');
      document.documentElement.setAttribute('naizo-pill-corner', 'top-right');
      document.body.setAttribute('data-naizo-pill-corner', ' BOTTOM-LEFT ');

      document.head.innerHTML = `<script id="naizodb" type="application/json">
{
  "_meta": {},
  "fields": {
    "blank_sel": "",
    "null_sel": null,
    "unknown_sel": "Shipped"
  },
  "lists": {
    "cards": [
      { "id": "c-boot" }
    ]
  },
  "custom": {}
}
</script>`;
      document.body.innerHTML = `
        <form id="precedence-form">
          <h3 id="standalone-h3" naizo="doc_name">Stale Heading</h3>
          <label><input id="standalone-in" type="text" naizo="doc_name" value="Untitled" /></label>
          <select id="blank-sel" naizo="blank_sel">
            <option value="P0">P0</option>
            <option value="P1">P1</option>
          </select>
          <select id="null-sel" naizo="null_sel">
            <option value="Alpha">Alpha</option>
            <option value="Beta">Beta</option>
          </select>
          <select id="unknown-sel" naizo="unknown_sel">
            <option value="Draft">Draft</option>
            <option value="Review">Review</option>
          </select>
          <div naizo-list="cards">
            <template naizo-template>
              <div naizo-item>
                <h3 class="card-h3" naizo="name"></h3>
                <label><input class="card-in" type="text" naizo="name" value="Untitled" /></label>
              </div>
            </template>
          </div>
          <div id="dynamic-bind-slot"></div>
        </form>
      `;

      const readyCalls: string[] = [];
      Naizo.ready((db) => {
        readyCalls.push(`pre:${String(db.fields.doc_name)}`);
      });
      // Pre-boot: callback has NOT fired yet
      expect(readyCalls).toEqual([]);

      await initNaizo();

      // Pre-boot callback fired once on boot hydration with seeded doc_name = "Untitled"
      expect(readyCalls).toEqual(['pre:Untitled']);

      // Post-boot (<script defer> -> DOMContentLoaded order): Naizo.ready() fires synchronously!
      let ranSynchronously = false;
      Naizo.ready((db) => {
        ranSynchronously = true;
        readyCalls.push(`post:${String(db.fields.doc_name)}`);
      });
      expect(ranSynchronously).toBe(true);
      expect(readyCalls).toEqual(['pre:Untitled', 'post:Untitled']);

      // Subsequent Naizo.reset() dispatches naizo:hydrate, which must NOT re-fire { once: true } ready callbacks
      Naizo.setField('doc_name', 'Temp');
      Naizo.reset();
      expect(readyCalls).toEqual(['pre:Untitled', 'post:Untitled']);

      // 2. Blank single <select> unselect (EC55) vs unknown non-empty value warning (EC15)
      const blankSel = document.getElementById('blank-sel') as HTMLSelectElement;
      const nullSel = document.getElementById('null-sel') as HTMLSelectElement;
      const unknownSel = document.getElementById('unknown-sel') as HTMLSelectElement;

      expect(blankSel.selectedIndex).toBe(-1);
      expect(blankSel.value).toBe('');
      expect(Naizo.getField('blank_sel')).toBe('');

      expect(nullSel.selectedIndex).toBe(-1);
      expect(nullSel.value).toBe('');
      expect(Naizo.getField('null_sel')).toBeNull();

      // Only "Shipped" triggered EC15 console.warn (once on initNaizo and once on Naizo.reset) — neither "" nor null logged false warnings
      const selectWarnings = warnSpy.mock.calls.filter((args) =>
        String(args[0] ?? '').includes('no matching <option>'),
      );
      expect(selectWarnings).toHaveLength(2);
      for (const warnArgs of selectWarnings) {
        expect(String(warnArgs[0])).toContain('"Shipped"');
      }
      expect(Naizo.getField('unknown_sel')).toBe('Shipped');
      expect(unknownSel.value).toBe('Draft');

      // Exported HTML does NOT bake selected="selected" onto Option #0 of unselected blank/null selects
      const exportedDoc = new DOMParser().parseFromString(Naizo.exportHTML(), 'text/html');
      expect(exportedDoc.querySelectorAll('#blank-sel option[selected]').length).toBe(0);
      expect(exportedDoc.querySelectorAll('#null-sel option[selected]').length).toBe(0);

      // User can now select Option #0 ("P0") and fire change cleanly!
      blankSel.selectedIndex = 0;
      blankSel.dispatchEvent(new Event('change', { bubbles: true }));
      expect(Naizo.getField('blank_sel')).toBe('P0');

      // Programmatic reset back to "" unselects again without warning
      warnSpy.mockClear();
      Naizo.setField('blank_sel', '');
      expect(blankSel.selectedIndex).toBe(-1);
      expect(warnSpy).not.toHaveBeenCalled();

      // 3. Interactive-over-passive naizo="key" precedence across boot, addItem({}), Naizo.bind(), & form.reset() (EC56)
      const standaloneH3 = document.getElementById('standalone-h3') as HTMLElement;
      const standaloneIn = document.getElementById('standalone-in') as HTMLInputElement;
      expect(Naizo.getField('doc_name')).toBe('Untitled');
      expect(standaloneIn.value).toBe('Untitled');
      expect(standaloneH3.textContent).toBe('Untitled');

      // Booted card from lists.cards = [{ id: 'c-boot' }] seeded "Untitled" from <input>, NOT "" from preceding <h3>
      expect(Naizo.getList('cards')).toEqual([{ id: 'c-boot', name: 'Untitled' }]);
      expect(document.querySelector('.card-h3')?.textContent).toBe('Untitled');
      expect((document.querySelector('.card-in') as HTMLInputElement | null)?.value).toBe(
        'Untitled',
      );

      // Adding a blank item via Naizo.addItem('cards', {}) also seeds "Untitled" and mirrors onto <h3>
      Naizo.addItem('cards', {});
      const cardRows = document.querySelectorAll<HTMLElement>(
        '[naizo-list="cards"] > [naizo-item]',
      );
      expect(cardRows).toHaveLength(2);
      expect(Naizo.getList('cards')[1]).toEqual({ name: 'Untitled' });
      expect(cardRows[1]?.querySelector('.card-h3')?.textContent).toBe('Untitled');
      expect((cardRows[1]?.querySelector('.card-in') as HTMLInputElement | null)?.value).toBe(
        'Untitled',
      );

      // Typing into <input> live-mirrors onto preceding <h3>; form.reset() restores "Untitled" onto both store and <h3>
      standaloneIn.value = 'Edited Doc';
      standaloneIn.dispatchEvent(new Event('input', { bubbles: true }));
      const secondCardIn = cardRows[1]?.querySelector('.card-in') as HTMLInputElement;
      secondCardIn.value = 'Edited Card';
      secondCardIn.dispatchEvent(new Event('input', { bubbles: true }));
      expect(standaloneH3.textContent).toBe('Edited Doc');
      expect(cardRows[1]?.querySelector('.card-h3')?.textContent).toBe('Edited Card');

      (document.getElementById('precedence-form') as HTMLFormElement).reset();
      vi.advanceTimersByTime(5);
      expect(Naizo.getField('doc_name')).toBe('Untitled');
      expect(standaloneIn.value).toBe('Untitled');
      expect(standaloneH3.textContent).toBe('Untitled');
      expect(Naizo.getList('cards')[1]?.name).toBe('Untitled');
      expect(secondCardIn.value).toBe('Untitled');
      expect(cardRows[1]?.querySelector('.card-h3')?.textContent).toBe('Untitled');

      // Naizo.bind() on dynamically inserted passive-before-interactive subtree
      const dynSlot = document.getElementById('dynamic-bind-slot')!;
      dynSlot.innerHTML = `<span id="dyn-span" naizo="dyn_title"></span><input id="dyn-in" type="text" naizo="dyn_title" value="Dynamic Default" />`;
      Naizo.bind(dynSlot);
      expect(Naizo.getField('dyn_title')).toBe('Dynamic Default');
      expect(document.getElementById('dyn-span')?.textContent).toBe('Dynamic Default');

      // 4. naizo-pill-corner / data-naizo-pill-corner precedence, user drag override in naizodb_ui_<key>, & export preservation (D08, D50, D57)
      const getAnchorCorner = () =>
        document.getElementById('__naizodb_host__')?.shadowRoot?.getElementById('pill-anchor')
          ?.dataset.corner;
      // body data-naizo-pill-corner=" BOTTOM-LEFT " beat html naizo-pill-corner="top-right"
      expect(getAnchorCorner()).toBe('bottom-left');

      // Export & downloadHTML preserve naizo-pill-corner and data-naizo-pill-corner
      const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:corner');
      const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const dlHtml = Naizo.downloadHTML('corner.html');
      createUrlSpy.mockRestore();
      revokeUrlSpy.mockRestore();
      clickSpy.mockRestore();
      for (const htmlOut of [Naizo.exportHTML(), dlHtml]) {
        const docOut = new DOMParser().parseFromString(htmlOut, 'text/html');
        expect(docOut.documentElement.getAttribute('naizo-pill-corner')).toBe('top-right');
        expect(docOut.body.getAttribute('data-naizo-pill-corner')).toBe(' BOTTOM-LEFT ');
      }

      // Removing body attribute falls back to html naizo-pill-corner="top-right"
      document.body.removeAttribute('data-naizo-pill-corner');
      await initNaizo();
      expect(getAnchorCorner()).toBe('top-right');

      // Invalid value ("bottom-center") falls back to 'bottom-right'
      document.body.setAttribute('naizo-pill-corner', 'bottom-center');
      await initNaizo();
      expect(getAnchorCorner()).toBe('bottom-right');

      // User drag persisted in naizodb_ui_<key> overrides valid naizo-pill-corner="bottom-left"
      document.body.setAttribute('naizo-pill-corner', 'bottom-left');
      localStorage.setItem(
        'naizodb_ui_/::m13-1-select-ready-corner',
        JSON.stringify({ corner: 'top-left' }),
      );
      await initNaizo();
      expect(getAnchorCorner()).toBe('top-left');

      // Corrupted or invalid naizodb_ui_<key> falls back to naizo-pill-corner="bottom-left"
      localStorage.setItem('naizodb_ui_/::m13-1-select-ready-corner', '{broken');
      await initNaizo();
      expect(getAnchorCorner()).toBe('bottom-left');
      localStorage.removeItem('naizodb_ui_/::m13-1-select-ready-corner');

      // startupInvalidDb boot path still sets bootHydrated = true and fires Naizo.ready()
      window.__naizoCleanup?.();
      const invalidScript = document.getElementById('naizodb');
      if (invalidScript) invalidScript.textContent = '{ malformed';
      const invalidReady: boolean[] = [];
      Naizo.ready(() => {
        invalidReady.push(true);
      });
      expect(invalidReady).toEqual([]);
      await initNaizo();
      expect(invalidReady).toEqual([true]);
      Naizo.ready(() => {
        invalidReady.push(false);
      });
      expect(invalidReady).toEqual([true, false]);

      // 5. Shipped dist/naizo.js IIFE bundle parity across all 7 M13.1 features
      window.__naizoCleanup?.();
      localStorage.clear();
      document.documentElement.setAttribute('data-naizo-manual', 'true');
      document.documentElement.setAttribute('naizo-id', 'm13-1-bundle-parity');
      document.documentElement.setAttribute('naizo-pill-corner', 'top-left');
      document.body.setAttribute('naizo-pill-corner', 'bottom-left');
      document.head.innerHTML = `<script id="naizodb" type="application/json">{"_meta":{},"fields":{"sel":""},"lists":{"rows":[]},"custom":{}}</script>`;
      document.body.innerHTML = `
        <h3 id="b-h3" naizo="b_title"></h3>
        <input id="b-in" type="text" naizo="b_title" value="Bundle Untitled" />
        <select id="b-sel" naizo="sel"><option value="One">One</option></select>
        <div naizo-list="rows">
          <template naizo-template>
            <div naizo-item>
              <span class="b-row-span" naizo="label"></span>
              <label><input class="b-row-in" type="text" naizo="label" value="Row Default" /></label>
            </div>
          </template>
        </div>
      `;

      runInThisContext(iifeBundleCode);
      const bundleNaizo = window.Naizo;
      expect(typeof bundleNaizo.batch).toBe('function');
      expect(typeof bundleNaizo.ready).toBe('function');
      expect(window.NaizoDB).toBe(bundleNaizo);

      const bundleReadyLog: string[] = [];
      bundleNaizo.ready((db) => {
        bundleReadyLog.push(`pre:${String(db.fields.b_title)}`);
      });
      expect(bundleReadyLog).toEqual([]);

      await bundleNaizo.init();
      expect(bundleReadyLog).toEqual(['pre:Bundle Untitled']);
      bundleNaizo.ready((db) => {
        bundleReadyLog.push(`post:${String(db.fields.b_title)}`);
      });
      expect(bundleReadyLog).toEqual(['pre:Bundle Untitled', 'post:Bundle Untitled']);

      expect(getAnchorCorner()).toBe('bottom-left');
      expect((document.getElementById('b-sel') as HTMLSelectElement).selectedIndex).toBe(-1);
      expect(document.getElementById('b-h3')?.textContent).toBe('Bundle Untitled');

      const bundleEvents: Array<Record<string, unknown>> = [];
      const onBundleChange = (e: Event) => {
        const d = (e as CustomEvent<Record<string, unknown>>).detail;
        bundleEvents.push(d);
        if (d.scope === 'batch') {
          bundleNaizo.set('afterBatch', 'queued-fifo');
        }
      };
      window.addEventListener('naizo:change', onBundleChange);
      try {
        const batchOut = bundleNaizo.batch(() => {
          bundleNaizo.addItem('rows', {});
          bundleNaizo.setField('b_title', 'Bundle Batched');
          return bundleNaizo.getList('rows')[0]?.label;
        });
        expect(batchOut).toBe('Row Default');
        expect(document.querySelector('.b-row-span')?.textContent).toBe('Row Default');
        expect(bundleEvents).toHaveLength(2);
        expect(bundleEvents[0]).toMatchObject({
          scope: 'batch',
          action: 'batch',
          source: 'api',
        });
        expect(bundleEvents[1]).toMatchObject({
          scope: 'custom',
          key: 'afterBatch',
          value: 'queued-fifo',
          source: 'api',
        });

        bundleEvents.length = 0;
        const bRowIn = document.querySelector('.b-row-in') as HTMLInputElement;
        bRowIn.value = 'Bundle Row Edited';
        bRowIn.dispatchEvent(new Event('input', { bubbles: true }));
        expect(bundleEvents).toHaveLength(1);
        expect(bundleEvents[0]).toMatchObject({
          scope: 'lists',
          action: 'update',
          list: 'rows',
          index: 0,
          key: 'label',
          value: 'Bundle Row Edited',
          source: 'dom',
        });
      } finally {
        window.removeEventListener('naizo:change', onBundleChange);
      }
    } finally {
      warnSpy.mockRestore();
      window.__naizoCleanup?.();
      document.documentElement.removeAttribute('naizo-id');
      document.documentElement.removeAttribute('naizo-pill-corner');
      document.documentElement.removeAttribute('data-naizo-pill-corner');
      document.documentElement.removeAttribute('data-naizo-manual');
      document.body.removeAttribute('naizo-pill-corner');
      document.body.removeAttribute('data-naizo-pill-corner');
      window.Naizo = Naizo;
      window.NaizoDB = NaizoDB;
      vi.useRealTimers();
    }
  });

  it('validates M14.1 progressive-disclosure cookbook guides (skills/naizo/references/cookbook/*.md), SKILL.md router links, symlink-free skills/naizo/, and site/references staging (M14.1, D46, D58)', () => {
    const cookbookFiles = [
      'basecoat-ui-and-dense-forms.md',
      'third-party-dom-and-export.md',
      'maps-and-live-apis.md',
      'audio-motion-and-svg-avatars.md',
      'data-ingestion-export-and-testing.md',
    ] as const;

    const skillRoot = resolve(process.cwd(), 'skills/naizo');
    const cookbookDir = join(skillRoot, 'references/cookbook');

    // 1. skills/naizo/ tree must contain zero symlinks so gh skill / npx skills packaging validates cleanly
    const assertNoSymlinks = (dirPath: string): void => {
      for (const entry of readdirSync(dirPath)) {
        const full = join(dirPath, entry);
        const st = lstatSync(full);
        expect(st.isSymbolicLink()).toBe(false);
        if (st.isDirectory()) {
          assertNoSymlinks(full);
        }
      }
    };
    assertNoSymlinks(skillRoot);

    // 2. All 5 positive-first cookbook guides exist and include working patterns + Pitfalls to Avoid & Why
    const actualCookbookFiles = readdirSync(cookbookDir)
      .filter((f) => f.endsWith('.md'))
      .sort();
    expect(actualCookbookFiles).toEqual([...cookbookFiles].sort());

    const guideContents: Record<(typeof cookbookFiles)[number], string> = {
      'basecoat-ui-and-dense-forms.md': readFileSync(
        join(cookbookDir, 'basecoat-ui-and-dense-forms.md'),
        'utf-8',
      ),
      'third-party-dom-and-export.md': readFileSync(
        join(cookbookDir, 'third-party-dom-and-export.md'),
        'utf-8',
      ),
      'maps-and-live-apis.md': readFileSync(join(cookbookDir, 'maps-and-live-apis.md'), 'utf-8'),
      'audio-motion-and-svg-avatars.md': readFileSync(
        join(cookbookDir, 'audio-motion-and-svg-avatars.md'),
        'utf-8',
      ),
      'data-ingestion-export-and-testing.md': readFileSync(
        join(cookbookDir, 'data-ingestion-export-and-testing.md'),
        'utf-8',
      ),
    };

    for (const file of cookbookFiles) {
      const text = guideContents[file];
      expect(text.startsWith('# ')).toBe(true);
      expect(text).toContain('Pitfalls to Avoid & Why');
    }

    expect(guideContents['basecoat-ui-and-dense-forms.md']).toContain('basecoat-css');
    expect(guideContents['basecoat-ui-and-dense-forms.md']).toContain('"theme": "system"');
    expect(guideContents['basecoat-ui-and-dense-forms.md']).toContain('min-width: 0;');
    expect(guideContents['basecoat-ui-and-dense-forms.md']).toContain('field-sizing: fixed;');
    expect(guideContents['basecoat-ui-and-dense-forms.md']).toContain('resize: vertical;');
    expect(guideContents['basecoat-ui-and-dense-forms.md']).toContain('data-filled');
    expect(guideContents['basecoat-ui-and-dense-forms.md']).toContain('<dialog');
    expect(guideContents['basecoat-ui-and-dense-forms.md']).toContain('naizo-ignore');

    expect(guideContents['third-party-dom-and-export.md']).toContain('data-naizo-strip');
    expect(guideContents['third-party-dom-and-export.md']).toContain('tailwindcss');
    expect(guideContents['third-party-dom-and-export.md']).toContain('lucide');
    expect(guideContents['third-party-dom-and-export.md']).toContain('mermaid');
    expect(guideContents['third-party-dom-and-export.md']).toContain('confetti.create');
    expect(guideContents['third-party-dom-and-export.md']).toContain("update('none')");

    expect(guideContents['maps-and-live-apis.md']).toContain('ol@v10.8.0');
    expect(guideContents['maps-and-live-apis.md']).toContain('data-naizo-strip');
    expect(guideContents['maps-and-live-apis.md']).toContain('Naizo.fetch(');
    expect(guideContents['maps-and-live-apis.md']).toContain("Naizo.setList('route', [])");

    expect(guideContents['audio-motion-and-svg-avatars.md']).toContain('transform-box: fill-box');
    expect(guideContents['audio-motion-and-svg-avatars.md']).toContain('transform-origin: center');
    expect(guideContents['audio-motion-and-svg-avatars.md']).toContain('<symbol');
    expect(guideContents['audio-motion-and-svg-avatars.md']).toContain('clipPath');
    expect(guideContents['audio-motion-and-svg-avatars.md']).toContain('translate3d');
    expect(guideContents['audio-motion-and-svg-avatars.md']).toContain('AudioContext');
    expect(guideContents['audio-motion-and-svg-avatars.md']).toContain('drop-shadow');

    expect(guideContents['data-ingestion-export-and-testing.md']).toContain('papaparse');
    expect(guideContents['data-ingestion-export-and-testing.md']).toContain('rowHash');
    expect(guideContents['data-ingestion-export-and-testing.md']).toContain('Naizo.setList(');
    expect(guideContents['data-ingestion-export-and-testing.md']).toContain('gws sheets');
    expect(guideContents['data-ingestion-export-and-testing.md']).toContain('\\u003c');
    expect(guideContents['data-ingestion-export-and-testing.md']).toContain('@playwright/test');
    expect(guideContents['data-ingestion-export-and-testing.md']).toContain('Naizo.reset()');

    // 3. Verify progressive-disclosure router links in SKILL.md, USAGE.md, README.md, llms.txt, and llms-full.txt,
    // and confirm core docs trimmed OpenLayers specifics in favor of maps-and-live-apis.md
    const skillMd = readFileSync(join(skillRoot, 'SKILL.md'), 'utf-8');
    const usageMd = readFileSync(resolve(process.cwd(), 'docs/USAGE.md'), 'utf-8');
    const readmeMd = readFileSync(resolve(process.cwd(), 'README.md'), 'utf-8');
    const llmsTxt = readFileSync(resolve(process.cwd(), 'site/llms.txt'), 'utf-8');
    const llmsFullTxt = readFileSync(resolve(process.cwd(), 'site/llms-full.txt'), 'utf-8');

    expect(readmeMd).toContain('(skills/naizo/references/cookbook/)');
    expect(existsSync(resolve(process.cwd(), 'skills/naizo/references/cookbook'))).toBe(true);

    for (const file of cookbookFiles) {
      const relSkillLink = `references/cookbook/${file}`;
      const relUsageLink = `../skills/naizo/references/cookbook/${file}`;
      const webUrl = `https://naizo.js.org/references/cookbook/${file}`;

      expect(skillMd).toContain(`(${relSkillLink})`);
      expect(existsSync(resolve(skillRoot, relSkillLink))).toBe(true);
      expect(skillMd).toContain(webUrl);

      expect(usageMd).toContain(`(${relUsageLink})`);
      expect(existsSync(resolve(process.cwd(), 'docs', relUsageLink))).toBe(true);

      expect(llmsTxt).toContain(webUrl);
      expect(llmsFullTxt).toContain(webUrl);
    }

    // Core Recipe 4 in USAGE.md & Template 4 in llms-full.txt delegate provider/OpenLayers details to cookbook
    expect(usageMd).not.toContain('api.open-meteo.com');
    expect(llmsFullTxt).not.toContain('combining an OpenLayers map');

    // 4. Verify site/references symlink & real cp -RL site/. _site/ staging dereference
    const siteRefsPath = resolve(process.cwd(), 'site/references');
    expect(lstatSync(siteRefsPath).isSymbolicLink()).toBe(true);
    expect(readlinkSync(siteRefsPath)).toBe('../skills/naizo/references');

    const stagedDir = mkdtempSync(join(tmpdir(), 'naizo-cookbook-stage-'));
    try {
      const siteSrcDir = resolve(process.cwd(), 'site');
      if (process.platform === 'win32') {
        cpSync(siteSrcDir, stagedDir, { recursive: true, dereference: true });
      } else {
        execFileSync('cp', ['-RL', `${siteSrcDir}/.`, `${stagedDir}/`]);
      }
      expect(lstatSync(join(stagedDir, 'references')).isSymbolicLink()).toBe(false);
      for (const file of cookbookFiles) {
        const stagedFile = join(stagedDir, 'references/cookbook', file);
        expect(existsSync(stagedFile)).toBe(true);
        expect(lstatSync(stagedFile).isFile()).toBe(true);
        expect(lstatSync(stagedFile).isSymbolicLink()).toBe(false);
        expect(readFileSync(stagedFile, 'utf-8')).toBe(guideContents[file]);
      }
    } finally {
      rmSync(stagedDir, { recursive: true, force: true });
    }

    // 8-file npm tarball manifest stays unchanged
    expect(pkgJson.files).toEqual([
      'dist/naizo.js',
      'dist/naizo.min.js',
      'dist/index.mjs',
      'dist/index.d.mts',
      'README.md',
      'CHANGELOG.md',
    ]);
  });

  it('dogfoods M14.2 Golden Rules (<template naizo-template>, Naizo.ready, Naizo.batch, system theme) and M14.1 Cookbook rules across all examples/*.html and site/index.html without boot dirtying or console warnings (M14.2, D45, D47, D57, D58, EC48, EC57)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          timezone: 'Asia/Tokyo',
          elevation: 1505,
          current: { temperature_2m: 12.4, wind_speed_10m: 7, weather_code: 1 },
          daily: {
            time: ['2026-11-18'],
            weather_code: [1],
            temperature_2m_max: [14],
            temperature_2m_min: [3],
            precipitation_probability_max: [10],
            wind_speed_10m_max: [11],
            sunrise: ['2026-11-18T06:28'],
            sunset: ['2026-11-18T16:42'],
          },
          hourly: {
            time: Array.from(
              { length: 24 },
              (_, h) => `2026-11-18T${String(h).padStart(2, '0')}:00`,
            ),
            temperature_2m: Array.from({ length: 24 }, () => 11),
            precipitation_probability: Array.from({ length: 24 }, () => 10),
            wind_speed_10m: Array.from({ length: 24 }, () => 8),
            weather_code: Array.from({ length: 24 }, () => 1),
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:m14-export');
    const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    const blueprints = [
      {
        name: 'examples/starter.html',
        html: starterHtml,
        listName: 'milestones',
        expectedCount: 2,
      },
      {
        name: 'examples/checklist.html',
        html: checklistHtml,
        listName: 'checks',
        expectedCount: 3,
      },
      { name: 'examples/notes.html', html: notesHtml, listName: 'notes', expectedCount: 4 },
      {
        name: 'examples/inventory.html',
        html: inventoryHtml,
        listName: 'inventory',
        expectedCount: 6,
      },
      { name: 'examples/weather.html', html: weatherHtml, listName: 'route', expectedCount: 2 },
      { name: 'site/index.html', html: siteHtml, listName: 'tasks', expectedCount: 3 },
    ];

    try {
      // 1. Static unhydrated HTML checks: <template naizo-template> with 0 static [naizo-item] shells,
      // dark-mode CSS support, no DOMContentLoaded hydration wrappers, and Cookbook CSS/modal/SVG rules
      expect(inventoryHtml).not.toContain("addEventListener('DOMContentLoaded'");
      expect(weatherHtml).not.toContain("addEventListener('DOMContentLoaded'");
      expect(siteHtml).not.toContain("addEventListener('DOMContentLoaded'");

      expect(inventoryHtml).toContain('field-sizing: fixed');
      expect(inventoryHtml).toContain('min-width: 0');
      expect(weatherHtml).toContain('.map-stage .ol-attribution');
      expect(weatherHtml).toContain('field-sizing: fixed');

      const parsedSiteStatic = new DOMParser().parseFromString(siteHtml, 'text/html');
      expect(parsedSiteStatic.getElementById('snippet-starter')?.textContent).toContain(
        '<template naizo-template>',
      );
      expect(parsedSiteStatic.querySelectorAll('svg svg').length).toBe(0);
      const svgIds = Array.from(parsedSiteStatic.querySelectorAll('svg [id]')).map((el) => el.id);
      expect(new Set(svgIds).size).toBe(svgIds.length);
      const archAnimSaving = parsedSiteStatic.querySelector('#loop svg g.anim-saving');
      expect(archAnimSaving).not.toBeNull();
      expect(archAnimSaving?.hasAttribute('transform')).toBe(false);
      expect(archAnimSaving?.parentElement?.getAttribute('transform')).toContain('translate(6, 4)');
      expect(siteHtml).toContain('.anim-saving .ring');

      const parsedInvStatic = new DOMParser().parseFromString(inventoryHtml, 'text/html');
      for (const dialogId of ['create-card-dialog', 'add-prop-dialog', 'inspect-json-dialog']) {
        expect(parsedInvStatic.getElementById(dialogId)?.hasAttribute('naizo-ignore')).toBe(true);
      }

      for (const bp of blueprints) {
        expect(bp.html).toContain('prefers-color-scheme: dark');

        const staticDoc = new DOMParser().parseFromString(bp.html, 'text/html');
        const listEls = Array.from(
          staticDoc.querySelectorAll<HTMLElement>('[naizo-list], [data-naizo-list]'),
        );
        expect(listEls.length).toBeGreaterThan(0);
        for (const listEl of listEls) {
          const tpl = listEl.querySelector(':scope > template[naizo-template]');
          expect(tpl, `${bp.name} missing <template naizo-template>`).not.toBeNull();
          const staticItems = listEl.querySelectorAll(
            ':scope > [naizo-item], :scope > [data-naizo-item]',
          );
          expect(staticItems.length, `${bp.name} should have 0 static [naizo-item] shells`).toBe(0);
        }

        // 2. Clean boot + inline script execution: 0 console warnings, expected hydrated items,
        // #reset stays hidden (initialDiskDb untouched), and exportHTML / downloadHTML round-trip cleanly
        localStorage.clear();
        document.documentElement.classList.remove('dark');
        document.documentElement.removeAttribute('data-theme');
        const scopeId = staticDoc.documentElement.getAttribute('naizo-id') ?? '';
        document.documentElement.setAttribute('naizo-id', scopeId);
        document.head.innerHTML = staticDoc.head.innerHTML;
        document.body.innerHTML = staticDoc.body.innerHTML;

        const parsedDb = JSON.parse(
          staticDoc.getElementById('naizodb')?.textContent ?? '{}',
        ) as NaizoDatabase;
        if ('theme' in parsedDb.fields) {
          expect(parsedDb.fields.theme, `${bp.name} fields.theme`).toBe('system');
        }
        if ('theme' in parsedDb.custom) {
          expect(parsedDb.custom.theme, `${bp.name} custom.theme`).toBe('system');
        }

        const listenerAbort = new AbortController();
        const origAdd = window.addEventListener.bind(window);
        const winAddSpy = vi
          .spyOn(window, 'addEventListener')
          .mockImplementation(
            (
              type: string,
              listener: EventListenerOrEventListenerObject,
              options?: boolean | AddEventListenerOptions,
            ) => {
              const merged: AddEventListenerOptions =
                typeof options === 'boolean'
                  ? { capture: options, signal: listenerAbort.signal }
                  : { ...options, signal: listenerAbort.signal };
              origAdd(type, listener, merged);
            },
          );

        try {
          await initNaizo();
          const inlineScript = staticDoc.body.querySelector('script')?.textContent ?? '';
          if (inlineScript.trim()) {
            runInThisContext(inlineScript);
          }
          await Promise.resolve();

          const hydratedItems = document.querySelectorAll(
            `[naizo-list="${bp.listName}"] > [naizo-item]`,
          );
          expect(hydratedItems.length, `${bp.name} hydrated items`).toBe(bp.expectedCount);

          const host = document.getElementById('__naizodb_host__');
          const resetBtn = host?.shadowRoot?.getElementById('reset') as HTMLButtonElement | null;
          expect(resetBtn?.style.display, `${bp.name} #reset must stay hidden on clean boot`).toBe(
            'none',
          );

          // Verify Naizo.batch() coalescing on interactive actions
          if (bp.name === 'examples/inventory.html') {
            Naizo.setField('filter_type', 'Hardware');
            Naizo.setField('filter_status', 'Assigned');
            const events: Array<{ scope?: string; action?: string; source?: string }> = [];
            window.addEventListener('naizo:change', (ev) => {
              const d = (ev as CustomEvent).detail;
              events.push({ scope: d.scope, action: d.action, source: d.source });
            });
            document.getElementById('reset-filters-btn')?.click();
            expect(events).toEqual([{ scope: 'batch', action: 'batch', source: 'api' }]);

            // Removing an extra JSON key via × persists through Naizo.setList() even when unlinked
            const firstRemovePill = document.querySelector<HTMLButtonElement>('.dict-pill-remove');
            expect(firstRemovePill).not.toBeNull();
            firstRemovePill?.click();
            const persistedInv = JSON.parse(
              localStorage.getItem(`naizodb_state_${window.location.pathname}::${scopeId}`) ?? '{}',
            ) as NaizoDatabase;
            expect(persistedInv.lists.inventory?.[0]?.chip).toBeUndefined();
          } else if (bp.name === 'examples/notes.html') {
            const events: Array<{ scope?: string; action?: string; source?: string }> = [];
            window.addEventListener('naizo:change', (ev) => {
              const d = (ev as CustomEvent).detail;
              events.push({ scope: d.scope, action: d.action, source: d.source });
            });
            document.getElementById('new-note-btn')?.click();
            expect(events).toEqual([{ scope: 'batch', action: 'batch', source: 'api' }]);
          } else if (bp.name === 'site/index.html') {
            const events: Array<{ scope?: string; action?: string; source?: string }> = [];
            window.addEventListener('naizo:change', (ev) => {
              const d = (ev as CustomEvent).detail;
              events.push({ scope: d.scope, action: d.action, source: d.source });
            });
            document.getElementById('simulate-agent-btn')?.click();
            expect(events).toEqual([{ scope: 'batch', action: 'batch', source: 'api' }]);
          }

          const exportedHtml = Naizo.exportHTML();
          const exportedDoc = new DOMParser().parseFromString(exportedHtml, 'text/html');
          expect(exportedDoc.querySelectorAll('[naizo-strip], [data-naizo-strip]').length).toBe(0);
          expect(exportedDoc.getElementById('__naizodb_host__')).toBeNull();
          expect(exportedDoc.getElementById('__naizodb_styles__')).toBeNull();
          expect(() =>
            JSON.parse(exportedDoc.getElementById('naizodb')?.textContent ?? ''),
          ).not.toThrow();

          const downloadedHtml = Naizo.downloadHTML(`${scopeId}.html`);
          const downloadedDoc = new DOMParser().parseFromString(downloadedHtml, 'text/html');
          expect(downloadedDoc.querySelectorAll('[naizo-strip], [data-naizo-strip]').length).toBe(
            0,
          );
          expect(() =>
            JSON.parse(downloadedDoc.getElementById('naizodb')?.textContent ?? ''),
          ).not.toThrow();
        } finally {
          listenerAbort.abort();
          winAddSpy.mockRestore();
        }
      }

      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      vi.unstubAllGlobals();
      createUrlSpy.mockRestore();
      revokeUrlSpy.mockRestore();
      anchorClickSpy.mockRestore();
      document.documentElement.classList.remove('dark');
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.removeAttribute('naizo-id');
    }
  });

  it('implements M15.1 two-tier O(N) 3-way list merge (Path A unique primitive id + Path B conservative id-less prefix) and non-destructive list DOM reconciliation preserving activeElement focus/caret (M15.1, D19, D20, D59, EC58)', async () => {
    vi.useFakeTimers();
    try {
      document.documentElement.setAttribute('naizo-id', 'm15-1-list-merge');
      const initialDb: NaizoDatabase = {
        _meta: {},
        fields: { project: 'Alpha' },
        lists: {
          board: [
            { id: 1, title: 'Numeric One', status: 'todo', points: 3 },
            { id: '1', title: 'String One', status: 'todo', points: 5 },
            { id: 't-del-disk', title: 'Removed By Disk', status: 'todo' },
            { id: 't-del-browser', title: 'Removed By Browser', status: 'todo' },
          ],
          checks: [
            { done: false, text: 'Row 0' },
            { done: false, text: 'Row 1' },
            { done: false, text: 'Row 2' },
          ],
        },
        custom: {},
      };
      let diskHtml = `<!doctype html><html naizo-id="m15-1-list-merge"><head><script id="naizodb" type="application/json">\n${JSON.stringify(initialDb, null, 2)}\n</script></head><body></body></html>`;
      let diskMtime = 1000;

      document.head.innerHTML = `<script id="naizodb" type="application/json">\n${JSON.stringify(initialDb, null, 2)}\n</script>`;
      document.body.innerHTML = `
        <div naizo-list="board">
          <template naizo-template>
            <div naizo-item>
              <label><input class="b-title" type="text" naizo="title" value="" /></label>
              <label><input class="b-status" type="text" naizo="status" value="" /></label>
              <span class="b-custom-slot" naizo-ignore></span>
            </div>
          </template>
        </div>
        <ul naizo-list="checks">
          <template naizo-template>
            <li naizo-item>
              <label><input class="c-done" type="checkbox" naizo="done" /></label>
              <label><input class="c-text" type="text" naizo="text" value="" /></label>
              <span class="c-custom-slot" naizo-ignore></span>
            </li>
          </template>
        </ul>
      `;

      await initNaizo();

      // Verify compact 8-hex per-item hashes alongside whole-list hash in naizodb_disk_hash_<key> without injecting UUIDs (D19)
      const snapRaw = localStorage.getItem('naizodb_disk_hash_/::m15-1-list-merge')!;
      const snapManifest = JSON.parse(snapRaw.slice(snapRaw.indexOf('|') + 1)) as {
        lists: {
          board: { h: string; i: string[]; k?: string[] };
          checks: { h: string; i: string[]; k?: string[] };
        };
      };
      expect(snapManifest.lists.board.h).toMatch(/^fnv1a:[0-9a-f]{8}$/);
      expect(snapManifest.lists.board.i).toHaveLength(4);
      expect(snapManifest.lists.board.i[0]).toMatch(/^[0-9a-f]{8}$/);
      expect(snapManifest.lists.board.k).toEqual([
        'number:1',
        'string:1',
        'string:t-del-disk',
        'string:t-del-browser',
      ]);
      expect(snapManifest.lists.checks.i).toHaveLength(3);
      expect(snapManifest.lists.checks.k).toBeUndefined();
      expect(Naizo.getList('checks')[0]?.id).toBeUndefined();

      window.showSaveFilePicker = vi.fn().mockResolvedValue({
        name: 'index.html',
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
      expect(await Naizo.link()).toBe(true);

      // Stamp custom [naizo-ignore] DOM state on initial rows and focus board row 1 ("String One") mid-typing
      const initialBoardRows = Array.from(
        document.querySelectorAll<HTMLElement>('[naizo-list="board"] > [naizo-item]'),
      );
      const initialCheckRows = Array.from(
        document.querySelectorAll<HTMLElement>('[naizo-list="checks"] > [naizo-item]'),
      );
      initialBoardRows[0]!.querySelector('.b-custom-slot')!.textContent = 'KEPT-SLOT-0';
      initialBoardRows[1]!.querySelector('.b-custom-slot')!.textContent = 'KEPT-SLOT-1';
      initialCheckRows[0]!.querySelector('.c-custom-slot')!.textContent = 'CHECK-SLOT-0';

      // Browser edits:
      // - Path A: updates status on id:"1" (while focusing its title input mid-edit!), reorders string:"1" ahead of number:1, deletes t-del-browser, appends id:"b-added"
      // - Path B: ticks checks[0].done = true, sets checks[2].done = true (matching disk!), appends Row 3 Browser
      Naizo.updateItem('board', 1, { status: 'in-progress' });
      Naizo.removeItem('board', 3); // removes t-del-browser
      Naizo.moveItem('board', 1, 0); // order in browser: ['1', 1, 't-del-disk']
      Naizo.addItem('board', { id: 'b-added', title: 'Added In Browser', status: 'todo' });

      Naizo.updateItem('checks', 0, { done: true });
      Naizo.updateItem('checks', 2, { done: true });
      Naizo.addItem('checks', { done: false, text: 'Row 3 From Browser' });

      // Focus active input inside the reordered '1' row (currently at DOM index 0) with caret at [2, 5]
      const activeBoardRow = document.querySelectorAll<HTMLElement>(
        '[naizo-list="board"] > [naizo-item]',
      )[0]!;
      const activeTitleIn = activeBoardRow.querySelector<HTMLInputElement>('.b-title')!;
      activeTitleIn.focus();
      activeTitleIn.value = 'String One (Mid-Keystroke)';
      activeTitleIn.setSelectionRange(2, 5);

      // Before browser's debounced disk write fires, external AI agent edits diskHtml:
      // - Path A: keeps base relative order [1, '1'], edits points & title on '1' (different properties than browser's status!), edits 1.title, deletes 't-del-disk', appends 'd-added'
      // - Path B: edits checks[1].text, sets checks[2].done = true (identical edit!), appends 'Row 3 From Disk'
      const agentDiskDb: NaizoDatabase = {
        _meta: {},
        fields: { project: 'Alpha' },
        lists: {
          board: [
            { id: 1, title: 'Numeric One (AI)', status: 'todo', points: 3 },
            { id: '1', title: 'String One (AI)', status: 'todo', points: 8 },
            { id: 'd-added', title: 'Added On Disk', status: 'done' },
          ],
          checks: [
            { done: false, text: 'Row 0' },
            { done: false, text: 'Row 1 (AI)' },
            { done: true, text: 'Row 2' },
            { done: false, text: 'Row 3 From Disk' },
          ],
        },
        custom: {},
      };
      diskHtml = `<!doctype html><html naizo-id="m15-1-list-merge"><head><script id="naizodb" type="application/json">\n${JSON.stringify(agentDiskDb, null, 2)}\n</script></head><body></body></html>`;
      diskMtime += 500;

      await vi.advanceTimersByTimeAsync(2100);

      // Zero collisions! Per-property merge on id:'1', browser reorder preserved (since disk kept base order), clean deletes on both sides, both additions kept
      expect(localStorage.getItem('naizodb_backup_/::m15-1-list-merge')).toBeNull();
      expect(Naizo.getList('board')).toEqual([
        { id: '1', title: 'String One (AI)', status: 'in-progress', points: 8 },
        { id: 1, title: 'Numeric One (AI)', status: 'todo', points: 3 },
        { id: 'b-added', title: 'Added In Browser', status: 'todo' },
        { id: 'd-added', title: 'Added On Disk', status: 'done' },
      ]);
      // Path B checklist merged cleanly with zero injected ids
      expect(Naizo.getList('checks')).toEqual([
        { done: true, text: 'Row 0' },
        { done: false, text: 'Row 1 (AI)' },
        { done: true, text: 'Row 2' },
        { done: false, text: 'Row 3 From Disk' },
        { done: false, text: 'Row 3 From Browser' },
      ]);

      // Non-destructive DOM reconciliation: surviving nodes, [naizo-ignore] slots, activeElement focus, mid-keystroke text, and caret survived length change + reorder!
      const reconciledBoardRows = Array.from(
        document.querySelectorAll<HTMLElement>('[naizo-list="board"] > [naizo-item]'),
      );
      expect(reconciledBoardRows).toHaveLength(4);
      expect(reconciledBoardRows[0]).toBe(initialBoardRows[1]);
      expect(reconciledBoardRows[1]).toBe(initialBoardRows[0]);
      expect(reconciledBoardRows[0]?.querySelector('.b-custom-slot')?.textContent).toBe(
        'KEPT-SLOT-1',
      );
      expect(reconciledBoardRows[1]?.querySelector('.b-custom-slot')?.textContent).toBe(
        'KEPT-SLOT-0',
      );
      expect(document.activeElement).toBe(activeTitleIn);
      expect(activeTitleIn.value).toBe('String One (Mid-Keystroke)');
      expect(activeTitleIn.selectionStart).toBe(2);
      expect(activeTitleIn.selectionEnd).toBe(5);
      // Non-active input in the SAME active row DID receive merged status update!
      expect(reconciledBoardRows[0]?.querySelector<HTMLInputElement>('.b-status')?.value).toBe(
        'in-progress',
      );
      expect(
        document.querySelectorAll<HTMLElement>('[naizo-list="checks"] > [naizo-item]')[0],
      ).toBe(initialCheckRows[0]);
      expect(
        document
          .querySelectorAll<HTMLElement>('[naizo-list="checks"] > [naizo-item]')[0]
          ?.querySelector('.c-custom-slot')?.textContent,
      ).toBe('CHECK-SLOT-0');

      // Wait for scheduled writeback to sync merged browser changes to disk
      await vi.advanceTimersByTimeAsync(350);
      expect(diskHtml).toContain('"in-progress"');
      expect(diskHtml).toContain('"Row 3 From Browser"');

      // Test edit-vs-delete collision on Path A & deletion fallback on Path B
      activeTitleIn.blur();
      Naizo.updateItem('board', 0, { status: 'browser-edited-before-disk-delete' });
      Naizo.updateItem('checks', 0, { text: 'Browser edited row 0' });

      const collidingDiskDb: NaizoDatabase = {
        _meta: {},
        fields: { project: 'Alpha' },
        lists: {
          board: [
            // Disk deleted id:'1' while browser edited it, and reordered d-added ahead of 1
            { id: 'd-added', title: 'Added On Disk', status: 'done' },
            { id: 1, title: 'Numeric One (AI)', status: 'todo', points: 3 },
            { id: 'b-added', title: 'Added In Browser', status: 'todo' },
          ],
          checks: [
            // Disk deleted checks[4] (< base length 5) -> Path B falls back immediately to whole-list disk win + collision backup
            { done: true, text: 'Row 0' },
            { done: false, text: 'Row 1 (AI)' },
          ],
        },
        custom: {},
      };
      diskHtml = `<!doctype html><html naizo-id="m15-1-list-merge"><head><script id="naizodb" type="application/json">\n${JSON.stringify(collidingDiskDb, null, 2)}\n</script></head><body></body></html>`;
      diskMtime += 500;
      await vi.advanceTimersByTimeAsync(2100);

      expect(Naizo.getList('board').map((it) => it.id)).toEqual(['d-added', 1, 'b-added']);
      expect(Naizo.getList('checks')).toEqual([
        { done: true, text: 'Row 0' },
        { done: false, text: 'Row 1 (AI)' },
      ]);
      expect(localStorage.getItem('naizodb_backup_/::m15-1-list-merge')).not.toBeNull();
      expect(
        document.getElementById('__naizodb_host__')?.shadowRoot?.getElementById('status')
          ?.textContent,
      ).toBe('External Disk Edit · Conflict Backed Up');

      // Test cold-reload hash-only Path A & legacy plain-string list hash backward compatibility
      await Naizo.unlink();
      localStorage.clear();
      const coldBase: NaizoDatabase = {
        _meta: {},
        fields: {},
        lists: {
          items: [
            { id: 'a', label: 'A0' },
            { id: 'b', label: 'B0' },
          ],
          legacy: [{ label: 'L0' }],
        },
        custom: {},
      };
      document.head.innerHTML = `<script id="naizodb" type="application/json">\n${JSON.stringify(coldBase, null, 2)}\n</script>`;
      document.body.innerHTML = '';
      await initNaizo();

      // Inject legacy plain-string hash for `legacy` in naizodb_disk_hash_ while keeping new entry for `items`
      const coldSnapKey = 'naizodb_disk_hash_/::m15-1-list-merge';
      const coldSnap = localStorage.getItem(coldSnapKey)!;
      const pipe = coldSnap.indexOf('|');
      const manifestObj = JSON.parse(coldSnap.slice(pipe + 1)) as {
        fields: Record<string, string>;
        lists: Record<string, unknown>;
        custom: Record<string, string>;
      };
      manifestObj.lists.legacy = (manifestObj.lists.legacy as { h: string }).h;
      localStorage.setItem(
        coldSnapKey,
        `${coldSnap.slice(0, pipe)}|${JSON.stringify(manifestObj)}`,
      );

      // Browser cached state edited item 'a' and legacy[0]
      localStorage.setItem(
        'naizodb_state_/::m15-1-list-merge',
        JSON.stringify({
          _meta: {},
          fields: {},
          lists: {
            items: [
              { id: 'a', label: 'A-browser' },
              { id: 'b', label: 'B0' },
            ],
            legacy: [{ label: 'L-browser' }],
          },
          custom: {},
        }),
      );

      // External disk edited item 'b' while leaving `legacy` untouched -> cold boot merges BOTH cleanly without collision!
      const coldDiskNext: NaizoDatabase = {
        _meta: {},
        fields: {},
        lists: {
          items: [
            { id: 'a', label: 'A0' },
            { id: 'b', label: 'B-disk' },
          ],
          legacy: [{ label: 'L0' }],
        },
        custom: {},
      };
      document.head.innerHTML = `<script id="naizodb" type="application/json">\n${JSON.stringify(coldDiskNext, null, 2)}\n</script>`;
      await initNaizo();
      expect(Naizo.getList('items')).toEqual([
        { id: 'a', label: 'A-browser' },
        { id: 'b', label: 'B-disk' },
      ]);
      expect(Naizo.getList('legacy')).toEqual([{ label: 'L-browser' }]);
      expect(localStorage.getItem('naizodb_backup_/::m15-1-list-merge')).toBeNull();

      // Cold-reload hash-only base where BOTH sides edited the same id item ('a') differently -> disk wins + hasCollision
      localStorage.setItem(
        'naizodb_state_/::m15-1-list-merge',
        JSON.stringify({
          _meta: {},
          fields: {},
          lists: {
            items: [
              { id: 'a', label: 'A-browser-v2', owner: 'Alice' },
              { id: 'b', label: 'B-disk' },
            ],
            legacy: [{ label: 'L-browser' }],
          },
          custom: {},
        }),
      );
      document.head.innerHTML = `<script id="naizodb" type="application/json">\n${JSON.stringify(
        {
          _meta: {},
          fields: {},
          lists: {
            items: [
              { id: 'a', label: 'A-disk-v2', priority: 1 },
              { id: 'b', label: 'B-disk' },
            ],
            legacy: [{ label: 'L0' }],
          },
          custom: {},
        },
        null,
        2,
      )}\n</script>`;
      await initNaizo();
      expect(Naizo.getList('items')[0]).toEqual({ id: 'a', label: 'A-disk-v2', priority: 1 });
      expect(localStorage.getItem('naizodb_backup_/::m15-1-list-merge')).not.toBeNull();

      // Cross-tab storage event with e.oldValue: merges non-colliding properties on 'a', lets incoming win on same-property collision on 'b' while keeping non-colliding browser prop on 'b', and rejects duplicate ids from Path A
      localStorage.removeItem('naizodb_backup_/::m15-1-list-merge');
      const tabOldValue = localStorage.getItem('naizodb_state_/::m15-1-list-merge')!;
      // Schedule uncommitted debounced edit in current tab (`persistTimeout !== null`)
      Naizo.batch(
        () => {
          Naizo.updateItem('items', 0, { assignee: 'Kenji' });
          Naizo.updateItem('items', 1, { label: 'B-tab-local', note: 'KeptNonColliding' });
        },
        { deferPersist: true },
      );
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'naizodb_state_/::m15-1-list-merge',
          oldValue: tabOldValue,
          newValue: JSON.stringify({
            _meta: {},
            fields: {},
            lists: {
              items: [
                { id: 'a', label: 'A-other-tab', priority: 2 },
                { id: 'b', label: 'B-other-tab' },
              ],
              legacy: [{ label: 'L-browser' }],
            },
            custom: {},
          }),
        }),
      );
      expect(Naizo.getList('items')).toEqual([
        { id: 'a', label: 'A-other-tab', priority: 2, assignee: 'Kenji' },
        { id: 'b', label: 'B-other-tab', note: 'KeptNonColliding' },
      ]);
      expect(localStorage.getItem('naizodb_backup_/::m15-1-list-merge')).not.toBeNull();
    } finally {
      await Naizo.unlink();
      document.documentElement.removeAttribute('naizo-id');
      Reflect.deleteProperty(window, 'showSaveFilePicker');
      vi.useRealTimers();
    }
  });

  it('protects linked files against live malformed disk JSON on watch/pre-write, backs up raw text, auto-recovers when fixed on disk, and repairs on 4. Repair JSON click (M15.1, D59, EC59)', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      document.documentElement.setAttribute('naizo-id', 'm15-1-live-invalid-json');
      const goodJson = JSON.stringify(
        { _meta: {}, fields: { title: 'Initial Valid' }, lists: {}, custom: {} },
        null,
        2,
      );
      let diskHtml = `<!doctype html><html naizo-id="m15-1-live-invalid-json"><head><script id="naizodb" type="application/json">\n${goodJson}\n</script></head><body></body></html>`;
      let diskMtime = 1000;
      const createWritableSpy = vi.fn().mockImplementation(async () => ({
        write: async (data: string) => {
          diskHtml = data;
          diskMtime += 100;
        },
        close: async () => {},
      }));

      document.head.innerHTML = `<script id="naizodb" type="application/json">\n${goodJson}\n</script>`;
      document.body.innerHTML = `<input id="t-in" type="text" naizo="title" value="" />`;
      await initNaizo();

      window.showSaveFilePicker = vi.fn().mockResolvedValue({
        name: 'index.html',
        queryPermission: vi.fn().mockResolvedValue('granted'),
        requestPermission: vi.fn().mockResolvedValue('granted'),
        getFile: vi.fn().mockImplementation(async () => ({
          lastModified: diskMtime,
          text: async () => diskHtml,
        })),
        createWritable: createWritableSpy,
      });
      expect(await Naizo.link()).toBe(true);
      createWritableSpy.mockClear();

      const host = document.getElementById('__naizodb_host__');
      const statusEl = host?.shadowRoot?.getElementById('status');
      const dotEl = host?.shadowRoot?.getElementById('dot');
      const repairBtn = host?.shadowRoot?.getElementById('restore') as HTMLButtonElement | null;

      // 1. Pre-write detection: external agent writes malformed JSON just before human calls Naizo.save()
      Naizo.setField('title', 'Human Unsaved Edit');
      diskHtml = `<!doctype html><html naizo-id="m15-1-live-invalid-json"><head><script id="naizodb" type="application/json">{ broken: json </script></head><body></body></html>`;
      diskMtime += 500;

      expect(await Naizo.save()).toBe(false);
      // Must NOT overwrite broken disk file!
      expect(createWritableSpy).not.toHaveBeenCalled();
      expect(diskHtml).toContain('{ broken: json');
      expect(localStorage.getItem('naizodb_raw_backup_/::m15-1-live-invalid-json')).toBe(
        '{ broken: json',
      );
      expect(statusEl?.textContent).toBe('Invalid #naizodb JSON');
      expect(dotEl?.classList.contains('error')).toBe(true);
      expect(repairBtn?.style.display).toBe('inline-block');
      expect(repairBtn?.dataset.tip).toBe('Repair JSON');

      // 2. Auto-recovery on watch tick when external agent fixes disk JSON to valid JSON
      const fixedByAgentJson = JSON.stringify(
        {
          _meta: {},
          fields: { title: 'Initial Valid', agentNote: 'Recovered By Agent' },
          lists: {},
          custom: {},
        },
        null,
        2,
      );
      diskHtml = `<!doctype html><html naizo-id="m15-1-live-invalid-json"><head><script id="naizodb" type="application/json">\n${fixedByAgentJson}\n</script></head><body></body></html>`;
      diskMtime += 500;

      await vi.advanceTimersByTimeAsync(2100);
      // Both human's unsaved edit ('Human Unsaved Edit') and agent's new field ('Recovered By Agent') merged cleanly!
      expect(Naizo.getField('title')).toBe('Human Unsaved Edit');
      expect(Naizo.getField('agentNote')).toBe('Recovered By Agent');

      await vi.advanceTimersByTimeAsync(350);
      expect(statusEl?.textContent).toBe('Synced to Disk');
      expect(dotEl?.classList.contains('saved')).toBe(true);
      expect(diskHtml).toContain('"Human Unsaved Edit"');

      // 3. Watch-tick invalid shape detection + manual 4. Repair JSON recovery
      createWritableSpy.mockClear();
      diskHtml = `<!doctype html><html naizo-id="m15-1-live-invalid-json"><head><script id="naizodb" type="application/json">{"fields":"not-an-object"}</script></head><body></body></html>`;
      diskMtime += 500;

      await vi.advanceTimersByTimeAsync(2100);
      expect(statusEl?.textContent).toBe('Invalid #naizodb JSON');
      expect(localStorage.getItem('naizodb_raw_backup_/::m15-1-live-invalid-json')).toBe(
        '{"fields":"not-an-object"}',
      );

      // Clicking 4. Repair JSON repairs the file on disk with browser's valid store and resumes sync
      repairBtn?.click();
      await vi.advanceTimersByTimeAsync(50);
      expect(createWritableSpy).toHaveBeenCalledTimes(1);
      expect(diskHtml).toContain('"Human Unsaved Edit"');
      expect(statusEl?.textContent).toBe('Synced to Disk');

      // 4. Re-initializing into invalid startup JSON resets lastKnownDiskRaw / lastDiskDb cleanly
      await Naizo.unlink();
      document.head.innerHTML = `<script id="naizodb" type="application/json">{ bad boot</script>`;
      await initNaizo();
      expect(
        document.getElementById('__naizodb_host__')?.shadowRoot?.getElementById('status')
          ?.textContent,
      ).toBe('Invalid #naizodb JSON');
    } finally {
      warnSpy.mockRestore();
      await Naizo.unlink();
      document.documentElement.removeAttribute('naizo-id');
      Reflect.deleteProperty(window, 'showSaveFilePicker');
      vi.useRealTimers();
    }
  });

  it('implements rename-friendly wrong-file link guard, URL-decoded suggestedName, and HTML-comment/rawtext-safe #naizodb & <head> scanning (M15.1, D16, D59, EC60)', async () => {
    const origIndexedDB = globalThis.indexedDB;
    const origPath = location.pathname;
    const idbHandles = new Map<string, unknown>();
    const fakeIdb = {
      open: vi.fn(() => {
        const req: Record<string, unknown> = {};
        queueMicrotask(() => {
          req.result = {
            createObjectStore: vi.fn(),
            transaction: () => ({
              objectStore: () => ({
                put: (val: unknown, key: string) => {
                  idbHandles.set(key, val);
                  const r: Record<string, unknown> = {};
                  queueMicrotask(() => (r.onsuccess as (() => void) | undefined)?.());
                  return r;
                },
                get: (key: string) => {
                  const r: Record<string, unknown> = { result: idbHandles.get(key) };
                  queueMicrotask(() => (r.onsuccess as (() => void) | undefined)?.());
                  return r;
                },
                delete: (key: string) => {
                  idbHandles.delete(key);
                  const r: Record<string, unknown> = {};
                  queueMicrotask(() => (r.onsuccess as (() => void) | undefined)?.());
                  return r;
                },
              }),
            }),
          };
          (req.onsuccess as (() => void) | undefined)?.();
        });
        return req;
      }),
    };
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: fakeIdb });
    const confirmSpy = vi.spyOn(window, 'confirm');

    try {
      // 1. URL-decoded suggestedName in showSaveFilePicker
      window.history.replaceState({}, '', '/docs/My%20Notes%20%E6%97%A5%E6%9C%AC%E8%AA%9E.html');
      const rawDiskTemplate = `<!-- Header comment with fake tags:
        <head>
          <script id="naizodb" type="application/json">{"_meta":{"id":"comment-fake"},"fields":{"wrong":true}}</script>
        </head>
      -->
      <!doctype html>
      <html>
        <head>
          <script>
            const example = '<script id="naizodb" type="application/json">{"fields":{"scriptFake":1}}<\\/script>';
            const openCommentInJs = '<!-- not a real HTML comment';
          </script>
          <style>/* <script id="naizodb">{"fields":{"styleFake":1}}</script> */</style>
          <script id="naizodb" type="application/json">
          {"_meta":{},"fields":{"note":"Initial $& $$ $' price"},"lists":{"tasks":[{"label":"Item 1"}]},"custom":{}}
          </script>
        </head>
        <body>
          <h1 contenteditable="true" naizo="note">Draft</h1>
          <div id="custom-view" naizo-ignore></div>
          <ul naizo-list="tasks">
            <template naizo-template><li naizo-item><label><input type="text" naizo="label" value="" /></label></li></template>
          </ul>
        </body>
      </html>`;

      const parsedInit = new DOMParser().parseFromString(rawDiskTemplate, 'text/html');
      document.head.innerHTML = parsedInit.head.innerHTML;
      document.body.innerHTML = parsedInit.body.innerHTML;
      await initNaizo();

      // Mutate hydrated DOM, [naizo-ignore], and dark theme to ensure shell normalization never false-alarms on renamed copies!
      Naizo.setField('note', 'Updated $& $$ $1 value');
      Naizo.addItem('tasks', { label: 'Item 2' });
      document.getElementById('custom-view')!.innerHTML = '<strong>Runtime widget</strong>';
      document.documentElement.classList.add('dark');

      // Case A: Linking a renamed copy of the SAME app (no scope ID, different handle.name, matching normalized shell) -> ZERO confirm prompt!
      let copyHtml = rawDiskTemplate;
      const pickerOpts: Array<Record<string, unknown>> = [];
      window.showSaveFilePicker = vi
        .fn()
        .mockImplementation(async (opts: Record<string, unknown>) => {
          pickerOpts.push(opts);
          return {
            name: 'Renamed Copy.html',
            queryPermission: vi.fn().mockResolvedValue('granted'),
            requestPermission: vi.fn().mockResolvedValue('granted'),
            getFile: vi.fn().mockImplementation(async () => ({
              lastModified: 1000,
              text: async () => copyHtml,
            })),
            createWritable: vi.fn().mockImplementation(async () => ({
              write: async (data: string) => {
                copyHtml = data;
              },
              close: async () => {},
            })),
          };
        });

      expect(await Naizo.link()).toBe(true);
      expect(pickerOpts[0]?.suggestedName).toBe('My Notes 日本語.html');
      expect(confirmSpy).not.toHaveBeenCalled();
      // Comment block, preceding <script>/<style>, and $& / $$ characters all preserved intact!
      expect(copyHtml).toContain(
        '<script id="naizodb" type="application/json">{"_meta":{"id":"comment-fake"},"fields":{"wrong":true}}</script>',
      );
      expect(copyHtml).toContain("const openCommentInJs = '<!-- not a real HTML comment';");
      expect(copyHtml).toContain('"Updated $& $$ $1 value"');
      await Naizo.unlink();

      // Case B: Brand-new empty "Save As" file (existingFileText === '') -> ZERO confirm prompt!
      let emptySaveAs = '';
      window.showSaveFilePicker = vi.fn().mockResolvedValue({
        name: 'Brand-New-SaveAs.html',
        queryPermission: vi.fn().mockResolvedValue('granted'),
        requestPermission: vi.fn().mockResolvedValue('granted'),
        getFile: vi.fn().mockResolvedValue({
          lastModified: 2000,
          text: async () => emptySaveAs,
        }),
        createWritable: vi.fn().mockResolvedValue({
          write: async (data: string) => {
            emptySaveAs = data;
          },
          close: async () => {},
        }),
      });
      expect(await Naizo.link()).toBe(true);
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(emptySaveAs).toContain('"Updated $& $$ $1 value"');
      await Naizo.unlink();
      idbHandles.clear();

      // Case C: Unrelated existing file with #naizodb (both handle.name and shell differ) -> prompts confirm!
      // Cancel aborts BEFORE saving fileHandle to IndexedDB and leaves unrelated file untouched.
      let unrelatedAppHtml = `<!doctype html><html><head><script id="naizodb" type="application/json">{"_meta":{},"fields":{"unrelatedSecret":"keep-safe"},"lists":{},"custom":{}}</script></head><body><main><h2>Totally Different App</h2><input naizo="unrelatedSecret" /></main></body></html>`;
      confirmSpy.mockReturnValueOnce(false);
      window.showSaveFilePicker = vi.fn().mockResolvedValue({
        name: 'other-app.html',
        queryPermission: vi.fn().mockResolvedValue('granted'),
        requestPermission: vi.fn().mockResolvedValue('granted'),
        getFile: vi.fn().mockImplementation(async () => ({
          lastModified: 3000,
          text: async () => unrelatedAppHtml,
        })),
        createWritable: vi.fn().mockImplementation(async () => ({
          write: async (data: string) => {
            unrelatedAppHtml = data;
          },
          close: async () => {},
        })),
      });

      expect(await Naizo.link()).toBe(false);
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(idbHandles.size).toBe(0);
      expect(unrelatedAppHtml).toContain('"unrelatedSecret":"keep-safe"');
      expect(Naizo.getField('unrelatedSecret')).toBeUndefined();

      // Case D: Explicit scope ID conflict (even when handle.name matches!) -> On Confirm, persists handle & writes store cleanly WITHOUT cross-merging unrelated keys!
      document.documentElement.setAttribute('naizo-id', 'app-alpha');
      let conflictingScopeHtml = `<!doctype html><html naizo-id="app-beta"><head><script id="naizodb" type="application/json">{"_meta":{"id":"app-beta"},"fields":{"betaOnly":"do-not-merge"},"lists":{},"custom":{}}</script></head><body></body></html>`;
      confirmSpy.mockClear();
      confirmSpy.mockReturnValueOnce(true);
      window.showSaveFilePicker = vi.fn().mockResolvedValue({
        name: 'My Notes 日本語.html',
        queryPermission: vi.fn().mockResolvedValue('granted'),
        requestPermission: vi.fn().mockResolvedValue('granted'),
        getFile: vi.fn().mockImplementation(async () => ({
          lastModified: 4000,
          text: async () => conflictingScopeHtml,
        })),
        createWritable: vi.fn().mockImplementation(async () => ({
          write: async (data: string) => {
            conflictingScopeHtml = data;
          },
          close: async () => {},
        })),
      });

      expect(await Naizo.link()).toBe(true);
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(idbHandles.size).toBe(1);
      expect(Naizo.getField('betaOnly')).toBeUndefined();
      expect(conflictingScopeHtml).not.toContain('betaOnly');
      expect(conflictingScopeHtml).toContain('"Updated $& $$ $1 value"');
      await Naizo.unlink();

      // Case D2: Renamed copy with MATCHING scope ID skips window.confirm() even when both handle.name and HTML shell differ!
      confirmSpy.mockClear();
      let sameScopeRenamedHtml = `<!doctype html><html naizo-id="app-alpha"><head><script id="naizodb" type="application/json">{"_meta":{},"fields":{"fromRenamedCopy":"merged"},"lists":{},"custom":{}}</script></head><body><section><h2>Redesigned View For Same App</h2></section></body></html>`;
      window.showSaveFilePicker = vi.fn().mockResolvedValue({
        name: 'app-alpha-v2.html',
        queryPermission: vi.fn().mockResolvedValue('granted'),
        requestPermission: vi.fn().mockResolvedValue('granted'),
        getFile: vi.fn().mockImplementation(async () => ({
          lastModified: 4500,
          text: async () => sameScopeRenamedHtml,
        })),
        createWritable: vi.fn().mockImplementation(async () => ({
          write: async (data: string) => {
            sameScopeRenamedHtml = data;
          },
          close: async () => {},
        })),
      });
      expect(await Naizo.link()).toBe(true);
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(Naizo.getField('fromRenamedCopy')).toBe('merged');
      await Naizo.unlink();

      // Case E: Comment-safe <head> injection on confirmed EC28 file lacking #naizodb
      let noDbWithCommentHead = `<!-- <head><title>Commented Head</title></head> -->\n<!doctype html><html><head><title>Real Head</title></head><body><p>Hello</p></body></html>`;
      confirmSpy.mockClear();
      confirmSpy.mockReturnValueOnce(true);
      window.showSaveFilePicker = vi.fn().mockResolvedValue({
        name: 'My Notes 日本語.html',
        queryPermission: vi.fn().mockResolvedValue('granted'),
        requestPermission: vi.fn().mockResolvedValue('granted'),
        getFile: vi.fn().mockImplementation(async () => ({
          lastModified: 5000,
          text: async () => noDbWithCommentHead,
        })),
        createWritable: vi.fn().mockImplementation(async () => ({
          write: async (data: string) => {
            noDbWithCommentHead = data;
          },
          close: async () => {},
        })),
      });

      expect(await Naizo.link()).toBe(true);
      expect(
        noDbWithCommentHead.startsWith('<!-- <head><title>Commented Head</title></head> -->'),
      ).toBe(true);
      expect(noDbWithCommentHead).toContain(
        '<html><head>\n<script id="naizodb" type="application/json">',
      );
    } finally {
      confirmSpy.mockRestore();
      await Naizo.unlink();
      window.history.replaceState({}, '', origPath);
      Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: origIndexedDB });
      document.documentElement.classList.remove('dark');
      document.documentElement.removeAttribute('naizo-id');
      Reflect.deleteProperty(window, 'showSaveFilePicker');
    }
  });

  it('skips no-op bind() persistence & no-op createWritable() mtime churn, backs up store before into="db", resolves list buttons via itemDataMap, synchronize multi-container [naizo-list] views, and verifies shipped dist/naizo.js parity (M15.1, D52, D59, EC31, EC58-EC61)', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          _meta: {},
          fields: { headline: 'Remote Preset Headline' },
          lists: {
            tasks: [{ id: 'r1', title: 'Remote Task' }],
          },
          custom: { remoteLoaded: true },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      document.documentElement.setAttribute('naizo-id', 'm15-1-parity-suite');
      const startDb: NaizoDatabase = {
        _meta: { updatedAt: '2026-11-19T00:00:00.000Z' },
        fields: { headline: 'Local Headline' },
        lists: {
          tasks: [
            { id: 't1', title: 'Alpha' },
            { id: 't2', title: 'Beta' },
            { id: 't3', title: 'Gamma' },
          ],
        },
        custom: {},
      };
      const startJson = JSON.stringify(startDb, null, 2);
      let diskHtml = `<!doctype html><html naizo-id="m15-1-parity-suite"><head><script id="naizodb" type="application/json">\n${startJson}\n</script></head><body></body></html>`;
      let diskMtime = 1000;
      const createWritableSpy = vi.fn().mockImplementation(async () => ({
        write: async (data: string) => {
          diskHtml = data;
          diskMtime += 100;
        },
        close: async () => {},
      }));

      document.head.innerHTML = `<script id="naizodb" type="application/json">\n${startJson}\n</script>`;
      document.body.innerHTML = `
        <input id="h-in" type="text" naizo="headline" value="" />
        <div id="dyn-slot"></div>
        <button id="load-preset" type="button" naizo-get="https://api.example.com/preset">Load Preset</button>
        <section id="sidebar-view">
          <ul id="list-sidebar" naizo-list="tasks">
            <template naizo-template>
              <li naizo-item><span class="s-title" naizo="title"></span><label><input class="s-in" type="text" naizo="title" value="New Task" /></label></li>
            </template>
          </ul>
        </section>
        <section id="detail-view">
          <div id="list-detail" data-naizo-list="tasks">
            <template naizo-template>
              <article data-naizo-item><label><input class="d-in" type="text" data-naizo="title" value="New Task" /></label></article>
            </template>
          </div>
        </section>
      `;

      await initNaizo();

      window.showSaveFilePicker = vi.fn().mockResolvedValue({
        name: 'index.html',
        queryPermission: vi.fn().mockResolvedValue('granted'),
        requestPermission: vi.fn().mockResolvedValue('granted'),
        getFile: vi.fn().mockImplementation(async () => ({
          lastModified: diskMtime,
          text: async () => diskHtml,
        })),
        createWritable: createWritableSpy,
      });

      // 1. Linking when on-disk #naizodb already matches payloadToWrite skips createWritable() & preserves mtime!
      expect(await Naizo.link()).toBe(true);
      expect(createWritableSpy).not.toHaveBeenCalled();
      expect(diskMtime).toBe(1000);
      expect(
        document.getElementById('__naizodb_host__')?.shadowRoot?.getElementById('status')
          ?.textContent,
      ).toBe('Synced to Disk');

      // Calling Naizo.save() with zero changes also skips createWritable() & preserves mtime
      expect(await Naizo.save()).toBe(true);
      expect(createWritableSpy).not.toHaveBeenCalled();
      expect(diskMtime).toBe(1000);

      // 2. Naizo.bind(root): skips schedulePersist() when seeding mutates 0 keys, schedules when seeding adds new key
      const dynSlot = document.getElementById('dyn-slot')!;
      dynSlot.innerHTML = `<span id="mirror-h" naizo="headline"></span>`;
      Naizo.bind(dynSlot);
      expect(document.getElementById('mirror-h')?.textContent).toBe('Local Headline');
      await vi.advanceTimersByTimeAsync(500);
      expect(createWritableSpy).not.toHaveBeenCalled();
      expect(readScriptDb()._meta.updatedAt).toBe('2026-11-19T00:00:00.000Z');

      dynSlot.innerHTML = `<input id="seeded-new" type="text" naizo="newly_seeded" value="SeededVal" />`;
      Naizo.bind(dynSlot);
      await vi.advanceTimersByTimeAsync(500);
      expect(Naizo.getField('newly_seeded')).toBe('SeededVal');
      expect(createWritableSpy).toHaveBeenCalledTimes(1);

      // 3. Multi-container [naizo-list] synchronization + EC31 focus only on clicked container + WeakMap itemDataMap click lookup
      const sidebarEl = document.getElementById('list-sidebar')!;
      const detailEl = document.getElementById('list-detail')!;
      expect(sidebarEl.querySelectorAll('[naizo-item]')).toHaveLength(3);
      expect(detailEl.querySelectorAll('[data-naizo-item]')).toHaveLength(3);

      // Click + Add Item footer on the SECOND container (detailEl): both containers get item 4, focus lands ONLY on detailEl's new input!
      const detailFooterAdd =
        detailEl.nextElementSibling?.querySelector<HTMLButtonElement>('[naizo-add="tasks"]');
      expect(detailFooterAdd).not.toBeNull();
      detailFooterAdd?.click();
      expect(sidebarEl.querySelectorAll('[naizo-item]')).toHaveLength(4);
      expect(detailEl.querySelectorAll('[data-naizo-item]')).toHaveLength(4);
      const lastDetailInput = detailEl.querySelectorAll<HTMLInputElement>('.d-in')[3] ?? null;
      expect(document.activeElement).toBe(lastDetailInput);

      // Typing in detail container live-mirrors to sidebar container
      lastDetailInput!.value = 'Delta Live';
      lastDetailInput!.dispatchEvent(new Event('input', { bubbles: true }));
      expect(sidebarEl.querySelectorAll('.s-title')[3]?.textContent).toBe('Delta Live');

      // Programmatic updateItem & moveItem update BOTH containers
      Naizo.updateItem('tasks', 0, { title: 'Alpha Updated' });
      expect(sidebarEl.querySelectorAll('.s-title')[0]?.textContent).toBe('Alpha Updated');
      expect(detailEl.querySelectorAll<HTMLInputElement>('.d-in')[0]?.value).toBe('Alpha Updated');

      Naizo.moveItem('tasks', 0, 2); // order: [t2(Beta), t3(Gamma), t1(Alpha Updated), Delta Live]
      expect(
        Array.from(detailEl.querySelectorAll<HTMLInputElement>('.d-in')).map((el) => el.value),
      ).toEqual(['Beta', 'Gamma', 'Alpha Updated', 'Delta Live']);

      // Simulate SortableJS reordering DOM nodes in sidebarEl out-of-sync with store (putting 'Gamma' row at DOM index 0), then click its × remove button!
      const sidebarItems = Array.from(sidebarEl.querySelectorAll<HTMLElement>('[naizo-item]'));
      const gammaSidebarRow = sidebarItems[1]!; // store index 1 ('Gamma')
      sidebarEl.insertBefore(gammaSidebarRow, sidebarItems[0]!); // now at DOM index 0!
      gammaSidebarRow.querySelector<HTMLButtonElement>('[naizo-remove]')?.click();

      // WeakMap lookup resolved true store index 1 ('Gamma'), keeping 'Beta' (index 0) intact across store and BOTH containers!
      expect(Naizo.getList('tasks').map((t) => t.title)).toEqual([
        'Beta',
        'Alpha Updated',
        'Delta Live',
      ]);
      expect(
        Array.from(detailEl.querySelectorAll<HTMLInputElement>('.d-in')).map((el) => el.value),
      ).toEqual(['Beta', 'Alpha Updated', 'Delta Live']);
      expect(sidebarEl.querySelectorAll('[naizo-item]')).toHaveLength(3);

      // Also test [naizo-move="up"] after DOM reordering via itemDataMap: put 'Delta Live' (store index 2) at DOM index 0 and click ↑
      const sidebarAfterRemove = Array.from(
        sidebarEl.querySelectorAll<HTMLElement>('[naizo-item]'),
      );
      const deltaSidebarRow = sidebarAfterRemove[2]!; // store index 2 ('Delta Live')
      sidebarEl.insertBefore(deltaSidebarRow, sidebarAfterRemove[0]!); // DOM index 0, but store index is 2!
      deltaSidebarRow.querySelector<HTMLButtonElement>('[naizo-move="up"]')?.click();
      // Store index 2 moved up to store index 1!
      expect(Naizo.getList('tasks').map((t) => t.title)).toEqual([
        'Beta',
        'Delta Live',
        'Alpha Updated',
      ]);

      // 4. Declarative naizo-get (default into="db") backs up non-empty store to naizodb_backup_<key> before replacing store
      document.getElementById('load-preset')?.click();
      await vi.advanceTimersByTimeAsync(50);
      expect(Naizo.getField('headline')).toBe('Remote Preset Headline');
      expect(Naizo.getList('tasks')).toEqual([{ id: 'r1', title: 'Remote Task' }]);
      const dbBackup = localStorage.getItem('naizodb_backup_/::m15-1-parity-suite');
      expect(dbBackup).not.toBeNull();
      expect(dbBackup).toContain('"Alpha Updated"');
      const restoreBtn = document
        .getElementById('__naizodb_host__')
        ?.shadowRoot?.getElementById('restore') as HTMLButtonElement | null;
      expect(restoreBtn?.style.display).toBe('inline-block');

      // 5. Shipped dist/naizo.js IIFE bundle parity across M15.1 features + < 100,000 bytes minified raw guardrail
      const minBundleBytes = readFileSync(resolve(process.cwd(), 'dist/naizo.min.js')).byteLength;
      expect(minBundleBytes).toBeLessThan(100_000);

      await Naizo.unlink();
      window.__naizoCleanup?.();
      localStorage.clear();
      document.documentElement.setAttribute('data-naizo-manual', 'true');
      document.documentElement.setAttribute('naizo-id', 'm15-1-bundle-parity');

      const bundleBaseDb: NaizoDatabase = {
        _meta: {},
        fields: { owner: 'Kenji' },
        lists: {
          cards: [
            { id: 'c1', name: 'Card 1', status: 'open' },
            { id: 'c2', name: 'Card 2', status: 'open' },
          ],
        },
        custom: {},
      };
      let bundleDisk = `<!-- <script id="naizodb">{"fields":{"commentedOut":true}}</script> --><!doctype html><html naizo-id="m15-1-bundle-parity"><head><script id="naizodb" type="application/json">\n${JSON.stringify(bundleBaseDb, null, 2)}\n</script></head><body></body></html>`;
      let bundleMtime = 2000;
      const bundleWritableSpy = vi.fn().mockImplementation(async () => ({
        write: async (data: string) => {
          bundleDisk = data;
          bundleMtime += 100;
        },
        close: async () => {},
      }));

      document.head.innerHTML = `<script id="naizodb" type="application/json">\n${JSON.stringify(bundleBaseDb, null, 2)}\n</script>`;
      document.body.innerHTML = `
        <div id="b-list-a" naizo-list="cards">
          <template naizo-template><div naizo-item><label><input class="ba-in" type="text" naizo="name" value="" /></label></div></template>
        </div>
        <div id="b-list-b" naizo-list="cards">
          <template naizo-template><div naizo-item><span class="bb-span" naizo="name"></span></div></template>
        </div>
      `;

      runInThisContext(iifeBundleCode);
      const bNaizo = window.Naizo;
      await bNaizo.init();

      window.showSaveFilePicker = vi.fn().mockResolvedValue({
        name: 'index.html',
        queryPermission: vi.fn().mockResolvedValue('granted'),
        requestPermission: vi.fn().mockResolvedValue('granted'),
        getFile: vi.fn().mockImplementation(async () => ({
          lastModified: bundleMtime,
          text: async () => bundleDisk,
        })),
        createWritable: bundleWritableSpy,
      });

      // No-op initial link skips createWritable() and skips HTML comment #naizodb
      expect(await bNaizo.link()).toBe(true);
      expect(bundleWritableSpy).not.toHaveBeenCalled();

      // Multi-container sync + active row preservation across live 3-way per-item merge in shipped bundle
      const firstBundleRow = document.querySelector<HTMLElement>('#b-list-a > [naizo-item]')!;
      const firstBundleIn = firstBundleRow.querySelector<HTMLInputElement>('.ba-in')!;
      firstBundleIn.focus();
      bNaizo.updateItem('cards', 0, { status: 'review' });
      firstBundleIn.value = 'Card 1 Typing...';

      const bundleAgentDb: NaizoDatabase = {
        _meta: {},
        fields: { owner: 'Kenji' },
        lists: {
          cards: [
            { id: 'c1', name: 'Card 1', status: 'open' },
            { id: 'c2', name: 'Card 2 (AI)', status: 'done' },
            { id: 'c3', name: 'Card 3 (AI)', status: 'open' },
          ],
        },
        custom: {},
      };
      bundleDisk = `<!-- <script id="naizodb">{"fields":{"commentedOut":true}}</script> --><!doctype html><html naizo-id="m15-1-bundle-parity"><head><script id="naizodb" type="application/json">\n${JSON.stringify(bundleAgentDb, null, 2)}\n</script></head><body></body></html>`;
      bundleMtime += 500;

      await vi.advanceTimersByTimeAsync(2100);
      expect(bNaizo.getList('cards')).toEqual([
        { id: 'c1', name: 'Card 1', status: 'review' },
        { id: 'c2', name: 'Card 2 (AI)', status: 'done' },
        { id: 'c3', name: 'Card 3 (AI)', status: 'open' },
      ]);
      expect(document.querySelectorAll('#b-list-a > [naizo-item]')[0]).toBe(firstBundleRow);
      expect(document.activeElement).toBe(firstBundleIn);
      expect(firstBundleIn.value).toBe('Card 1 Typing...');
      expect(
        Array.from(document.querySelectorAll('#b-list-b .bb-span')).map((el) => el.textContent),
      ).toEqual(['Card 1', 'Card 2 (AI)', 'Card 3 (AI)']);

      await vi.advanceTimersByTimeAsync(350);
      expect(bundleDisk).toContain('{"fields":{"commentedOut":true}}');
      expect(bundleDisk).toContain('"status": "review"');

      // Live malformed disk JSON pause + auto-recovery in shipped bundle
      const bWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        bundleDisk = `<!doctype html><html naizo-id="m15-1-bundle-parity"><head><script id="naizodb" type="application/json">{broken</script></head><body></body></html>`;
        bundleMtime += 500;
        await vi.advanceTimersByTimeAsync(2100);
        expect(
          document.getElementById('__naizodb_host__')?.shadowRoot?.getElementById('status')
            ?.textContent,
        ).toBe('Invalid #naizodb JSON');
        expect(localStorage.getItem('naizodb_raw_backup_/::m15-1-bundle-parity')).toBe('{broken');

        bundleDisk = `<!doctype html><html naizo-id="m15-1-bundle-parity"><head><script id="naizodb" type="application/json">\n${JSON.stringify(bundleAgentDb, null, 2)}\n</script></head><body></body></html>`;
        bundleMtime += 500;
        await vi.advanceTimersByTimeAsync(2100);
        expect(
          document.getElementById('__naizodb_host__')?.shadowRoot?.getElementById('status')
            ?.textContent,
        ).toBe('Synced to Disk');
      } finally {
        bWarnSpy.mockRestore();
      }
      await bNaizo.unlink();
    } finally {
      window.__naizoCleanup?.();
      document.documentElement.removeAttribute('naizo-id');
      document.documentElement.removeAttribute('data-naizo-manual');
      Reflect.deleteProperty(window, 'showSaveFilePicker');
      window.Naizo = Naizo;
      window.NaizoDB = NaizoDB;
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('enforces M15.2 Chromium <select> & .kpi-card CSS invariants across site/index.html, examples/*.html, and basecoat-ui-and-dense-forms.md, plus versionless contributor and test labels (M15.2, D01, D33, D59, EC61)', () => {
    const currentSiteHtml = readFileSync(resolve(process.cwd(), 'site/index.html'), 'utf-8');
    const currentInventoryHtml = readFileSync(
      resolve(process.cwd(), 'examples/inventory.html'),
      'utf-8',
    );
    const basecoatCookbook = readFileSync(
      resolve(process.cwd(), 'skills/naizo/references/cookbook/basecoat-ui-and-dense-forms.md'),
      'utf-8',
    );
    const agentsMd = readFileSync(resolve(process.cwd(), 'AGENTS.md'), 'utf-8');
    const productMd = readFileSync(resolve(process.cwd(), 'docs/PRODUCT.md'), 'utf-8');
    const thisTestSource = readFileSync(resolve(process.cwd(), 'tests/naizo.test.ts'), 'utf-8');

    // 1. Zero CSS rules targeting <select> / .select may set `display: block` across site/index.html & all examples/*.html
    const htmlSurfaces: Array<[string, string]> = [
      ['site/index.html', currentSiteHtml],
      ['examples/starter.html', starterHtml],
      ['examples/checklist.html', checklistHtml],
      ['examples/notes.html', notesHtml],
      ['examples/inventory.html', currentInventoryHtml],
      ['examples/weather.html', weatherHtml],
    ];
    for (const [label, html] of htmlSurfaces) {
      const styleBlocks = Array.from(html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)).map(
        (m) => (m[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, ''),
      );
      for (const css of styleBlocks) {
        for (const ruleMatch of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
          const selectors = (ruleMatch[1] ?? '').split(',').map((s) => s.trim());
          const body = ruleMatch[2] ?? '';
          const targetsSelect = selectors.some((sel) =>
            /(?:^|[\s>+~])select(?:$|[\s.:#[[\]])|\.select\b/.test(sel),
          );
          if (targetsSelect) {
            expect(body, `${label} selector "${selectors.join(', ')}"`).not.toMatch(
              /display\s*:\s*block\b/i,
            );
          }
        }
      }
    }

    // Verify site/index.html keeps width: 100%, min-width: 0, max-width: 100% on .field-group select & display: block on text/textarea
    expect(currentSiteHtml).toContain('.spec-meta-row > * {\n        min-width: 0;\n      }');
    expect(currentSiteHtml).toMatch(
      /\.field-group input\[type='text'\],\s*\.field-group select,\s*\.field-group textarea\s*\{\s*width:\s*100%;\s*min-width:\s*0;\s*max-width:\s*100%;/,
    );
    expect(currentSiteHtml).toMatch(
      /\.field-group input\[type='text'\],\s*\.field-group textarea\s*\{\s*display:\s*block;\s*\}/,
    );

    // 2. Standalone Basecoat .select `appearance: none` + `.kpi-card` alignment in examples/inventory.html & cookbook
    expect(currentInventoryHtml).toMatch(
      /\.select\s*\{\s*appearance:\s*none;\s*-webkit-appearance:\s*none;\s*\}/,
    );
    expect(currentInventoryHtml).toMatch(
      /\.kpi-card\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;\s*justify-content:\s*space-between;\s*\}/,
    );
    expect(basecoatCookbook).toMatch(
      /\.select\s*\{\s*appearance:\s*none;\s*-webkit-appearance:\s*none;\s*\}/,
    );
    expect(basecoatCookbook).toContain('display: block');
    expect(basecoatCookbook).toContain('-webkit-appearance: none');

    // 3. Versionless contributor & test labels (D01, D33, EC61)
    const hardcodedTag = `v${'0.1.0'}`;
    expect(agentsMd).not.toContain(hardcodedTag);
    expect(agentsMd).toContain('@0.1.0');
    expect(productMd).not.toContain(hardcodedTag);

    const testTitles = Array.from(
      thisTestSource.matchAll(/^\s*(?:describe|it)\(\s*(['"`])([\s\S]*?)\1/gm),
    ).map((m) => m[2] ?? '');
    expect(testTitles.length).toBeGreaterThanOrEqual(46);
    for (const title of testTitles) {
      expect(title).not.toContain(hardcodedTag);
    }
  });
});
