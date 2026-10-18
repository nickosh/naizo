import { beforeEach, describe, expect, it } from 'vite-plus/test';
import { initNaka, Naka, parseDbScript } from '../src/index';

describe('naka.js v0.1.0 core runtime', () => {
  beforeEach(() => {
    localStorage.clear();
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
          "approved": true
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
    `;

    await initNaka();

    const h1 = document.querySelector('[naka="title"]') as HTMLElement;
    const owner = document.querySelector('[data-naka="owner"]') as HTMLInputElement;
    const approved = document.querySelector('[naka="approved"]') as HTMLInputElement;

    expect(h1.innerHTML).toBe('Spec v1');
    expect(owner.value).toBe('Kenji');
    expect(owner.getAttribute('value')).toBe('Kenji');
    expect(approved.checked).toBe(true);
    expect(approved.getAttribute('checked')).toBe('checked');
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

  it('resolves conflicts in favor of disk when #nakadb changed externally, and recovers from corrupted localStorage (EC01, EC04, EC05)', async () => {
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

    // Also verify corrupted localStorage does not throw (EC05)
    localStorage.setItem(pageKey, '{corrupted json');
    await expect(initNaka()).resolves.toBeUndefined();
    expect(parseDbScript().fields.status).toBe('Approved');
  });
});
