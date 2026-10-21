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

  it('strips runtime UI and naizo-ignore / data-naizo-ignore elements in exportHTML (EC03)', async () => {
    document.body.innerHTML = `
      <input type="text" naizo="project" value="naizo">
      <div naizo-list="items">
        <div naizo-item><input type="text" naizo="name" value="One"></div>
      </div>
      <div naizo-ignore>Runtime temp</div>
      <div data-naizo-ignore>Legacy runtime temp</div>
    `;

    await initNaizo();

    const exported = Naizo.exportHTML();
    expect(exported).not.toContain('__naizodb_host__');
    expect(exported).not.toContain('__naizodb_styles__');
    expect(exported).not.toContain('naizo-item-tools');
    expect(exported).not.toContain('naizo-list-footer');
    expect(exported).not.toContain('Runtime temp');
    expect(exported).not.toContain('Legacy runtime temp');
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
});
