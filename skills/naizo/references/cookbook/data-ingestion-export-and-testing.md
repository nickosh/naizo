# CSV Ingestion, Slack/Sheets Clipboard Exporters, CLI Pipelines, & Playwright Testing

Use this guide when building **`naizo.js`** applications that import local **CSV / spreadsheet files**, copy formatted **Slack reports or Google Sheets TSV rows** to the clipboard, seed `<script id="naizodb">` from **CLI tools (`gws`, Node.js, Python)**, or verify behavior with **Playwright**.

---

## 1. `file://`-Safe Drag-and-Drop CSV Import (`FileReader` + PapaParse + `rowHash` Deduplication)

Reading local files via `<input type="file">` or drag-and-drop (`e.dataTransfer.files[0]`) + `file.text()` / `FileReader` works 100% offline on `file://` with zero CORS restrictions.

To make repeated CSV imports **idempotent** (so dropping an updated survey export appends only new rows without duplicating existing items or wiping human triage edits) and **instant** (zero `O(N)` render storms):

1. Compute a deterministic **`rowHash`** fingerprint (`fnv1aRowHash(`${timestamp}|${email}|${name}`)`) for each CSV row.
2. Compare incoming hashes against existing `Naizo.getList('raw_records')` hashes and append only unseen rows.
3. Commit the combined array in **one single pass** via **`Naizo.setList('raw_records', nextRows)`** – never call `Naizo.addItem()` inside a 100-row loop (`EC54`).

```html
<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js" defer></script>

<div id="csv-dropzone" class="dropzone" naizo-ignore>
  <p>
    Drop a CSV export here, or
    <label
      ><input id="csv-file-input" type="file" accept=".csv,text/csv" hidden /><span
        >browse files</span
      ></label
    >.
  </p>
  <p id="csv-import-status"></p>
</div>

<script>
  function hashRowIdentity(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return 'r-' + (h >>> 0).toString(16).padStart(8, '0');
  }

  function ingestCsvText(csvText) {
    if (!window.Papa) return;
    const parsed = window.Papa.parse(csvText, { header: true, skipEmptyLines: 'greedy' });
    const existing = Naizo.getList('raw_records');
    const seen = new Set(existing.map((r) => String(r.rowHash || '')));
    const additions = [];

    for (const row of parsed.data) {
      const timestamp = String(row['Timestamp'] ?? '').trim();
      const submitter = String(row['Email Address'] ?? row['Owner'] ?? '').trim();
      const name = String(row['Tool Name'] ?? row['Name'] ?? '').trim();
      if (!name) continue;

      const rowHash = hashRowIdentity(
        `${timestamp}|${submitter.toLowerCase()}|${name.toLowerCase()}`,
      );
      if (seen.has(rowHash)) continue;
      seen.add(rowHash);
      additions.push({
        id: rowHash,
        rowHash,
        timestamp,
        submitter,
        name,
        notes: String(row['Notes'] ?? '').trim(),
      });
    }

    if (additions.length > 0) {
      // Single-pass validated update: 1 DOM pass, 1 persistence write, 1 naizo:change event
      Naizo.setList('raw_records', [...existing, ...additions]);
    }
    document.getElementById('csv-import-status').textContent =
      `Added ${additions.length} new rows (${parsed.data.length - additions.length} duplicates skipped).`;
  }

  const dropzone = document.getElementById('csv-dropzone');
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.dataset.dragover = 'true';
  });
  dropzone.addEventListener('dragleave', () => {
    delete dropzone.dataset.dragover;
  });
  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    delete dropzone.dataset.dragover;
    const file = e.dataTransfer?.files?.[0];
    if (file) ingestCsvText(await file.text());
  });
  document.getElementById('csv-file-input').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) ingestCsvText(await file.text());
    e.target.value = '';
  });
</script>
```

---

## 2. Slack Markdown & Google Sheets TSV Clipboard Exporters (`file://`-Safe Fallback)

Single-file tools shine when humans can paste structured results straight into Slack or Google Sheets in 1 click:

- **Sanitize TSV cells:** Strip or collapse `\t` and `\r?\n` inside cell values (`val.replace(/[\t\r\n]+/g, ' ').trim()`) so multi-line `<textarea>` notes never split into extra spreadsheet rows or shift columns on paste.
- **Provide a `data-naizo-strip` clipboard fallback:** `navigator.clipboard.writeText()` can reject on non-secure origins or strict `file://` settings; fall back to a temporary `<textarea data-naizo-strip="true">` that is immediately removed after `document.execCommand('copy')`.

