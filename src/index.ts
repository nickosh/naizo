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
  getField(key: string): unknown;
  setField(key: string, value: unknown): void;
  deleteField(key: string): void;
  getList(listName: string): Array<Record<string, unknown>>;
  addItem(listName: string, itemData?: Record<string, unknown>): void;
  updateItem(listName: string, index: number, partialData: Record<string, unknown>): void;
  removeItem(listName: string, index: number): void;
  moveItem(listName: string, fromIndex: number, toIndex: number): void;
  bind(root?: ParentNode): void;
  save(): Promise<boolean>;
  unlink(): Promise<void>;
  copyJSON(): Promise<string>;
  exportHTML(): string;
}

interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemWritableFileStream {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface NaizoFile {
  lastModified?: number;
  text?: () => Promise<string>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}

interface NaizoFileHandle {
  queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  createWritable(): Promise<FileSystemWritableFileStream>;
  getFile?: () => Promise<NaizoFile>;
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
const PERSIST_DEBOUNCE_MS = 150;
const DISK_DEBOUNCE_MS = 250;
const DISK_WATCH_INTERVAL_MS = 2000;
const NAIZODB_SCRIPT_RE =
  /(<script\b[^>]*\bid\s*=\s*(?:"naizodb"|'naizodb'|naizodb(?=[>\s/]))[^>]*>)([\s\S]*?)(<\/script>)/i;
const HEAD_OPEN_RE = /(<head\b[^>]*>)/i;

const BOUND_SELECTOR = '[naizo], [data-naizo], [data-naizo-field]';
const LIST_SELECTOR = '[naizo-list], [data-naizo-list]';
const ITEM_SELECTOR = '[naizo-item], [data-naizo-item]';
const DIRECT_ITEM_SELECTOR = ':scope > [naizo-item], :scope > [data-naizo-item]';
const TEMPLATE_SELECTOR = 'template[naizo-template], template[data-naizo-template], template';
const IGNORE_SELECTOR = '[naizo-ignore], [data-naizo-ignore]';
const SKIPPED_INPUT_TYPES = new Set(['password', 'file', 'button', 'submit', 'reset', 'image']);

function hasOwn(obj: object, key: string): boolean {
  return Object.hasOwn(obj, key);
}

function getOwn(obj: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}

function setOwn(obj: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(obj, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

function deleteOwn(obj: Record<string, unknown>, key: string): void {
  if (Object.hasOwn(obj, key)) {
    Reflect.deleteProperty(obj, key);
  }
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) return false;
  const proto = Object.getPrototypeOf(val) as unknown;
  return proto === null || proto === Object.prototype;
}

function isValidJsonValue(val: unknown, seen: Set<object> = new Set()): boolean {
  if (val === null || typeof val === 'string' || typeof val === 'boolean') return true;
  if (typeof val === 'number') return Number.isFinite(val);
  if (
    typeof val === 'undefined' ||
    typeof val === 'function' ||
    typeof val === 'symbol' ||
    typeof val === 'bigint'
  ) {
    return false;
  }
  if (Array.isArray(val)) {
    if (seen.has(val)) return false;
    seen.add(val);
    for (let i = 0; i < val.length; i += 1) {
      if (!(i in val) || !isValidJsonValue(val[i], seen)) return false;
    }
    seen.delete(val);
    return true;
  }
  if (isPlainObject(val)) {
    if (seen.has(val)) return false;
    seen.add(val);
    for (const k of Object.keys(val)) {
      if (!isValidJsonValue(getOwn(val, k), seen)) return false;
    }
    seen.delete(val);
    return true;
  }
  return false;
}

function cloneJsonValue(val: unknown): unknown {
  if (Array.isArray(val)) {
    return val.map((item) => cloneJsonValue(item));
  }
  if (isPlainObject(val)) {
    return cloneRecord(val);
  }
  return val;
}

function cloneRecord(rec: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(rec)) {
    setOwn(out, key, cloneJsonValue(getOwn(rec, key)));
  }
  return out;
}

function createEmptyDb(): NaizoDatabase {
  return { _meta: {}, fields: {}, lists: {}, custom: {} };
}

function cloneDb(db: NaizoDatabase): NaizoDatabase {
  const lists: Record<string, Array<Record<string, unknown>>> = {};
  for (const listName of Object.keys(db.lists)) {
    const arr = getOwn(db.lists, listName);
    if (Array.isArray(arr)) {
      setOwn(
        lists,
        listName,
        arr.map((item) => (isPlainObject(item) ? cloneRecord(item) : {})),
      );
    }
  }
  return {
    _meta: cloneRecord(db._meta),
    fields: cloneRecord(db.fields),
    lists,
    custom: cloneRecord(db.custom),
  };
}

function validateAndNormalizeDb(parsed: unknown): NaizoDatabase | null {
  if (!isPlainObject(parsed)) return null;

  const rawMeta = hasOwn(parsed, '_meta') ? getOwn(parsed, '_meta') : {};
  const rawFields = hasOwn(parsed, 'fields') ? getOwn(parsed, 'fields') : {};
  const rawLists = hasOwn(parsed, 'lists') ? getOwn(parsed, 'lists') : {};
  const rawCustom = hasOwn(parsed, 'custom') ? getOwn(parsed, 'custom') : {};

  if (
    !isPlainObject(rawMeta) ||
    !isPlainObject(rawFields) ||
    !isPlainObject(rawLists) ||
    !isPlainObject(rawCustom)
  ) {
    return null;
  }

  const lists: Record<string, Array<Record<string, unknown>>> = {};
  for (const listName of Object.keys(rawLists)) {
    const rawArr = getOwn(rawLists, listName);
    if (!Array.isArray(rawArr)) return null;
    const cleanItems: Array<Record<string, unknown>> = [];
    for (const item of rawArr) {
      if (!isPlainObject(item)) return null;
      cleanItems.push(cloneRecord(item));
    }
    setOwn(lists, listName, cleanItems);
  }

  return {
    _meta: cloneRecord(rawMeta),
    fields: cloneRecord(rawFields),
    lists,
    custom: cloneRecord(rawCustom),
  };
}

function normalizePathname(rawPath: string): string {
  const cleaned = rawPath.replace(/\/index\.html?$/i, '/');
  return cleaned || '/';
}

function getDocumentScopeId(): string {
  if (typeof document === 'undefined') return '';
  const attrId =
    document.documentElement?.getAttribute('naizo-id') ??
    document.documentElement?.getAttribute('data-naizo-id') ??
    document.body?.getAttribute('naizo-id') ??
    document.body?.getAttribute('data-naizo-id');
  if (attrId && attrId.trim()) return attrId.trim();

  if (storeInitialized && typeof store._meta.id === 'string' && store._meta.id.trim()) {
    return store._meta.id.trim();
  }

  const raw = document.getElementById(DB_ID)?.textContent ?? '';
  if (raw.includes('"id"')) {
    try {
      const parsed = JSON.parse(raw) as { _meta?: { id?: unknown } };
      if (typeof parsed?._meta?.id === 'string' && parsed._meta.id.trim()) {
        return parsed._meta.id.trim();
      }
    } catch {
      // Ignore malformed JSON during scope lookup
    }
  }
  return '';
}

function getStorageSuffix(): string {
  const rawPath = typeof location !== 'undefined' && location.pathname ? location.pathname : '/';
  const normPath = normalizePathname(rawPath);
  const scopeId = getDocumentScopeId();
  return scopeId ? `${normPath}::${scopeId}` : normPath;
}

function getPageKey(): string {
  return 'naizodb_state_' + getStorageSuffix();
}

function getSnapshotKey(): string {
  return 'naizodb_disk_hash_' + getStorageSuffix();
}

function getBackupKey(): string {
  return 'naizodb_backup_' + getStorageSuffix();
}

function safeGetStorage(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn('[naizo.js] localStorage write failed:', e);
    return false;
  }
}

function safeRemoveStorage(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // Ignore storage removal errors
  }
}

