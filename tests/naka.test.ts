import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import iifeBundleCode from '../dist/naka.js?raw';
import checklistHtml from '../examples/checklist.html?raw';
import starterHtml from '../examples/starter.html?raw';
import pkgJson from '../package.json';
import siteHtml from '../site/index.html?raw';
import { initNaka, Naka, NakaDB, parseDbScript } from '../src/index';

describe('naka.js v0.1.0 core runtime', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-naka-manual');
    document.documentElement.removeAttribute('naka-manual');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('hydrates and bakes standalone fields with both naka and data-naka attributes', async () => {
    document.head.innerHTML = `
      <script id="nakadb" type="application/json">
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
      <h1 contenteditable="true" naka="title">Draft</h1>
      <input type="text" data-naka="owner" value="">
      <input type="checkbox" naka="approved">
      <input type="radio" name="tier" naka="tier" value="free">
      <input type="radio" name="tier" naka="tier" value="pro">
      <select naka="status">
        <option value="Draft">Draft</option>
        <option value="Approved">Approved</option>
      </select>
      <textarea data-naka="summary"></textarea>
    `;

    await initNaka();

    const h1 = document.querySelector('[naka="title"]') as HTMLElement;
    const owner = document.querySelector('[data-naka="owner"]') as HTMLInputElement;
    const approved = document.querySelector('[naka="approved"]') as HTMLInputElement;
    const radios = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    const select = document.querySelector('select[naka="status"]') as HTMLSelectElement;
    const textarea = document.querySelector('textarea[data-naka="summary"]') as HTMLTextAreaElement;

    expect(h1.innerHTML).toBe('Spec v1');
    expect(owner.value).toBe('Kenji');
    expect(owner.getAttribute('value')).toBe('Kenji');
    expect(approved.checked).toBe(true);
    expect(approved.getAttribute('checked')).toBe('checked');
    expect(radios[0]?.checked).toBe(false);
    expect(radios[1]?.checked).toBe(true);
    expect(radios[1]?.getAttribute('checked')).toBe('checked');
    expect(select.value).toBe('Approved');
    expect(select.options[1]?.getAttribute('selected')).toBe('selected');
    expect(textarea.value).toBe('Initial notes');
    expect(textarea.textContent).toBe('Initial notes');
  });

  it('supports declarative list repeaters (naka-list & data-naka-list) and clears plain text in inferred templates (EC05)', async () => {
    document.head.innerHTML = `
      <script id="nakadb" type="application/json">
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
      <div naka-list="tasks">
        <div naka-item>
          <input type="checkbox" naka="done" checked>
          <input type="text" naka="title" value="Initial seed">
          <span naka="tag">SeedTag</span>
        </div>
      </div>
    `;

    await initNaka();

    expect(Naka.getList('tasks')).toEqual([
      { done: true, title: 'First task', tag: 'core' },
      { done: false, title: 'Second task', tag: 'ui' },
    ]);

    // Add a blank item to verify the inferred template cleared the initial seed values (EC05)
    Naka.addItem('tasks', {});
    const listAfterAdd = Naka.getList('tasks');
    expect(listAfterAdd).toHaveLength(3);
    expect(listAfterAdd[2]).toEqual({ done: false, title: '', tag: '' });

    // Move and remove items
    Naka.moveItem('tasks', 1, 0);
    expect(Naka.getList('tasks')[0]?.title).toBe('Second task');

    Naka.removeItem('tasks', 2);
    expect(Naka.getList('tasks')).toHaveLength(2);
  });

  it('persists custom state via Naka.get / Naka.set and dispatches naka:hydrate', async () => {
    const hydrateSpy = vi.fn();
    window.addEventListener('naka:hydrate', hydrateSpy);

    await initNaka();
    expect(hydrateSpy).toHaveBeenCalledTimes(1);

    Naka.set('rateLimitRps', 350);
    expect(Naka.get('rateLimitRps')).toBe(350);
    expect((Naka.get() as { custom: Record<string, unknown> }).custom.rateLimitRps).toBe(350);

    window.removeEventListener('naka:hydrate', hydrateSpy);
  });

  it('strips runtime UI and naka-ignore / data-naka-ignore elements in exportHTML (EC03)', async () => {
    document.body.innerHTML = `
      <input type="text" naka="project" value="nakajs">
      <div naka-list="items">
        <div naka-item><input type="text" naka="name" value="One"></div>
      </div>
      <div naka-ignore>Runtime temp</div>
      <div data-naka-ignore>Legacy runtime temp</div>
    `;

    await initNaka();

    const exported = Naka.exportHTML();
    expect(exported).not.toContain('__nakadb_host__');
    expect(exported).not.toContain('__nakadb_styles__');
    expect(exported).not.toContain('naka-item-tools');
    expect(exported).not.toContain('naka-list-footer');
    expect(exported).not.toContain('Runtime temp');
    expect(exported).not.toContain('Legacy runtime temp');
    expect(exported).toContain('"project": "nakajs"');
  });

  it('resolves conflicts in favor of disk when #nakadb changed externally, and recovers from malformed JSON (EC01, EC04, EC05)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pageKey = 'nakadb_state_' + location.pathname;
    const snapshotKey = 'nakadb_disk_hash_' + location.pathname;

    // Simulate stale localStorage cache with older disk snapshot
    localStorage.setItem(snapshotKey, '{"fields":{"status":"Draft"}}');
    localStorage.setItem(
      pageKey,
      JSON.stringify({ _meta: {}, fields: { status: 'Browser Cached' }, lists: {}, custom: {} }),
    );

    // AI agent updated #nakadb on disk to "Approved"
    document.head.innerHTML = `
      <script id="nakadb" type="application/json">
      {
        "_meta": {},
        "fields": { "status": "Approved" },
        "lists": {},
        "custom": {}
      }
      </script>
    `;
    document.body.innerHTML = `<input type="text" naka="status" value="Draft">`;

    await initNaka();

    const input = document.querySelector('[naka="status"]') as HTMLInputElement;
    expect(input.value).toBe('Approved');

    // Verify corrupted localStorage does not throw (EC05)
    localStorage.setItem(pageKey, '{corrupted json');
    await expect(initNaka()).resolves.toBeUndefined();
    expect(parseDbScript().fields.status).toBe('Approved');

    // Verify malformed #nakadb JSON resets cleanly without throwing (EC04)
    document.head.innerHTML = `<script id="nakadb" type="application/json">{not valid json</script>`;
    expect(parseDbScript()).toEqual({ _meta: {}, fields: {}, lists: {}, custom: {} });
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('keeps ESM entry side-effect free and emits clean dist/naka.js IIFE with data-naka-manual opt-out (D17, D25, EC37)', async () => {
    // ESM import does not auto-mount #__nakadb_host__ before initNaka() is called
    expect(document.getElementById('__nakadb_host__')).toBeNull();
    expect(Naka).toBe(NakaDB);
    expect(typeof Naka.init).toBe('function');

    // Package entrypoints agree: ESM for main/module/exports["."], IIFE for unpkg/jsdelivr
    expect(pkgJson.main).toBe('./dist/index.mjs');
    expect(pkgJson.module).toBe('./dist/index.mjs');
    expect(pkgJson.types).toBe('./dist/index.d.mts');
    expect(pkgJson.unpkg).toBe('./dist/naka.js');
    expect(pkgJson.jsdelivr).toBe('./dist/naka.js');
    expect(pkgJson.exports['./naka.min.js']).toBe('./dist/naka.min.js');
    expect(pkgJson.exports['./dist/naka.min.js']).toBe('./dist/naka.min.js');
    expect(pkgJson.files).toEqual([
      'dist/naka.js',
      'dist/naka.min.js',
      'dist/index.mjs',
      'dist/index.d.mts',
      'README.md',
      'CHANGELOG.md',
    ]);

    // Built dist/naka.js is a clean IIFE without NakaBundle global namespace
    expect(iifeBundleCode.startsWith('(function() {')).toBe(true);
    expect(iifeBundleCode).not.toContain('NakaBundle');
    expect(iifeBundleCode).toContain('window.Naka = Naka');
    expect(iifeBundleCode).toContain('data-naka-manual');

    // Loading src/iife.ts with data-naka-manual sets window.Naka without auto-booting
    Reflect.deleteProperty(window, 'Naka');
    Reflect.deleteProperty(window, 'NakaDB');
    document.documentElement.setAttribute('data-naka-manual', '');
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });

    await import('../src/iife');
    expect(window.Naka).toBe(Naka);
    expect(window.NakaDB).toBe(Naka);

    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.getElementById('__nakadb_host__')).toBeNull();

    // Removing data-naka-manual allows boot on DOMContentLoaded
    document.documentElement.removeAttribute('data-naka-manual');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.getElementById('__nakadb_host__')).not.toBeNull();

    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
  });

  it('hydrates site/index.html and examples/ starter templates with wrapping labels (M3.2, EC39)', async () => {
    for (const html of [siteHtml, starterHtml, checklistHtml]) {
      const parsedDoc = new DOMParser().parseFromString(html, 'text/html');
      const rawJson = parsedDoc.getElementById('nakadb')?.textContent?.trim() ?? '';
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

    await initNaka();

    const rows = Array.from(document.querySelectorAll<HTMLElement>('[naka-item]'));
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
});