```javascript
async function copyTextSafe(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback on restricted file:// contexts
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('data-naizo-strip', 'true');
  ta.style.cssText = 'position: fixed; left: -9999px; top: 0; opacity: 0;';
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand('copy');
  } finally {
    ta.remove();
  }
}

function cleanTsvCell(val) {
  return String(val ?? '')
    .replace(/[\t\r\n]+/g, ' ')
    .trim();
}

// 1. Google Sheets Tab-Separated Values (pastes cleanly across columns A..F)
function buildSheetsTsv(cards, includeHeader = true) {
  const cols = ['Name', 'Owner', 'Status', 'Readiness', 'Link', 'Notes'];
  const lines = cards.map((c) =>
    [c.name, c.owner, c.status, c.readiness, c.link, c.notes].map(cleanTsvCell).join('\t'),
  );
  return (includeHeader ? [cols.join('\t'), ...lines] : lines).join('\n');
}

// 2. Slack Report Formatter (skips 0% allocations and flags incomplete months)
function buildSlackAllocationReport(months) {
  return months
    .map((m) => {
      const active = (m.allocations || []).filter((a) => Number(a.pct) > 0);
      if (active.length === 1 && Number(active[0].pct) === 100) {
        return `*${m.label}*\n• Only one project: ${active[0].project}`;
      }
      const bullets = active.map((a) => `• ${a.project}: ${a.pct}%`).join('\n');
      return `*${m.label}*\n${bullets || '• _No allocations recorded_'}`;
    })
    .join('\n\n');
}
```

---

## 3. CLI Data-Seeding Pipelines (`gws`, Excel `.xlsx`, CSV → Surgical `#naizodb` Writers)

Because `<script id="naizodb" type="application/json">` is plain UTF-8 JSON inside `<head>`, CLI scripts and AI agents can pull live rows from Google Sheets (`gws`), `.xlsx` workbooks, or CSV files and seed `#naizodb` surgically on disk without touching `<body>` layout or styles (`D16`, `EC08`):

### (a) Google Workspace CLI (`gws`) + Node.js Surgical `#naizodb` Update

```bash
# 1. Export sheet values via Google Workspace CLI (gws) to a scratch JSON file
gws sheets spreadsheets values get \
  --params '{"spreadsheetId": "YOUR_SHEET_ID", "range": "Tracker!A1:H200"}' \
  > /tmp/sheet-values.json

# 2. Transform rows and surgically update <script id="naizodb"> (escaping '<' as \u003c)
node -e '
const fs = require("fs");
const htmlPath = "studio.html";
const sheet = JSON.parse(fs.readFileSync("/tmp/sheet-values.json", "utf8"));
const [headers = [], ...rows] = sheet.values || [];

const items = rows
  .filter((r) => r.some((cell) => String(cell || "").trim() !== ""))
  .map((r, idx) => {
    const obj = Object.fromEntries(headers.map((h, i) => [h.trim(), String(r[i] ?? "").trim()]));
    return {
      id: `row-${idx + 1}`,
      name: obj["Name"] || "Untitled",
      owner: obj["Owner"] || "",
      status: obj["Status"] || "",
      notes: obj["Notes"] || "",
    };
  });

const html = fs.readFileSync(htmlPath, "utf8");
const re = /(<script\b[^>]*\bid\s*=\s*(?:"naizodb"|\x27naizodb\x27|naizodb(?=[>\s/]))[^>]*>)([\s\S]*?)(<\/script>)/i;
const match = html.match(re);
if (!match) throw new Error("Missing #naizodb block");

const db = JSON.parse(match[2]);
db.lists.cards = items;
db._meta = { ...db._meta, updatedAt: new Date().toISOString() };

const json = JSON.stringify(db, null, 2).replace(/</g, "\\u003c");
// Always use a replacement callback so "$1" or "$&" in cell data is never mangled
fs.writeFileSync(htmlPath, html.replace(re, (_m, open, _inner, close) => `${open}\n${json}\n${close}`), "utf8");
'
```

### (b) Python 3 Surgical `#naizodb` Writer (for `.csv` or `openpyxl` `.xlsx` Pipelines)