function serializeDbJson(db: NaizoDatabase): string {
  return JSON.stringify(db, null, 2).replace(/</g, '\\u003c');
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

function toBooleanValue(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0 && !Number.isNaN(val);
  if (typeof val === 'string') {
    const norm = val.trim().toLowerCase();
    if (norm === 'false' || norm === '0' || norm === '' || norm === 'no' || norm === 'off') {
      return false;
    }
    return true;
  }
  return Boolean(val);
}

let store: NaizoDatabase = createEmptyDb();
let storeInitialized = false;
let startupInvalidDb = false;
let trackedDbScriptEl: HTMLScriptElement | null = null;
let lastSerializedContent = '';
let lastKnownDiskRaw: string | null = null;
let lastDiskDb: NaizoDatabase | null = null;
let lastObservedModified: number | null = null;
let itemDataMap = new WeakMap<HTMLElement, Record<string, unknown>>();
let fileHandle: NaizoFileHandle | null = null;
let persistTimeout: ReturnType<typeof setTimeout> | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let watchInterval: ReturnType<typeof setInterval> | null = null;
let writeInFlightPromise: Promise<boolean> | null = null;
let writeQueued = false;
let statusEl: HTMLElement | null = null;
let actionBtn: HTMLButtonElement | null = null;
let restoreBtn: HTMLButtonElement | null = null;
let unlinkBtn: HTMLButtonElement | null = null;
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
  idbStore('readwrite', (idb) => idb.put(handle, getPageKey()));
}

function deleteHandleFromIDB(): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve();
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('handles');
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction('handles', 'readwrite');
          const delReq = tx.objectStore('handles').delete(getPageKey());
          delReq.onsuccess = () => resolve();
          delReq.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
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

function parseDbScriptDetailed(rawText?: string): {
  ok: boolean;
  db: NaizoDatabase;
  raw: string;
} {
  const raw = (rawText ?? getDbScript().textContent ?? '').trim();
  if (!raw) {
    return { ok: true, db: createEmptyDb(), raw };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const validated = validateAndNormalizeDb(parsed);
    if (!validated) {
      console.warn('[naizo.js] Invalid database shape in #naizodb.');
      return { ok: false, db: createEmptyDb(), raw };
    }
    return { ok: true, db: validated, raw };
  } catch (e) {
    console.warn('[naizo.js] Invalid JSON in #naizodb, resetting.', e);
    return { ok: false, db: createEmptyDb(), raw };
  }
}

export function parseDbScript(): NaizoDatabase {
  const currentScript = getDbScript();
  if (persistTimeout !== null && currentScript === trackedDbScriptEl && !startupInvalidDb) {
    flushPersistence();
  }
  return parseDbScriptDetailed(currentScript.textContent ?? '').db;
}

function parseCachedState(raw: string | null): NaizoDatabase | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const validated = validateAndNormalizeDb(parsed);
    if (!validated) {
      console.warn('[naizo.js] Invalid database shape in localStorage cache, ignoring.');
      return null;
    }
    return validated;
  } catch (e) {
    console.warn('[naizo.js] Invalid JSON in localStorage cache, ignoring.', e);
    return null;
  }
}

function serializeContentBuckets(db: NaizoDatabase): string {
  return JSON.stringify({
    fields: db.fields,
    lists: db.lists,
    custom: db.custom,
  });
}

function normalizeJsonComparison(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const validated = validateAndNormalizeDb(parsed);
    if (validated) {
      return serializeContentBuckets(validated);
    }
    return JSON.stringify(parsed);
  } catch {
    return trimmed;
  }
}

function ensureStore(): NaizoDatabase {
  const currentScript = document.getElementById(DB_ID) as HTMLScriptElement | null;
  if (!storeInitialized || (currentScript !== null && currentScript !== trackedDbScriptEl)) {
    const scriptEl = getDbScript();
    trackedDbScriptEl = scriptEl;
    const detailed = parseDbScriptDetailed(scriptEl.textContent ?? '');
    startupInvalidDb = !detailed.ok;
    store = detailed.db;
    storeInitialized = true;
    lastSerializedContent = serializeContentBuckets(store);
  }
  return store;
}

// --- 3. Element Value Helpers (Explicit Binding, Read, Write & Export-Only Attribute Baking) ---
function getElementKey(el: Element): string | null {
  const key =
    el.getAttribute('naizo') ??
    el.getAttribute('data-naizo') ??
    el.getAttribute('data-naizo-field');
  return key && key.length > 0 ? key : null;
}

function isIgnoredElement(el: Element): boolean {
  return Boolean(el.closest(`${IGNORE_SELECTOR}, template, #${UI_ID}`));
}

function isSkippedElement(el: Element, warn = false): boolean {
  if (el instanceof HTMLInputElement) {
    const type = (el.getAttribute('type') ?? el.type ?? 'text').toLowerCase();
    if (SKIPPED_INPUT_TYPES.has(type)) {
      if (warn) {
        console.warn(`[naizo.js] Skipping unsupported input[type="${type}"] binding.`);
      }
      return true;
    }
  }
  return false;
}

function isContentEditableElement(el: Element): boolean {
  if (!el.hasAttribute('contenteditable')) return false;
  const attr = (el.getAttribute('contenteditable') ?? '').trim().toLowerCase();
  return attr !== 'false';
}

function readElementValue(el: Element): unknown {
  if (isSkippedElement(el)) return undefined;
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox') {
      return el.checked;
    }
    if (el.type === 'radio') {
      return el.checked ? el.value : undefined;
    }
    return el.value;
  }
  if (el instanceof HTMLSelectElement) {
    return el.value;
  }
  if (el instanceof HTMLTextAreaElement) {
    return el.value;
  }
  return el.textContent ?? '';
}

function writeElementValue(el: Element, val: unknown): void {
  if (isSkippedElement(el, true)) return;
  const textVal = toTextValue(val);
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox') {
      el.checked = toBooleanValue(val);
    } else if (el.type === 'radio') {
      el.checked = el.value === textVal;
    } else {
      el.value = textVal;
    }
    return;
  }
  if (el instanceof HTMLSelectElement) {
    const hasMatch = Array.from(el.options).some((opt) => opt.value === textVal);
    if (!hasMatch) {
      console.warn(
        `[naizo.js] Stored value "${textVal}" has no matching <option> in <select>; preserving stored value.`,
      );
      return;
    }
    el.value = textVal;
    return;
  }
  if (el instanceof HTMLTextAreaElement) {
    el.value = textVal;
    return;
  }
  el.textContent = textVal;
}

