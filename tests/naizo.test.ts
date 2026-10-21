import { runInThisContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import iifeBundleCode from '../dist/naizo.js?raw';
import checklistHtml from '../examples/checklist.html?raw';
import starterHtml from '../examples/starter.html?raw';
import pkgJson from '../package.json';
import siteHtml from '../site/index.html?raw';
import { initNaizo, Naizo, NaizoDB, parseDbScript } from '../src/index';

describe('naizo.js v0.1.0 core runtime', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-naizo-manual');
    document.documentElement.removeAttribute('naizo-manual');
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

  it('strips [data-naizo-runtime] UI while preserving user [naizo-ignore] elements in exportHTML (D12, EC03, EC07)', async () => {
    document.body.innerHTML = `
      <input type="text" naizo="project" value="naizo">
      <div naizo-list="items">
        <div naizo-item><input type="text" naizo="name" value="One"></div>
      </div>
      <div naizo-ignore><input type="range" id="user-widget" value="50">User widget</div>
      <div data-naizo-ignore>Legacy user widget</div>
      <div data-naizo-runtime="true">Ephemeral runtime overlay</div>
    `;

    await initNaizo();

    const exported = Naizo.exportHTML();
    expect(exported).not.toContain('__naizodb_host__');
    expect(exported).not.toContain('__naizodb_styles__');
    expect(exported).not.toContain('naizo-item-tools');
    expect(exported).not.toContain('naizo-list-footer');
    expect(exported).not.toContain('Ephemeral runtime overlay');
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
    expect(parseDbScript().fields.status).toBe('Approved');

    // Verify malformed #naizodb JSON resets cleanly without throwing (EC04)
    document.head.innerHTML = `<script id="naizodb" type="application/json">{not valid json</script>`;
    expect(parseDbScript()).toEqual({ _meta: {}, fields: {}, lists: {}, custom: {} });
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('keeps ESM entry side-effect free and emits clean dist/naizo.js IIFE with data-naizo-manual opt-out (D17, D25, EC37)', async () => {
    // ESM import does not auto-mount #__naizodb_host__ before initNaizo() is called
    expect(document.getElementById('__naizodb_host__')).toBeNull();
    expect(Naizo).toBe(NaizoDB);
    expect(typeof Naizo.init).toBe('function');

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

  it('hydrates site/index.html and examples/ starter templates with wrapping labels (M3.2, EC39)', async () => {
    for (const html of [siteHtml, starterHtml, checklistHtml]) {
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
    expect(parseDbScript().fields.title).toBe('Typed During IDB Wait');

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
    expect(parseDbScript().custom.rate).toBe(250);

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
    expect(parseDbScript().fields.snippet).toBe('</script><!--<script>alert(1)</script>');

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

    Reflect.deleteProperty(window, 'showSaveFilePicker');
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
    expect(parseDbScript().fields.author).toBe('Alice');
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

    expect(qsaSpy).toHaveBeenCalledWith(
      '[naizo="title"], [data-naizo="title"], [data-naizo-field="title"]',
    );
    expect(setAttrSpy).not.toHaveBeenCalled();
    qsaSpy.mockRestore();
    setAttrSpy.mockRestore();

    // Flush pending debounced persistence via visibilitychange -> hidden (EC16)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(parseDbScript().fields.title).toBe('Typed O(1)');
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
});