```python
import csv
import datetime as dt
import json
import pathlib
import re

html_path = pathlib.Path("studio.html")
db_re = re.compile(
    r'(<script\b[^>]*\bid\s*=\s*(?:"naizodb"|\'naizodb\'|naizodb(?=[>\s/]))[^>]*>)([\s\S]*?)(</script>)',
    re.IGNORECASE,
)

with open("seed.csv", newline="", encoding="utf-8-sig") as f:
    cards = [
        {"id": f"c-{i}", "name": row["Name"].strip(), "status": row.get("Status", "").strip()}
        for i, row in enumerate(csv.DictReader(f), start=1)
        if row.get("Name", "").strip()
    ]

html = html_path.read_text(encoding="utf-8")
match = db_re.search(html)
if not match:
    raise RuntimeError("Missing #naizodb block")

db = json.loads(match.group(2))
db.setdefault("lists", {})["cards"] = cards
db.setdefault("_meta", {})["updatedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()

payload = json.dumps(db, indent=2, ensure_ascii=False).replace("<", "\\u003c")
updated = db_re.sub(lambda m: f"{m.group(1)}\n{payload}\n{m.group(3)}", html, count=1)
html_path.write_text(updated, encoding="utf-8")
```

---

## 4. Automated Playwright Verification for `naizo.js` Applications

When verifying a `naizo.js` HTML file in Playwright (over `file://` or `http://localhost`):

1. **Account for per-key 3-way FNV-1a merge (`naizodb_disk_hash_<key>`):** If an earlier test run deleted an item or edited `lists.cards` in `localStorage` without linking disk, editing _another_ key in `<script id="naizodb">` on disk will merge with cached `lists.cards` rather than overwriting it (`D16`, `EC46`). Use a fresh `browser.newContext()` or run `localStorage.clear()` / `Naizo.reset()` when testing fresh disk defaults.
2. **Wait for `Naizo.ready()` before asserting hydrated DOM:** Especially when `naizo.js` loads from CDN with `defer`.
3. **Assert zero `console.warn` and `pageerror` messages:** Automatically catches missing `<select>` options (`EC15`), invalid JSON values (`EC35`), and runaway `naizo:change` cycles (`EC54`).
4. **Inspect the Shadow DOM Status Pill cleanly:** Playwright's default CSS locators (`page.locator('#__naizodb_host__ #status')`) pierce `#__naizodb_host__`'s open Shadow DOM automatically:

```javascript
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('hydrates studio cleanly, resets cached edits, and exports strip-clean HTML', async ({
  page,
}) => {
  const warnings = [];
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'warning' || msg.type() === 'error') warnings.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  const fileUrl = pathToFileURL(path.resolve('studio.html')).href;
  await page.goto(fileUrl);

  // 1. Wait until window.Naizo has completed initial hydration (EC57)
  await page.waitForFunction(() => Boolean(window.Naizo));
  await page.evaluate(() => new Promise((resolve) => window.Naizo.ready(() => resolve(true))));

  // 2. Ensure clean disk baseline if reusing a persistent browser profile
  await page.evaluate(() => window.Naizo.reset());

  // 3. Pierce #__naizodb_host__ Shadow DOM automatically
  await expect(page.locator('#__naizodb_host__ #status')).toContainText('Browser Cache');
  await expect(page.locator('#__naizodb_host__ #reset')).toBeHidden();

  // 4. Mutate a bound input, verify unlinked Reset appears, and check clean exportHTML()
  await page
    .locator('[naizo-list="cards"] [naizo-item] input[naizo="name"]')
    .first()
    .fill('Updated');
  await expect(page.locator('#__naizodb_host__ #reset')).toBeVisible();

  const exported = await page.evaluate(() => window.Naizo.exportHTML());
  expect(exported).toContain('"Updated"');
  expect(exported).not.toContain('__naizodb_host__');
  expect(exported).not.toContain('data-naizo-strip');

  expect(warnings).toEqual([]);
  expect(errors).toEqual([]);
});
```

---

## 5. Pitfalls to Avoid & Why

- **Looping `Naizo.addItem()` or `Naizo.removeItem()` across 100+ imported CSV rows:** Fires `O(N)` synchronous DOM clones, full-DB `JSON.stringify` passes, and `naizo:change` events on half-populated arrays (`EC54`). Always build the array in memory and call `Naizo.setList(name, rows)` once.
- **Using string replacement `html.replace(re, '$1\n' + json + '\n$3')` in Node.js CLI scripts:** JavaScript treats `$&`, `$1`, and `$$` inside the replacement string as regex capture tokens, silently corrupting user notes containing dollar amounts (`$100`) or shell snippets (`D54`). Always pass a replacement function `(_m, open, _inner, close) => ...`.
- **Forgetting `.replace(/</g, '\\u003c')` when writing `#naizodb` from Python or Node:** A literal `</script>` or `<!--` inside a user's imported CSV comment prematurely terminates `<script id="naizodb">` and breaks the HTML document (`EC08`).
- **Mutating `db.lists.raw_records` destructively during deduplication:** Deletes original survey/CSV provenance so mistakes cannot be un-merged. Keep `raw_records` immutable and record merge/triage decisions in `db.custom` or a separate canonical list (`D58`).