function bakeClonedElementAttributes(liveEl: Element, cloneEl: Element): void {
  if (isSkippedElement(liveEl)) return;
  if (liveEl instanceof HTMLInputElement && cloneEl instanceof HTMLInputElement) {
    if (liveEl.type === 'checkbox' || liveEl.type === 'radio') {
      if (liveEl.checked) {
        cloneEl.setAttribute('checked', 'checked');
      } else {
        cloneEl.removeAttribute('checked');
      }
    } else {
      cloneEl.setAttribute('value', liveEl.value);
    }
    return;
  }
  if (liveEl instanceof HTMLSelectElement && cloneEl instanceof HTMLSelectElement) {
    Array.from(liveEl.options).forEach((opt, idx) => {
      const cloneOpt = cloneEl.options[idx];
      if (!cloneOpt) return;
      if (opt.selected) {
        cloneOpt.setAttribute('selected', 'selected');
      } else {
        cloneOpt.removeAttribute('selected');
      }
    });
    return;
  }
  if (liveEl instanceof HTMLTextAreaElement && cloneEl instanceof HTMLTextAreaElement) {
    cloneEl.textContent = liveEl.value;
    return;
  }
  if (isContentEditableElement(liveEl)) {
    cloneEl.textContent = liveEl.textContent ?? '';
  }
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
  } else {
    el.textContent = '';
  }
}

function shouldUpdateStoredValue(prevVal: unknown, nextVal: unknown, exists: boolean): boolean {
  if (!exists) return true;
  if (Object.is(prevVal, nextVal)) return false;
  if (
    typeof nextVal === 'string' &&
    (typeof prevVal === 'number' || typeof prevVal === 'boolean') &&
    String(prevVal) === nextVal
  ) {
    return false;
  }
  return true;
}

function selectHasOption(selectEl: HTMLSelectElement, val: unknown): boolean {
  const textVal = toTextValue(val);
  return Array.from(selectEl.options).some((opt) => opt.value === textVal);
}

function queryStandaloneBoundElements(root: ParentNode = document): Element[] {
  const result: Element[] = [];
  if (root instanceof Element && root.matches(BOUND_SELECTOR)) {
    if (!isIgnoredElement(root) && !root.closest(ITEM_SELECTOR) && !isSkippedElement(root, true)) {
      result.push(root);
    }
  }
  root.querySelectorAll(BOUND_SELECTOR).forEach((el) => {
    if (isIgnoredElement(el) || el.closest(ITEM_SELECTOR) || isSkippedElement(el, true)) return;
    result.push(el);
  });
  return result;
}

function queryItemBoundElements(itemEl: HTMLElement): Element[] {
  const result: Element[] = [];
  itemEl.querySelectorAll(BOUND_SELECTOR).forEach((el) => {
    if (el.closest(ITEM_SELECTOR) !== itemEl) return;
    if (isIgnoredElement(el) || isSkippedElement(el, true)) return;
    result.push(el);
  });
  return result;
}

function propagateStandaloneKey(key: string, val: unknown, sourceEl?: Element): void {
  queryStandaloneBoundElements(document).forEach((el) => {
    if (el === sourceEl) return;
    if (getElementKey(el) === key) {
      writeElementValue(el, val);
    }
  });
}

function propagateItemKey(
  itemEl: HTMLElement,
  key: string,
  val: unknown,
  sourceEl?: Element,
): void {
  queryItemBoundElements(itemEl).forEach((el) => {
    if (el === sourceEl) return;
    if (getElementKey(el) === key) {
      writeElementValue(el, val);
    }
  });
}

