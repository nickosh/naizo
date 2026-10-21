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
});