// --- 4. Declarative List Repeater Engine ([naizo-list] / [data-naizo-list]) ---
function ensureListBlueprints(root: ParentNode = document): void {
  const lists: HTMLElement[] = [];
  if (root instanceof HTMLElement && root.matches(LIST_SELECTOR) && !isIgnoredElement(root)) {
    lists.push(root);
  }
  root.querySelectorAll<HTMLElement>(LIST_SELECTOR).forEach((el) => {
    if (!isIgnoredElement(el)) lists.push(el);
  });

  lists.forEach((listEl) => {
    let tpl = listEl.querySelector<HTMLTemplateElement>(TEMPLATE_SELECTOR);
    if (!tpl) {
      const firstItem = listEl.querySelector<HTMLElement>(ITEM_SELECTOR);
      if (!firstItem) return;
      const cleanClone = firstItem.cloneNode(true) as HTMLElement;
      cleanClone.querySelectorAll(IGNORE_SELECTOR).forEach((n) => n.remove());
      cleanClone.querySelectorAll(BOUND_SELECTOR).forEach(clearElementValue);

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

function bindItemElementToRecord(itemEl: HTMLElement, rowObj: Record<string, unknown>): void {
  itemDataMap.set(itemEl, rowObj);
  queryItemBoundElements(itemEl).forEach((el) => {
    const key = getElementKey(el);
    if (!key) return;
    if (hasOwn(rowObj, key)) {
      writeElementValue(el, getOwn(rowObj, key));
    } else {
      const val = readElementValue(el);
      if (val !== undefined) {
        setOwn(rowObj, key, val);
      }
    }
  });
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

  bindItemElementToRecord(itemEl, itemData);
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

function getOrBindItemRecord(itemEl: HTMLElement): Record<string, unknown> | null {
  const existing = itemDataMap.get(itemEl);
  if (existing) return existing;

  const listEl = itemEl.closest<HTMLElement>(LIST_SELECTOR);
  if (!listEl) return null;
  const listName = getAttr(listEl, 'naizo-list');
  if (!listName) return null;

  const db = ensureStore();
  let listArr = getOwn(db.lists, listName) as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(listArr)) {
    listArr = [];
    setOwn(db.lists, listName, listArr);
  }

  const rows = Array.from(listEl.querySelectorAll<HTMLElement>(DIRECT_ITEM_SELECTOR));
  const idx = rows.indexOf(itemEl);
  if (idx === -1) return null;

  let rowObj = listArr[idx];
  if (!isPlainObject(rowObj)) {
    rowObj = {};
    listArr[idx] = rowObj;
  }
  itemDataMap.set(itemEl, rowObj);
  return rowObj;
}

// --- 5. Store <-> DOM Synchronization (Merge & Pass-Through Semantics) ---
function syncDomIntoStore(): NaizoDatabase {
  const db = ensureStore();

  queryStandaloneBoundElements(document).forEach((el) => {
    const key = getElementKey(el);
    if (!key) return;
    if (
      el instanceof HTMLSelectElement &&
      hasOwn(db.fields, key) &&
      !selectHasOption(el, getOwn(db.fields, key))
    ) {
      return;
    }
    const val = readElementValue(el);
    if (val === undefined) return;
    const exists = hasOwn(db.fields, key);
    const prevVal = getOwn(db.fields, key);
    if (shouldUpdateStoredValue(prevVal, val, exists)) {
      setOwn(db.fields, key, val);
    }
  });

  document.querySelectorAll<HTMLElement>(LIST_SELECTOR).forEach((listEl) => {
    if (isIgnoredElement(listEl)) return;
    const listName = getAttr(listEl, 'naizo-list');
    if (!listName) return;
    const items: Array<Record<string, unknown>> = [];
    listEl.querySelectorAll<HTMLElement>(DIRECT_ITEM_SELECTOR).forEach((itemEl) => {
      const existingObj = itemDataMap.get(itemEl);
      const itemObj: Record<string, unknown> = existingObj ? cloneRecord(existingObj) : {};
      queryItemBoundElements(itemEl).forEach((el) => {
        const key = getElementKey(el);
        if (!key) return;
        if (
          el instanceof HTMLSelectElement &&
          hasOwn(itemObj, key) &&
          !selectHasOption(el, getOwn(itemObj, key))
        ) {
          return;
        }
        const val = readElementValue(el);
        if (val === undefined) return;
        const exists = hasOwn(itemObj, key);
        const prevVal = getOwn(itemObj, key);
        if (shouldUpdateStoredValue(prevVal, val, exists)) {
          setOwn(itemObj, key, val);
        }
      });
      itemDataMap.set(itemEl, itemObj);
      items.push(itemObj);
    });
    setOwn(db.lists, listName, items);
  });

  return db;
}

function isElementActive(el: Element): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active || active === document.body || active === document.documentElement) {
    return false;
  }
  return el === active || el.contains(active);
}

function writeStoreToDomScript(db: NaizoDatabase, allowMetaBump: boolean): string {
  const nextContent = serializeContentBuckets(db);
  if (allowMetaBump && nextContent !== lastSerializedContent) {
    setOwn(db._meta, 'updatedAt', new Date().toISOString());
  }
  lastSerializedContent = nextContent;
  const formatted = '\n' + serializeDbJson(db) + '\n';
  if (!startupInvalidDb) {
    const scriptEl = getDbScript();
    scriptEl.textContent = formatted;
    trackedDbScriptEl = scriptEl;
  }
  return formatted;
}

export function captureDomToState(): { db: NaizoDatabase; formatted: string } {
  const db = syncDomIntoStore();
  const formatted = writeStoreToDomScript(db, true);
  return { db, formatted };
}

function hydrateSubtreeFromStore(root: ParentNode = document, preserveActive = false): void {
  const db = ensureStore();
  ensureListBlueprints(root);

  queryStandaloneBoundElements(root).forEach((el) => {
    const key = getElementKey(el);
    if (!key) return;
    if (hasOwn(db.fields, key)) {
      if (preserveActive && isElementActive(el)) return;
      writeElementValue(el, getOwn(db.fields, key));
    } else {
      const val = readElementValue(el);
      if (val !== undefined) {
        setOwn(db.fields, key, val);
      }
    }
  });

  const lists: HTMLElement[] = [];
  if (root instanceof HTMLElement && root.matches(LIST_SELECTOR) && !isIgnoredElement(root)) {
    lists.push(root);
  }
  root.querySelectorAll<HTMLElement>(LIST_SELECTOR).forEach((el) => {
    if (!isIgnoredElement(el)) lists.push(el);
  });

  lists.forEach((listEl) => {
    const listName = getAttr(listEl, 'naizo-list');
    if (!listName) return;
    if (hasOwn(db.lists, listName) && Array.isArray(getOwn(db.lists, listName))) {
      const targetItems = getOwn(db.lists, listName) as Array<Record<string, unknown>>;
      const currentRows = Array.from(listEl.querySelectorAll<HTMLElement>(DIRECT_ITEM_SELECTOR));
      if (preserveActive && isElementActive(listEl) && currentRows.length === targetItems.length) {
        currentRows.forEach((rowEl, idx) => {
          const itemObj = targetItems[idx];
          if (!itemObj) return;
          itemDataMap.set(rowEl, itemObj);
          queryItemBoundElements(rowEl).forEach((el) => {
            if (isElementActive(el)) return;
            const key = getElementKey(el);
            if (key && hasOwn(itemObj, key)) {
              writeElementValue(el, getOwn(itemObj, key));
            }
          });
        });
      } else {
        renderListItems(listEl, targetItems);
      }
    } else {
      const seededItems: Array<Record<string, unknown>> = [];
      listEl.querySelectorAll<HTMLElement>(DIRECT_ITEM_SELECTOR).forEach((itemEl) => {
        const rowObj: Record<string, unknown> = {};
        bindItemElementToRecord(itemEl, rowObj);
        seededItems.push(rowObj);
      });
      setOwn(db.lists, listName, seededItems);
      decorateListControls(listEl);
    }
  });
}

export function hydrateDomFromState(db: NaizoDatabase | null): void {
  if (!db) return;
  const validated = validateAndNormalizeDb(db);
  if (!validated) return;
  store = validated;
  storeInitialized = true;
  lastSerializedContent = serializeContentBuckets(store);

  hydrateSubtreeFromStore(document, false);
  writeStoreToDomScript(store, false);
  window.dispatchEvent(new CustomEvent('naizo:hydrate', { detail: store }));
}

// --- 6. Clean Serialization & Surgical #naizodb Replacement ---
export function getCleanHtmlString(): string {
  flushPersistence(false);
  const clone = document.documentElement.cloneNode(true) as HTMLElement;

  const liveBound = Array.from(document.documentElement.querySelectorAll(BOUND_SELECTOR));
  const cloneBound = Array.from(clone.querySelectorAll(BOUND_SELECTOR));
  for (let i = 0; i < liveBound.length; i += 1) {
    const liveEl = liveBound[i];
    const cloneEl = cloneBound[i];
    if (liveEl && cloneEl && !isIgnoredElement(liveEl)) {
      bakeClonedElementAttributes(liveEl, cloneEl);
    }
  }

  clone
    .querySelectorAll(`${IGNORE_SELECTOR}, #${UI_ID}, #${STYLE_ID}`)
    .forEach((el) => el.remove());
  return '<!DOCTYPE html>\n' + clone.outerHTML;
}

async function readFileTextPreservingBom(file: NaizoFile): Promise<string> {
  if (typeof file.arrayBuffer === 'function') {
    try {
      const buf = await file.arrayBuffer();
      return new TextDecoder('utf-8', { ignoreBOM: true }).decode(buf);
    } catch {
      // Fall back to file.text()
    }
  }
  if (typeof file.text === 'function') {
    return await file.text();
  }
  return '';
}

function extractDbScriptBody(htmlText: string): string | null {
  const bodyText = htmlText.startsWith('\uFEFF') ? htmlText.slice(1) : htmlText;
  const match = NAIZODB_SCRIPT_RE.exec(bodyText);
  return match ? (match[2]?.trim() ?? '') : null;
}

function replaceDbScriptInHtml(
  fileText: string,
  formattedBlock: string,
): { ok: boolean; html: string; missingBlock: boolean } {
  const hasBom = fileText.startsWith('\uFEFF');
  const bodyText = hasBom ? fileText.slice(1) : fileText;

  if (NAIZODB_SCRIPT_RE.test(bodyText)) {
    const replaced = bodyText.replace(
      NAIZODB_SCRIPT_RE,
      (_match, openTag: string, _inner: string, closeTag: string) =>
        `${openTag}${formattedBlock}${closeTag}`,
    );
    return {
      ok: true,
      html: (hasBom ? '\uFEFF' : '') + replaced,
      missingBlock: false,
    };
  }

  if (bodyText.trim() === '') {
    return {
      ok: true,
      html: (hasBom ? '\uFEFF' : '') + getCleanHtmlString(),
      missingBlock: false,
    };
  }

  return {
    ok: false,
    html: fileText,
    missingBlock: true,
  };
}

function injectDbScriptIntoHtml(fileText: string, formattedBlock: string): string {
  const hasBom = fileText.startsWith('\uFEFF');
  const bodyText = hasBom ? fileText.slice(1) : fileText;
  const scriptTag = `\n<script id="${DB_ID}" type="application/json">${formattedBlock}</script>`;
  if (HEAD_OPEN_RE.test(bodyText)) {
    const injected = bodyText.replace(HEAD_OPEN_RE, (headTag) => `${headTag}${scriptTag}`);
    return (hasBom ? '\uFEFF' : '') + injected;
  }
  return (hasBom ? '\uFEFF' : '') + `${scriptTag}\n${bodyText}`;
}

function shallowMergeDatabases(
  baseDb: NaizoDatabase | null,
  browserDb: NaizoDatabase,
  diskDb: NaizoDatabase,
): { merged: NaizoDatabase; hasCollision: boolean; browserKeptKeys: boolean } {
  let hasCollision = false;
  let browserKeptKeys = false;

  const mergeBucket = (
    baseBucket: Record<string, unknown> | null,
    browserBucket: Record<string, unknown>,
    diskBucket: Record<string, unknown>,
  ): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    const allKeys = new Set<string>([
      ...(baseBucket ? Object.keys(baseBucket) : []),
      ...Object.keys(browserBucket),
      ...Object.keys(diskBucket),
    ]);

    for (const key of allKeys) {
      const baseVal = baseBucket && hasOwn(baseBucket, key) ? getOwn(baseBucket, key) : undefined;
      const browserVal = hasOwn(browserBucket, key) ? getOwn(browserBucket, key) : undefined;
      const diskVal = hasOwn(diskBucket, key) ? getOwn(diskBucket, key) : undefined;

      const baseSer = baseVal !== undefined ? JSON.stringify(baseVal) : undefined;
      const browserSer = browserVal !== undefined ? JSON.stringify(browserVal) : undefined;
      const diskSer = diskVal !== undefined ? JSON.stringify(diskVal) : undefined;

      if (browserSer === diskSer) {
        if (diskVal !== undefined) setOwn(out, key, cloneJsonValue(diskVal));
        continue;
      }

      if (baseDb !== null) {
        const browserChanged = browserSer !== baseSer;
        const diskChanged = diskSer !== baseSer;

        if (browserChanged && !diskChanged) {
          browserKeptKeys = true;
          if (browserVal !== undefined) setOwn(out, key, cloneJsonValue(browserVal));
        } else if (!browserChanged && diskChanged) {
          if (diskVal !== undefined) setOwn(out, key, cloneJsonValue(diskVal));
        } else {
          hasCollision = true;
          if (diskVal !== undefined) setOwn(out, key, cloneJsonValue(diskVal));
        }
      } else {
        hasCollision = true;
        if (diskVal !== undefined) setOwn(out, key, cloneJsonValue(diskVal));
      }
    }
    return out;
  };

  const mergedFields = mergeBucket(baseDb?.fields ?? null, browserDb.fields, diskDb.fields);
  const mergedLists = mergeBucket(baseDb?.lists ?? null, browserDb.lists, diskDb.lists) as Record<
    string,
    Array<Record<string, unknown>>
  >;
  const mergedCustom = mergeBucket(baseDb?.custom ?? null, browserDb.custom, diskDb.custom);

  return {
    merged: {
      _meta: cloneRecord(diskDb._meta),
      fields: mergedFields,
      lists: mergedLists,
      custom: mergedCustom,
    },
    hasCollision,
    browserKeptKeys,
  };
}

function applyExternalDiskUpdate(
  diskDb: NaizoDatabase,
  diskRaw: string,
  preserveActive: boolean,
): { hasCollision: boolean; browserKeptKeys: boolean } {
  const currentBrowserDb = cloneDb(ensureStore());
  const { merged, hasCollision, browserKeptKeys } = shallowMergeDatabases(
    lastDiskDb,
    currentBrowserDb,
    diskDb,
  );

  if (hasCollision) {
    safeSetStorage(getBackupKey(), JSON.stringify(currentBrowserDb));
  }

  store = merged;
  storeInitialized = true;
  lastSerializedContent = serializeContentBuckets(store);
  lastKnownDiskRaw = diskRaw.trim();
  lastDiskDb = cloneDb(diskDb);
  safeSetStorage(getSnapshotKey(), lastKnownDiskRaw);

  hydrateSubtreeFromStore(document, preserveActive);
  writeStoreToDomScript(store, false);
  safeSetStorage(getPageKey(), JSON.stringify(store));

  if (hasCollision) {
    updateUi('conflict', 'External Disk Edit · Conflict Backed Up');
  } else if (fileHandle) {
    updateUi(
      browserKeptKeys ? 'cached' : 'saved',
      browserKeptKeys ? 'Browser Cache · Pending Sync' : 'Synced to Disk',
    );
  }

  window.dispatchEvent(new CustomEvent('naizo:hydrate', { detail: store }));
  return { hasCollision, browserKeptKeys };
}

function restoreConflictBackup(): void {
  const backupRaw = safeGetStorage(getBackupKey());
  const backupDb = parseCachedState(backupRaw);
  if (!backupDb) return;
  safeRemoveStorage(getBackupKey());
  store = cloneDb(backupDb);
  storeInitialized = true;
  hydrateSubtreeFromStore(document, false);
  flushPersistence(true);
  window.dispatchEvent(new CustomEvent('naizo:hydrate', { detail: store }));
}

// --- 7. Persistence Engine (localStorage + Surgical File System Access API + Live Watch) ---
async function checkDiskForExternalChanges(): Promise<boolean> {
  if (!fileHandle || typeof fileHandle.getFile !== 'function' || startupInvalidDb) return false;
  if (writeInFlightPromise !== null) return false;
  try {
    const perm = await fileHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return false;
    const diskFile = await fileHandle.getFile();
    if (
      typeof diskFile.lastModified === 'number' &&
      lastObservedModified !== null &&
      diskFile.lastModified === lastObservedModified
    ) {
      return false;
    }
    const fileText = await readFileTextPreservingBom(diskFile);
    if (typeof diskFile.lastModified === 'number') {
      lastObservedModified = diskFile.lastModified;
    }
    const diskScriptRaw = extractDbScriptBody(fileText);
    if (diskScriptRaw === null) return false;
    if (
      lastKnownDiskRaw !== null &&
      normalizeJsonComparison(diskScriptRaw) === normalizeJsonComparison(lastKnownDiskRaw)
    ) {
      return false;
    }
    const diskDetailed = parseDbScriptDetailed(diskScriptRaw);
    if (!diskDetailed.ok) return false;

    const { browserKeptKeys } = applyExternalDiskUpdate(diskDetailed.db, diskScriptRaw, true);
    if (browserKeptKeys) {
      scheduleDiskWrite();
    }
    return true;
  } catch {
    return false;
  }
}

function startDiskWatch(): void {
  stopDiskWatch();
  if (!fileHandle || typeof fileHandle.getFile !== 'function') return;
  watchInterval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    void checkDiskForExternalChanges();
  }, DISK_WATCH_INTERVAL_MS);
}

function stopDiskWatch(): void {
  if (watchInterval !== null) {
    clearInterval(watchInterval);
    watchInterval = null;
  }
}

async function performSingleDiskWrite(): Promise<boolean> {
  if (!fileHandle || startupInvalidDb) return false;
  try {
    const perm = await fileHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      updateUi('needs-permission', 'Resume Disk Sync');
      return false;
    }

    if (persistTimeout !== null) {
      flushPersistence(false);
    }

    let fileTextToWrite: string;
    let payloadToWrite: string;

    if (typeof fileHandle.getFile === 'function') {
      const diskFile = await fileHandle.getFile();
      const existingFileText = await readFileTextPreservingBom(diskFile);
      const diskScriptRaw = extractDbScriptBody(existingFileText);

      if (
        diskScriptRaw !== null &&
        lastKnownDiskRaw !== null &&
        normalizeJsonComparison(diskScriptRaw) !== normalizeJsonComparison(lastKnownDiskRaw)
      ) {
        const diskDetailed = parseDbScriptDetailed(diskScriptRaw);
        if (diskDetailed.ok) {
          const { browserKeptKeys } = applyExternalDiskUpdate(diskDetailed.db, diskScriptRaw, true);
          if (!browserKeptKeys) {
            if (typeof diskFile.lastModified === 'number') {
              lastObservedModified = diskFile.lastModified;
            }
            return true;
          }
        }
      }

      payloadToWrite = serializeDbJson(ensureStore());
      const formattedBlock = '\n' + payloadToWrite + '\n';
      const replaced = replaceDbScriptInHtml(existingFileText, formattedBlock);

      if (replaced.missingBlock) {
        const confirmed =
          typeof window !== 'undefined' && typeof window.confirm === 'function'
            ? window.confirm(
                'Selected file does not contain <script id="naizodb">. Insert #naizodb into this file?',
              )
            : false;
        if (!confirmed) {
          console.warn('[naizo.js] Refusing to overwrite file without #naizodb block.');
          updateUi('error', 'Target file lacks #naizodb');
          return false;
        }
        fileTextToWrite = injectDbScriptIntoHtml(existingFileText, formattedBlock);
      } else {
        fileTextToWrite = replaced.html;
      }
    } else {
      payloadToWrite = serializeDbJson(ensureStore());
      fileTextToWrite = getCleanHtmlString();
    }

    const writable = await fileHandle.createWritable();
    await writable.write(fileTextToWrite);
    await writable.close();

    const exactWrittenTrimmed = payloadToWrite.trim();
    lastKnownDiskRaw = exactWrittenTrimmed;
    const writtenParsed = parseDbScriptDetailed(exactWrittenTrimmed);
    if (writtenParsed.ok) {
      lastDiskDb = cloneDb(writtenParsed.db);
    }
    safeSetStorage(getSnapshotKey(), exactWrittenTrimmed);

    if (typeof fileHandle.getFile === 'function') {
      try {
        const updatedFile = await fileHandle.getFile();
        if (typeof updatedFile.lastModified === 'number') {
          lastObservedModified = updatedFile.lastModified;
        }
      } catch {
        // Ignore post-write metadata inspection errors
      }
    }

    const currentPayloadTrimmed = serializeDbJson(ensureStore()).trim();
    if (currentPayloadTrimmed !== exactWrittenTrimmed) {
      writeQueued = true;
      updateUi('cached', 'Browser Cache · Pending Sync');
    } else {
      updateUi('saved', 'Synced to Disk');
    }
    return true;
  } catch (err) {
    console.warn('[naizo.js] Disk write failed:', err);
    updateUi('cached', 'Browser Cache · Click to Link Disk');
    return false;
  }
}

async function writeToDisk(): Promise<boolean> {
  if (!fileHandle || startupInvalidDb) return false;
  if (writeInFlightPromise !== null) {
    writeQueued = true;
    return writeInFlightPromise;
  }

  writeInFlightPromise = (async () => {
    let lastResult = false;
    do {
      writeQueued = false;
      lastResult = await performSingleDiskWrite();
    } while (writeQueued && fileHandle && !startupInvalidDb);
    return lastResult;
  })();

  try {
    return await writeInFlightPromise;
  } finally {
    writeInFlightPromise = null;
  }
}

function scheduleDiskWrite(): void {
  if (!fileHandle || startupInvalidDb) return;
  updateUi('saving', 'Saving...');
  if (saveTimeout !== null) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    void writeToDisk();
  }, DISK_DEBOUNCE_MS);
}

function flushPersistence(scheduleDisk = true): boolean {
  if (persistTimeout !== null) {
    clearTimeout(persistTimeout);
    persistTimeout = null;
  }
  if (startupInvalidDb) {
    updateUi('error', 'Invalid #naizodb JSON');
    return false;
  }

  const db = ensureStore();
  writeStoreToDomScript(db, true);
  const storedOk = safeSetStorage(getPageKey(), JSON.stringify(db));

  if (!fileHandle) {
    if (storedOk) {
      updateUi('cached', 'Browser Cache · Click to Link Disk');
    } else {
      updateUi('cached', 'In-Memory Only · Link Disk');
    }
    return storedOk;
  }

  if (scheduleDisk) {
    scheduleDiskWrite();
  }
  return storedOk;
}

function schedulePersist(): void {
  if (startupInvalidDb) return;
  if (persistTimeout !== null) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    persistTimeout = null;
    flushPersistence(true);
  }, PERSIST_DEBOUNCE_MS);
}

export function triggerSave(): Promise<boolean> {
  return Naizo.save();
}

async function connectOrResumeDisk(): Promise<void> {
  if (fileHandle) {
    const perm = await fileHandle.requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      startDiskWatch();
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
      startDiskWatch();
      await writeToDisk();
    } catch {
      // User cancelled file picker
    }
  } else {
    const blob = new Blob([getCleanHtmlString()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = location.pathname.split('/').pop() || 'index.html';
    a.click();
    URL.revokeObjectURL(url);
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
      .dot.error { background: #ef4444; }
      button {
        background: #1e293b; color: #e2e8f0; border: 1px solid #475569;
        border-radius: 999px; padding: 4px 10px; font: inherit; cursor: pointer;
      }
      button:hover { background: #334155; color: #fff; }
    </style>
    <div class="pill">
      <span class="dot" id="dot"></span>
      <span id="status">Browser Cache · Click to Link Disk</span>
      <button id="action">Link Disk</button>
      <button id="restore" style="display: none" title="Restore browser state before disk conflict">↺ Restore</button>
      <button id="copy" title="Copy #naizodb JSON state">📋 Copy</button>
      <button id="unlink" style="display: none" title="Forget linked disk file">× Unlink</button>
    </div>
  `;

  statusEl = shadow.getElementById('status');
  actionBtn = shadow.getElementById('action') as HTMLButtonElement | null;
  restoreBtn = shadow.getElementById('restore') as HTMLButtonElement | null;
  unlinkBtn = shadow.getElementById('unlink') as HTMLButtonElement | null;
  const dotEl = shadow.getElementById('dot');
  const copyBtn = shadow.getElementById('copy') as HTMLButtonElement | null;

  actionBtn?.addEventListener('click', () => {
    void connectOrResumeDisk();
  });
  restoreBtn?.addEventListener('click', () => {
    restoreConflictBackup();
  });
  copyBtn?.addEventListener('click', () => {
    void Naizo.copyJSON().then(() => {
      copyBtn.textContent = '✓ Copied';
      setTimeout(() => {
        copyBtn.textContent = '📋 Copy';
      }, 1500);
    });
  });
  unlinkBtn?.addEventListener('click', () => {
    void Naizo.unlink();
  });

  host._setDot = (state: string) => {
    if (dotEl) {
      const cls =
        state === 'saved'
          ? 'saved'
          : state === 'saving'
            ? 'saving'
            : state === 'error'
              ? 'error'
              : '';
      dotEl.className = cls ? `dot ${cls}` : 'dot';
    }
  };

  document.body.appendChild(host);
}

function updateUi(state: string, message: string): void {
  if (!statusEl || !actionBtn) return;
  statusEl.textContent = message;
  (document.getElementById(UI_ID) as NaizoHostElement | null)?._setDot?.(state);

  if (state === 'saved' || state === 'error') {
    actionBtn.style.display = 'none';
  } else if (state === 'needs-permission') {
    actionBtn.style.display = 'inline-block';
    actionBtn.textContent = 'Resume Disk Sync';
  } else if (fileHandle) {
    actionBtn.style.display = 'none';
  } else {
    actionBtn.style.display = 'inline-block';
    actionBtn.textContent = 'Link Disk';
  }

  if (restoreBtn) {
    const hasBackup = safeGetStorage(getBackupKey()) !== null;
    restoreBtn.style.display = hasBackup || state === 'conflict' ? 'inline-block' : 'none';
  }
  if (unlinkBtn) {
    unlinkBtn.style.display = fileHandle ? 'inline-block' : 'none';
  }
}

// --- 9. Event Delegation for O(1) Input Capture, List Actions & Cross-Tab/Live Sync ---
function handleInputOrChange(e: Event): void {
  const target = e.target;
  if (!(target instanceof Element)) return;
  if (isIgnoredElement(target)) return;

  const boundEl = target.closest(BOUND_SELECTOR);
  if (!boundEl || isIgnoredElement(boundEl) || isSkippedElement(boundEl, true)) return;
  if (boundEl !== target && !isContentEditableElement(boundEl)) return;

  const key = getElementKey(boundEl);
  if (!key) return;

  const nextVal = readElementValue(boundEl);
  if (nextVal === undefined) return;

  const db = ensureStore();
  const itemEl = boundEl.closest<HTMLElement>(ITEM_SELECTOR);
  if (itemEl) {
    const rowObj = getOrBindItemRecord(itemEl);
    if (!rowObj) return;
    const exists = hasOwn(rowObj, key);
    const prevVal = getOwn(rowObj, key);
    if (!shouldUpdateStoredValue(prevVal, nextVal, exists)) return;
    setOwn(rowObj, key, nextVal);
    propagateItemKey(itemEl, key, nextVal, boundEl);
    schedulePersist();
    return;
  }

  const exists = hasOwn(db.fields, key);
  const prevVal = getOwn(db.fields, key);
  if (!shouldUpdateStoredValue(prevVal, nextVal, exists)) return;
  setOwn(db.fields, key, nextVal);
  propagateStandaloneKey(key, nextVal, boundEl);
  schedulePersist();
}

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
    const itemEl = removeBtn.closest<HTMLElement>(ITEM_SELECTOR);
    const listEl = itemEl?.closest<HTMLElement>(LIST_SELECTOR);
    if (itemEl && listEl) {
      const listName = getAttr(listEl, 'naizo-list');
      const rows = Array.from(listEl.querySelectorAll<HTMLElement>(DIRECT_ITEM_SELECTOR));
      const idx = rows.indexOf(itemEl);
      if (listName && idx !== -1) {
        Naizo.removeItem(listName, idx);
      } else {
        itemEl.remove();
        flushPersistence(true);
      }
    }
    return;
  }

  const moveBtn = target.closest('[naizo-move], [data-naizo-move]');
  if (moveBtn) {
    const dir = getAttr(moveBtn, 'naizo-move');
    const itemEl = moveBtn.closest<HTMLElement>(ITEM_SELECTOR);
    const listEl = itemEl?.closest<HTMLElement>(LIST_SELECTOR);
    if (!itemEl || !listEl) return;
    const listName = getAttr(listEl, 'naizo-list');
    if (!listName) return;
    const rows = Array.from(listEl.querySelectorAll<HTMLElement>(DIRECT_ITEM_SELECTOR));
    const idx = rows.indexOf(itemEl);
    if (idx === -1) return;
    if (dir === 'up' && idx > 0) {
      Naizo.moveItem(listName, idx, idx - 1);
    } else if (dir === 'down' && idx < rows.length - 1) {
      Naizo.moveItem(listName, idx, idx + 1);
    }
  }
}

function handleStorageEvent(e: StorageEvent): void {
  if (!e.key || e.key !== getPageKey() || !e.newValue) return;
  if (writeInFlightPromise !== null || startupInvalidDb) return;
  const nextDb = parseCachedState(e.newValue);
  if (!nextDb) return;
  store = cloneDb(nextDb);
  storeInitialized = true;
  lastSerializedContent = serializeContentBuckets(store);
  hydrateSubtreeFromStore(document, true);
  writeStoreToDomScript(store, false);
  window.dispatchEvent(new CustomEvent('naizo:hydrate', { detail: store }));
}

function attachListeners(): void {
  if (listenersAttached) return;
  document.addEventListener('click', handleListClicks);
  document.addEventListener('input', handleInputOrChange);
  document.addEventListener('change', handleInputOrChange);
  window.addEventListener('storage', handleStorageEvent);
  window.addEventListener('focus', () => {
    void checkDiskForExternalChanges();
  });
  window.addEventListener('pagehide', () => {
    if (persistTimeout !== null) flushPersistence(false);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (persistTimeout !== null) flushPersistence(false);
    } else if (document.visibilityState === 'visible') {
      void checkDiskForExternalChanges();
    }
  });
  listenersAttached = true;
}

// --- 10. Public API (window.Naizo & window.NaizoDB alias) ---
export const Naizo: NaizoAPI = {
  init: initNaizo,
  get(key?: string): unknown {
    const db = ensureStore();
    if (key === undefined) return db;
    return getOwn(db.custom, key);
  },
  set(key: string, value: unknown): void {
    if (!key || !isValidJsonValue(value)) {
      console.warn('[naizo.js] Rejected invalid custom key or non-JSON value:', key);
      return;
    }
    const db = ensureStore();
    setOwn(db.custom, key, cloneJsonValue(value));
    flushPersistence(true);
  },
  getField(key: string): unknown {
    const db = ensureStore();
    return getOwn(db.fields, key);
  },
  setField(key: string, value: unknown): void {
    if (!key || !isValidJsonValue(value)) {
      console.warn('[naizo.js] Rejected invalid field key or non-JSON value:', key);
      return;
    }
    const db = ensureStore();
    const cloned = cloneJsonValue(value);
    setOwn(db.fields, key, cloned);
    propagateStandaloneKey(key, cloned);
    flushPersistence(true);
  },
  deleteField(key: string): void {
    if (!key) return;
    const db = ensureStore();
    if (!hasOwn(db.fields, key)) return;
    deleteOwn(db.fields, key);
    flushPersistence(true);
  },
  getList(listName: string): Array<Record<string, unknown>> {
    const db = ensureStore();
    const arr = getOwn(db.lists, listName);
    return Array.isArray(arr) ? (arr as Array<Record<string, unknown>>) : [];
  },
  addItem(listName: string, itemData: Record<string, unknown> = {}): void {
    if (!listName || !isPlainObject(itemData) || !isValidJsonValue(itemData)) {
      console.warn('[naizo.js] Rejected invalid list item data for:', listName);
      return;
    }
    const db = ensureStore();
    const rowObj = cloneRecord(itemData);
    let listArr = getOwn(db.lists, listName) as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(listArr)) {
      listArr = [];
      setOwn(db.lists, listName, listArr);
    }

    const listEl = findListElement(listName);
    if (!listEl) {
      listArr.push(rowObj);
      flushPersistence(true);
      return;
    }

    ensureListBlueprints(listEl);
    const node = createItemNode(listEl, rowObj);
    if (node) {
      listEl.appendChild(node);
      listArr.push(rowObj);
      decorateListControls(listEl);
      const firstInput = node.querySelector<HTMLElement>(
        'input[type="text"], [contenteditable="true"], textarea',
      );
      firstInput?.focus();
      flushPersistence(true);
    }
  },
  updateItem(listName: string, index: number, partialData: Record<string, unknown>): void {
    if (!listName || !isPlainObject(partialData) || !isValidJsonValue(partialData)) {
      console.warn('[naizo.js] Rejected invalid updateItem data for:', listName);
      return;
    }
    const db = ensureStore();
    const listArr = getOwn(db.lists, listName);
    if (!Array.isArray(listArr) || index < 0 || index >= listArr.length) return;
    const rowObj = listArr[index] as Record<string, unknown> | undefined;
    if (!isPlainObject(rowObj)) return;

    const listEl = findListElement(listName);
    const rows = listEl
      ? Array.from(listEl.querySelectorAll<HTMLElement>(DIRECT_ITEM_SELECTOR))
      : [];
    const itemEl = rows[index];

    for (const key of Object.keys(partialData)) {
      const val = cloneJsonValue(getOwn(partialData, key));
      setOwn(rowObj, key, val);
      if (itemEl) {
        propagateItemKey(itemEl, key, val);
      }
    }
    flushPersistence(true);
  },
  removeItem(listName: string, index: number): void {
    const db = ensureStore();
    const listArr = getOwn(db.lists, listName);
    if (Array.isArray(listArr) && index >= 0 && index < listArr.length) {
      listArr.splice(index, 1);
    }
    const listEl = findListElement(listName);
    if (listEl) {
      const items = listEl.querySelectorAll(DIRECT_ITEM_SELECTOR);
      if (items[index]) {
        items[index].remove();
      }
    }
    flushPersistence(true);
  },
  moveItem(listName: string, fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    const db = ensureStore();
    const listArr = getOwn(db.lists, listName);
    if (
      Array.isArray(listArr) &&
      fromIndex >= 0 &&
      fromIndex < listArr.length &&
      toIndex >= 0 &&
      toIndex < listArr.length
    ) {
      const [moved] = listArr.splice(fromIndex, 1);
      if (moved) listArr.splice(toIndex, 0, moved);
    }

    const listEl = findListElement(listName);
    if (listEl) {
      const items = Array.from(listEl.querySelectorAll(DIRECT_ITEM_SELECTOR));
      const fromEl = items[fromIndex];
      const targetEl = items[toIndex];
      if (fromEl && targetEl) {
        listEl.insertBefore(fromEl, fromIndex < toIndex ? targetEl.nextSibling : targetEl);
      }
    }
    flushPersistence(true);
  },
  bind(root: ParentNode = document): void {
    ensureStore();
    hydrateSubtreeFromStore(root, false);
    schedulePersist();
  },
  async save(): Promise<boolean> {
    if (saveTimeout !== null) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    const cachedOk = flushPersistence(false);
    if (fileHandle) {
      return await writeToDisk();
    }
    return cachedOk;
  },
  async unlink(): Promise<void> {
    stopDiskWatch();
    if (saveTimeout !== null) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    fileHandle = null;
    lastObservedModified = null;
    await deleteHandleFromIDB();
    updateUi('cached', 'Browser Cache · Click to Link Disk');
  },
  async copyJSON(): Promise<string> {
    flushPersistence(false);
    const json = serializeDbJson(ensureStore());
    try {
      await navigator.clipboard?.writeText(json);
    } catch {
      // Ignore clipboard permission errors
    }
    return json;
  },
  exportHTML: getCleanHtmlString,
};

export const NaizoDB: NaizoAPI = Naizo;

// --- 11. Boot & Smart Conflict Resolution (Disk vs Browser Cache) ---
export async function initNaizo(): Promise<void> {
  stopDiskWatch();
  if (persistTimeout !== null) {
    clearTimeout(persistTimeout);
    persistTimeout = null;
  }
  if (saveTimeout !== null) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  fileHandle = null;
  lastObservedModified = null;

  mountUi();
  ensureListBlueprints(document);
  attachListeners();

  const scriptEl = getDbScript();
  trackedDbScriptEl = scriptEl;
  const currentDiskRaw = scriptEl.textContent?.trim() ?? '';
  const diskDetailed = parseDbScriptDetailed(currentDiskRaw);

  const pageKey = getPageKey();
  const snapshotKey = getSnapshotKey();
  const storedDiskSnapshot = safeGetStorage(snapshotKey);
  const cachedState = parseCachedState(safeGetStorage(pageKey));

  if (!diskDetailed.ok) {
    startupInvalidDb = true;
    store = cachedState ? cloneDb(cachedState) : createEmptyDb();
    storeInitialized = true;
    lastSerializedContent = serializeContentBuckets(store);
    if (cachedState) {
      hydrateSubtreeFromStore(document, false);
    } else {
      document.querySelectorAll<HTMLElement>(LIST_SELECTOR).forEach((listEl) => {
        if (!isIgnoredElement(listEl)) decorateListControls(listEl);
      });
    }
    updateUi('error', 'Invalid #naizodb JSON');
    window.dispatchEvent(new CustomEvent('naizo:hydrate', { detail: store }));
    return;
  }

  startupInvalidDb = false;
  lastKnownDiskRaw = currentDiskRaw;
  lastDiskDb = cloneDb(diskDetailed.db);

  const diskModifiedExternally =
    storedDiskSnapshot !== null &&
    normalizeJsonComparison(currentDiskRaw) !== normalizeJsonComparison(storedDiskSnapshot);

  let hasBootConflict = false;
  if (diskModifiedExternally && cachedState) {
    const baseDb = parseCachedState(storedDiskSnapshot);
    const { merged, hasCollision } = shallowMergeDatabases(baseDb, cachedState, diskDetailed.db);
    if (hasCollision) {
      safeSetStorage(getBackupKey(), JSON.stringify(cachedState));
      hasBootConflict = true;
    }
    store = merged;
    storeInitialized = true;
    lastSerializedContent = serializeContentBuckets(store);
    hydrateSubtreeFromStore(document, false);
    writeStoreToDomScript(store, false);
    const storedOk = safeSetStorage(pageKey, JSON.stringify(store));
    safeSetStorage(snapshotKey, currentDiskRaw);
    if (hasBootConflict) {
      updateUi('conflict', 'External Disk Edit · Conflict Backed Up');
    } else if (!storedOk) {
      updateUi('cached', 'In-Memory Only · Link Disk');
    } else {
      updateUi('cached', 'Browser Cache · Click to Link Disk');
    }
  } else if (!cachedState) {
    store = cloneDb(diskDetailed.db);
    storeInitialized = true;
    lastSerializedContent = serializeContentBuckets(store);
    hydrateSubtreeFromStore(document, false);
    writeStoreToDomScript(store, false);
    const storedOk = safeSetStorage(pageKey, JSON.stringify(store));
    safeSetStorage(snapshotKey, currentDiskRaw);
    if (!storedOk) {
      updateUi('cached', 'In-Memory Only · Link Disk');
    } else {
      updateUi('cached', 'Browser Cache · Click to Link Disk');
    }
  } else {
    store = cloneDb(cachedState);
    storeInitialized = true;
    lastSerializedContent = serializeContentBuckets(store);
    hydrateSubtreeFromStore(document, false);
    writeStoreToDomScript(store, false);
    const storedOk = safeSetStorage(pageKey, JSON.stringify(store));
    if (storedDiskSnapshot === null) {
      safeSetStorage(snapshotKey, currentDiskRaw);
    }
    if (!storedOk) {
      updateUi('cached', 'In-Memory Only · Link Disk');
    } else {
      updateUi('cached', 'Browser Cache · Click to Link Disk');
    }
  }

  window.dispatchEvent(new CustomEvent('naizo:hydrate', { detail: store }));

  fileHandle = await loadHandleFromIDB();
  if (fileHandle) {
    try {
      const perm = await fileHandle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        startDiskWatch();
        await checkDiskForExternalChanges();
        const isDirtyComparedToDisk =
          serializeContentBuckets(ensureStore()) !== serializeContentBuckets(lastDiskDb);
        if (hasBootConflict) {
          updateUi('conflict', 'External Disk Edit · Conflict Backed Up');
        } else if (isDirtyComparedToDisk) {
          updateUi('cached', 'Browser Cache · Click to Link Disk');
        } else {
          updateUi('saved', 'Synced to Disk');
        }
      } else {
        updateUi('needs-permission', 'Resume Disk Sync');
      }
    } catch {
      updateUi('needs-permission', 'Resume Disk Sync');
    }
  }
}
