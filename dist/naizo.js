(function() {
	//#region src/index.ts
	const DB_ID = "naizodb";
	const UI_ID = "__naizodb_host__";
	const STYLE_ID = "__naizodb_styles__";
	const IDB_NAME = "NaizoDB_Handles";
	const PERSIST_DEBOUNCE_MS = 150;
	const DISK_DEBOUNCE_MS = 250;
	const DISK_WATCH_INTERVAL_MS = 2e3;
	const NET_ACTIVE_HOLD_MS = 600;
	const SAVING_CYCLE_MS = 1550;
	const CDN_NAIZO_MIN_JS_URL = "https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js";
	const RELATIVE_NAIZO_SCRIPT_RE = /(?:^|[\\/])naizo(?:\.min)?\.js(?:[?#].*)?$/i;
	const ABSOLUTE_OR_SCHEME_URL_RE = /^(?:https?:|file:|data:|blob:|\/\/)/i;
	const BOUND_SELECTOR = "[naizo], [data-naizo]";
	const LIST_SELECTOR = "[naizo-list], [data-naizo-list]";
	const ITEM_SELECTOR = "[naizo-item], [data-naizo-item]";
	const DIRECT_ITEM_SELECTOR = ":scope > [naizo-item], :scope > [data-naizo-item]";
	const API_REQUEST_SELECTOR = "[naizo-get], [data-naizo-get], [naizo-post], [data-naizo-post]";
	const TEMPLATE_SELECTOR = "template[naizo-template], template[data-naizo-template], template";
	const AUTHORED_TEMPLATE_SELECTOR = ":scope > template[naizo-template]:not([data-naizo-auto-template]), :scope > template[data-naizo-template]:not([data-naizo-auto-template]), :scope > template:not([data-naizo-auto-template])";
	const AUTO_TEMPLATE_SELECTOR = ":scope > template[data-naizo-auto-template]";
	const STRIP_SELECTOR = "[naizo-strip], [data-naizo-strip]";
	const IGNORE_SELECTOR = `[naizo-ignore], [data-naizo-ignore], ${STRIP_SELECTOR}`;
	const RUNTIME_STRIP_SELECTOR = `${STRIP_SELECTOR}, #${UI_ID}, #${STYLE_ID}`;
	const SKIPPED_INPUT_TYPES = /* @__PURE__ */ new Set([
		"password",
		"file",
		"button",
		"submit",
		"reset",
		"image"
	]);
	let radioScopeCounter = 0;
	function hasOwn(obj, key) {
		return Object.hasOwn(obj, key);
	}
	function getOwn(obj, key) {
		return Object.hasOwn(obj, key) ? obj[key] : void 0;
	}
	function setOwn(obj, key, value) {
		Object.defineProperty(obj, key, {
			value,
			writable: true,
			enumerable: true,
			configurable: true
		});
	}
	function deleteOwn(obj, key) {
		if (Object.hasOwn(obj, key)) Reflect.deleteProperty(obj, key);
	}
	function isPlainObject(val) {
		if (val === null || typeof val !== "object" || Array.isArray(val)) return false;
		const proto = Object.getPrototypeOf(val);
		return proto === null || proto === Object.prototype;
	}
	function isValidJsonValue(val, seen = /* @__PURE__ */ new Set()) {
		if (val === null || typeof val === "string" || typeof val === "boolean") return true;
		if (typeof val === "number") return Number.isFinite(val);
		if (typeof val === "undefined" || typeof val === "function" || typeof val === "symbol" || typeof val === "bigint") return false;
		if (Array.isArray(val)) {
			if (seen.has(val)) return false;
			seen.add(val);
			for (let i = 0; i < val.length; i += 1) if (!(i in val) || !isValidJsonValue(val[i], seen)) return false;
			seen.delete(val);
			return true;
		}
		if (isPlainObject(val)) {
			if (seen.has(val)) return false;
			seen.add(val);
			for (const k of Object.keys(val)) if (!isValidJsonValue(getOwn(val, k), seen)) return false;
			seen.delete(val);
			return true;
		}
		return false;
	}
	function cloneJsonValue(val) {
		if (Array.isArray(val)) return val.map((item) => cloneJsonValue(item));
		if (isPlainObject(val)) return cloneRecord(val);
		return val;
	}
	function cloneRecord(rec) {
		const out = {};
		for (const key of Object.keys(rec)) setOwn(out, key, cloneJsonValue(getOwn(rec, key)));
		return out;
	}
	function createEmptyDb() {
		return {
			_meta: {},
			fields: {},
			lists: {},
			custom: {}
		};
	}
	function cloneDb(db) {
		const lists = {};
		for (const listName of Object.keys(db.lists)) {
			const arr = getOwn(db.lists, listName);
			if (Array.isArray(arr)) setOwn(lists, listName, arr.map((item) => isPlainObject(item) ? cloneRecord(item) : {}));
		}
		return {
			_meta: cloneRecord(db._meta),
			fields: cloneRecord(db.fields),
			lists,
			custom: cloneRecord(db.custom)
		};
	}
	function validateAndNormalizeDb(parsed) {
		if (!isPlainObject(parsed)) return null;
		const rawMeta = hasOwn(parsed, "_meta") ? getOwn(parsed, "_meta") : {};
		const rawFields = hasOwn(parsed, "fields") ? getOwn(parsed, "fields") : {};
		const rawLists = hasOwn(parsed, "lists") ? getOwn(parsed, "lists") : {};
		const rawCustom = hasOwn(parsed, "custom") ? getOwn(parsed, "custom") : {};
		if (!isPlainObject(rawMeta) || !isPlainObject(rawFields) || !isPlainObject(rawLists) || !isPlainObject(rawCustom)) return null;
		const lists = {};
		for (const listName of Object.keys(rawLists)) {
			const rawArr = getOwn(rawLists, listName);
			if (!Array.isArray(rawArr)) return null;
			const cleanItems = [];
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
			custom: cloneRecord(rawCustom)
		};
	}
	function normalizePathname(rawPath) {
		return rawPath.replace(/\/index\.html?$/i, "/") || "/";
	}
	function getDocumentScopeId() {
		if (typeof document === "undefined") return "";
		const attrId = (document.documentElement ? getAttr(document.documentElement, "naizo-id") : null) ?? (document.body ? getAttr(document.body, "naizo-id") : null);
		if (attrId && attrId.trim()) return attrId.trim();
		if (storeInitialized && typeof store._meta.id === "string" && store._meta.id.trim()) return store._meta.id.trim();
		const raw = document.getElementById(DB_ID)?.textContent ?? "";
		if (raw.includes("\"id\"")) try {
			const parsed = JSON.parse(raw);
			if (typeof parsed?._meta?.id === "string" && parsed._meta.id.trim()) return parsed._meta.id.trim();
		} catch {}
		return "";
	}
	function getStorageSuffix() {
		const normPath = normalizePathname(typeof location !== "undefined" && location.pathname ? location.pathname : "/");
		const scopeId = getDocumentScopeId();
		return scopeId ? `${normPath}::${scopeId}` : normPath;
	}
	function getPageKey() {
		return "naizodb_state_" + getStorageSuffix();
	}
	function getSnapshotKey() {
		return "naizodb_disk_hash_" + getStorageSuffix();
	}
	const VALID_PILL_CORNERS = /* @__PURE__ */ new Set([
		"bottom-right",
		"bottom-left",
		"top-right",
		"top-left"
	]);
	function getBackupKey() {
		return "naizodb_backup_" + getStorageSuffix();
	}
	function getRawBackupKey() {
		return "naizodb_raw_backup_" + getStorageSuffix();
	}
	function getUiKey() {
		return "naizodb_ui_" + getStorageSuffix();
	}
	function toValidCorner(val) {
		if (typeof val !== "string") return null;
		const norm = val.trim().toLowerCase();
		return VALID_PILL_CORNERS.has(norm) ? norm : null;
	}
	function readSavedUiCorner() {
		const raw = safeGetStorage(getUiKey());
		if (raw) try {
			const saved = toValidCorner(JSON.parse(raw)?.corner);
			if (saved) return saved;
		} catch {}
		if (typeof document !== "undefined") {
			const hinted = toValidCorner((document.body ? getAttr(document.body, "naizo-pill-corner") : null) ?? (document.documentElement ? getAttr(document.documentElement, "naizo-pill-corner") : null));
			if (hinted) return hinted;
		}
		return "bottom-right";
	}
	function saveUiCorner(corner) {
		safeSetStorage(getUiKey(), JSON.stringify({ corner }));
	}
	function safeGetStorage(key) {
		try {
			if (typeof localStorage === "undefined") return null;
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	}
	function safeSetStorage(key, value) {
		try {
			if (typeof localStorage === "undefined") return false;
			localStorage.setItem(key, value);
			return true;
		} catch (e) {
			console.warn("[naizo.js] localStorage write failed:", e);
			return false;
		}
	}
	function safeRemoveStorage(key) {
		try {
			if (typeof localStorage === "undefined") return;
			localStorage.removeItem(key);
		} catch {}
	}
	function serializeDbJson(db) {
		return JSON.stringify(db, null, 2).replace(/</g, "\\u003c");
	}
	function getAttr(el, shortName) {
		return el.getAttribute(shortName) ?? el.getAttribute(`data-${shortName}`);
	}
	function hasAttr(el, shortName) {
		return el.hasAttribute(shortName) || el.hasAttribute(`data-${shortName}`);
	}
	function escapeSelectorAttr(val) {
		if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(val);
		return val.replace(/["\\]/g, "\\$&");
	}
	function findListElements(listName) {
		const escaped = escapeSelectorAttr(listName);
		const matches = document.querySelectorAll(`[naizo-list="${escaped}"], [data-naizo-list="${escaped}"]`);
		const result = [];
		matches.forEach((el) => {
			if (!isIgnoredElement(el)) result.push(el);
		});
		return result;
	}
	function toTextValue(val) {
		if (val == null) return "";
		if (typeof val === "string") return val;
		if (typeof val === "number" || typeof val === "boolean" || typeof val === "bigint") return String(val);
		return JSON.stringify(val);
	}
	function toBooleanValue(val) {
		if (typeof val === "boolean") return val;
		if (typeof val === "number") return val !== 0 && !Number.isNaN(val);
		if (typeof val === "string") {
			const norm = val.trim().toLowerCase();
			if (norm === "false" || norm === "0" || norm === "" || norm === "no" || norm === "off") return false;
			return true;
		}
		return Boolean(val);
	}
	const MAX_REENTRANT_CHANGE_PASSES = 10;
	let store = createEmptyDb();
	let storeInitialized = false;
	let bootHydrated = false;
	let startupInvalidDb = false;
	let liveDiskInvalidJson = false;
	let repairingDiskInvalidDb = false;
	let overwriteDiskWithoutMerge = false;
	let confirmedMissingDbInject = false;
	let lastExternalCheckHadConflict = false;
	let pendingInitialLinkFile = null;
	let isDispatchingChange = false;
	let pendingChangeQueue = [];
	let batchDepth = 0;
	let batchSilentDepth = 0;
	let batchDeferDepth = 0;
	let batchDirty = false;
	let batchAllSilent = true;
	let batchDeferPersist = true;
	let trackedDbScriptEl = null;
	let lastSerializedContent = "";
	let lastKnownDiskRaw = null;
	let lastDiskDb = null;
	let initialDiskDb = null;
	let lastObservedModified = null;
	let itemDataMap = /* @__PURE__ */ new WeakMap();
	let fileHandle = null;
	let fileHandlePermission = "prompt";
	let persistTimeout = null;
	let saveTimeout = null;
	let watchInterval = null;
	let writeInFlightPromise = null;
	let writeQueued = false;
	let uiHost = null;
	let statusEl = null;
	let dotBtnEl = null;
	let actionBtn = null;
	let actionSrEl = null;
	let actionSvgEl = null;
	let restoreBtn = null;
	let restoreSrEl = null;
	let restoreSvgEl = null;
	let copySrEl = null;
	let copySvgEl = null;
	let resetBtn = null;
	let resetConfirmEl = null;
	let unlinkBtn = null;
	let netSepEl = null;
	let netBtn = null;
	let tooltipEl = null;
	let tooltipTextEl = null;
	let tooltipKbdEl = null;
	let activeTipBtn = null;
	let pillTipTargets = [];
	let transientTipTimeout = null;
	let dragClickResetTimeout = null;
	let savingCycleStart = 0;
	let savingMinCycles = 1;
	let savingHoldTimeout = null;
	let copyResetTimeout = null;
	let bootClearTimeout = null;
	let themeObserver = null;
	let themeMediaCleanup = null;
	let netRevealed = false;
	let netState = "idle";
	let netInFlightCount = 0;
	let netActiveStartMs = 0;
	let netPendingError = false;
	let netHoldTimeout = null;
	let autoTriggeredElements = /* @__PURE__ */ new WeakSet();
	let listenerController = null;
	let initEpoch = 0;
	function isCurrentEpoch(epoch) {
		return epoch === initEpoch;
	}
	function isCurrentHandle(epoch, handle) {
		return epoch === initEpoch && fileHandle === handle;
	}
	function getExplicitNaizoMode() {
		if (typeof document === "undefined") return "auto";
		const raw = ((document.documentElement ? getAttr(document.documentElement, "naizo-mode") : null) ?? (document.body ? getAttr(document.body, "naizo-mode") : null) ?? "auto").trim().toLowerCase();
		return raw === "online" || raw === "local" ? raw : "auto";
	}
	function isLocalHostname(hostname) {
		const h = hostname.trim().toLowerCase();
		return h === "" || h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1" || h === "0.0.0.0" || h.endsWith(".local") || h.endsWith(".localhost");
	}
	function isOnlineMode() {
		if (fileHandle !== null) return false;
		const explicit = getExplicitNaizoMode();
		if (explicit === "online") return true;
		if (explicit === "local") return false;
		if (typeof location === "undefined") return false;
		const proto = (location.protocol ?? "").toLowerCase();
		if (proto !== "http:" && proto !== "https:") return false;
		return !isLocalHostname(location.hostname ?? "");
	}
	function isNoPillMode() {
		if (typeof document === "undefined") return false;
		const bodyAttr = document.body ? getAttr(document.body, "naizo-no-pill") : null;
		if (bodyAttr !== null) return bodyAttr.trim().toLowerCase() !== "false";
		const htmlAttr = document.documentElement ? getAttr(document.documentElement, "naizo-no-pill") : null;
		if (htmlAttr !== null) return htmlAttr.trim().toLowerCase() !== "false";
		return false;
	}
	function idbStore(mode, callback, onFail) {
		try {
			if (typeof indexedDB === "undefined") {
				onFail?.();
				return;
			}
			const req = indexedDB.open(IDB_NAME, 1);
			req.onupgradeneeded = () => req.result.createObjectStore("handles");
			req.onsuccess = () => {
				try {
					callback(req.result.transaction("handles", mode).objectStore("handles"));
				} catch {
					onFail?.();
				}
			};
			req.onerror = () => onFail?.();
		} catch {
			onFail?.();
		}
	}
	function saveHandleToIDB(handle, key = getPageKey()) {
		idbStore("readwrite", (idb) => idb.put(handle, key));
	}
	function deleteHandleFromIDB(key = getPageKey()) {
		return new Promise((resolve) => {
			idbStore("readwrite", (idb) => {
				const delReq = idb.delete(key);
				delReq.onsuccess = () => resolve();
				delReq.onerror = () => resolve();
			}, resolve);
		});
	}
	function loadHandleFromIDB(key = getPageKey()) {
		return new Promise((resolve) => {
			idbStore("readonly", (idb) => {
				const getReq = idb.get(key);
				getReq.onsuccess = () => resolve(getReq.result ?? null);
				getReq.onerror = () => resolve(null);
			}, () => resolve(null));
		});
	}
	function getDbScript() {
		let el = document.getElementById(DB_ID);
		if (!el) {
			el = document.createElement("script");
			el.id = DB_ID;
			el.type = "application/json";
			el.textContent = "\n{\n  \"_meta\": {},\n  \"fields\": {},\n  \"lists\": {},\n  \"custom\": {}\n}\n";
			document.head.prepend(el);
		}
		return el;
	}
	function parseDbScriptDetailed(rawText, silent = false) {
		const raw = (rawText ?? getDbScript().textContent ?? "").trim();
		if (!raw) return {
			ok: true,
			db: createEmptyDb(),
			raw
		};
		try {
			const validated = validateAndNormalizeDb(JSON.parse(raw));
			if (!validated) {
				if (!silent) console.warn("[naizo.js] Invalid database shape in #naizodb.");
				return {
					ok: false,
					db: createEmptyDb(),
					raw
				};
			}
			return {
				ok: true,
				db: validated,
				raw
			};
		} catch (e) {
			if (!silent) console.warn("[naizo.js] Invalid JSON in #naizodb, resetting.", e);
			return {
				ok: false,
				db: createEmptyDb(),
				raw
			};
		}
	}
	function parseCachedState(raw) {
		if (!raw) return null;
		try {
			const validated = validateAndNormalizeDb(JSON.parse(raw));
			if (!validated) {
				console.warn("[naizo.js] Invalid database shape in localStorage cache, ignoring.");
				return null;
			}
			return validated;
		} catch (e) {
			console.warn("[naizo.js] Invalid JSON in localStorage cache, ignoring.", e);
			return null;
		}
	}
	function serializeContentBuckets(db) {
		return JSON.stringify({
			fields: db.fields,
			lists: db.lists,
			custom: db.custom
		});
	}
	function canonicalJson(val) {
		if (val === null || typeof val !== "object") return JSON.stringify(val);
		if (Array.isArray(val)) {
			let out = "[";
			for (let i = 0; i < val.length; i += 1) {
				if (i > 0) out += ",";
				out += canonicalJson(val[i]);
			}
			return out + "]";
		}
		const rec = val;
		const keys = Object.keys(rec).sort();
		let out = "{";
		let first = true;
		for (let i = 0; i < keys.length; i += 1) {
			const k = keys[i];
			const v = getOwn(rec, k);
			if (v === void 0) continue;
			if (!first) out += ",";
			first = false;
			out += JSON.stringify(k) + ":" + canonicalJson(v);
		}
		return out + "}";
	}
	function canonicalContentBuckets(db) {
		return canonicalJson({
			fields: db.fields,
			lists: db.lists,
			custom: db.custom
		});
	}
	function isInvalidDbState() {
		return startupInvalidDb || liveDiskInvalidJson;
	}
	function normalizeJsonComparison(raw) {
		const trimmed = raw.trim();
		if (!trimmed) return "";
		try {
			const parsed = JSON.parse(trimmed);
			const validated = validateAndNormalizeDb(parsed);
			if (validated) return canonicalContentBuckets(validated);
			return canonicalJson(parsed);
		} catch {
			return trimmed;
		}
	}
	function fnv1aHex8(input) {
		let hash = 2166136261;
		for (let i = 0; i < input.length; i += 1) {
			hash ^= input.charCodeAt(i);
			hash = Math.imul(hash, 16777619);
		}
		return (hash >>> 0).toString(16).padStart(8, "0");
	}
	function fnv1aStringHash(input) {
		return "fnv1a:" + fnv1aHex8(input);
	}
	function getPrimitiveItemIdKey(item) {
		if (!hasOwn(item, "id")) return null;
		const id = getOwn(item, "id");
		if (typeof id === "string") return id.trim().length > 0 ? `string:${id}` : null;
		if (typeof id === "number") return Number.isFinite(id) ? `number:${String(id)}` : null;
		return null;
	}
	function collectUniqueItemIds(items) {
		const ids = [];
		const seen = /* @__PURE__ */ new Set();
		for (const item of items) {
			const key = getPrimitiveItemIdKey(item);
			if (!key || seen.has(key)) return null;
			seen.add(key);
			ids.push(key);
		}
		return ids;
	}
	function buildKeyHashesForBucket(bucket) {
		const out = {};
		for (const key of Object.keys(bucket)) {
			const val = getOwn(bucket, key);
			if (val !== void 0) setOwn(out, key, fnv1aStringHash(canonicalJson(val)));
		}
		return out;
	}
	function buildListHashesForBucket(lists) {
		const out = {};
		for (const key of Object.keys(lists)) {
			const arr = getOwn(lists, key);
			if (Array.isArray(arr)) {
				const ids = collectUniqueItemIds(arr);
				setOwn(out, key, {
					h: fnv1aStringHash(canonicalJson(arr)),
					i: arr.map((item) => fnv1aHex8(canonicalJson(item))),
					...ids !== null ? { k: ids } : {}
				});
			}
		}
		return out;
	}
	function buildDbKeyHashMap(db) {
		return {
			fields: buildKeyHashesForBucket(db.fields),
			lists: buildListHashesForBucket(db.lists),
			custom: buildKeyHashesForBucket(db.custom)
		};
	}
	function hashCanonicalDb(raw) {
		const trimmed = raw.trim();
		if (!trimmed) return fnv1aStringHash("");
		try {
			const parsed = JSON.parse(trimmed);
			const validated = validateAndNormalizeDb(parsed);
			if (validated) return `${fnv1aStringHash(canonicalContentBuckets(validated))}|${JSON.stringify(buildDbKeyHashMap(validated))}`;
			return fnv1aStringHash(canonicalJson(parsed));
		} catch {
			return fnv1aStringHash(trimmed);
		}
	}
	function extractRootDiskHash(storedSnapshot) {
		const trimmed = storedSnapshot.trim();
		if (!trimmed.startsWith("fnv1a:")) return "";
		const pipeIdx = trimmed.indexOf("|");
		return pipeIdx === -1 ? trimmed : trimmed.slice(0, pipeIdx);
	}
	function extractKeyHashManifest(storedSnapshot) {
		const trimmed = storedSnapshot.trim();
		if (!trimmed.startsWith("fnv1a:")) return null;
		const pipeIdx = trimmed.indexOf("|");
		if (pipeIdx === -1) return null;
		try {
			const parsed = JSON.parse(trimmed.slice(pipeIdx + 1));
			if (isPlainObject(parsed) && isPlainObject(parsed.fields) && isPlainObject(parsed.lists) && isPlainObject(parsed.custom)) {
				const rawLists = parsed.lists;
				const cleanLists = {};
				for (const k of Object.keys(rawLists)) {
					const entry = getOwn(rawLists, k);
					if (typeof entry === "string") setOwn(cleanLists, k, entry);
					else if (isPlainObject(entry) && typeof entry.h === "string" && Array.isArray(entry.i) && entry.i.every((h) => typeof h === "string")) {
						const ids = Array.isArray(entry.k) && entry.k.length === entry.i.length && entry.k.every((id) => typeof id === "string") ? entry.k : void 0;
						setOwn(cleanLists, k, {
							h: entry.h,
							i: entry.i,
							...ids !== void 0 ? { k: ids } : {}
						});
					}
				}
				return {
					fields: parsed.fields,
					lists: cleanLists,
					custom: parsed.custom
				};
			}
		} catch {
			return null;
		}
		return null;
	}
	function ensureStore() {
		const currentScript = document.getElementById(DB_ID);
		if (!storeInitialized || currentScript !== null && currentScript !== trackedDbScriptEl) {
			const scriptEl = getDbScript();
			trackedDbScriptEl = scriptEl;
			const detailed = parseDbScriptDetailed(scriptEl.textContent ?? "");
			startupInvalidDb = !detailed.ok;
			store = detailed.db;
			storeInitialized = true;
			lastSerializedContent = serializeContentBuckets(store);
		}
		return store;
	}
	function getElementKey(el) {
		const key = el.getAttribute("naizo") ?? el.getAttribute("data-naizo");
		return key && key.length > 0 ? key : null;
	}
	function isIgnoredElement(el) {
		return Boolean(el.closest(`${IGNORE_SELECTOR}, template, #${UI_ID}`));
	}
	function isDetailsElement(el) {
		return typeof HTMLDetailsElement !== "undefined" && el instanceof HTMLDetailsElement || el.tagName.toLowerCase() === "details";
	}
	function isInteractiveBoundElement(el) {
		return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement || isDetailsElement(el) || isContentEditableElement(el);
	}
	function orderInteractiveFirst(elements) {
		const interactive = [];
		const passive = [];
		for (const el of elements) (isInteractiveBoundElement(el) ? interactive : passive).push(el);
		return interactive.length && passive.length ? interactive.concat(passive) : elements;
	}
	function isNonLeafElement(el) {
		if (isInteractiveBoundElement(el)) return false;
		return Array.from(el.children).some((child) => !child.matches(IGNORE_SELECTOR));
	}
	function readCleanTextContent(el) {
		if (!el.querySelector(IGNORE_SELECTOR)) return el.textContent ?? "";
		const clone = el.cloneNode(true);
		clone.querySelectorAll(IGNORE_SELECTOR).forEach((n) => n.remove());
		return clone.textContent ?? "";
	}
	function writeCleanTextContent(el, text) {
		if (!Array.from(el.children).some((child) => child.matches(IGNORE_SELECTOR))) {
			el.textContent = text;
			return;
		}
		const nonIgnoredNodes = Array.from(el.childNodes).filter((node) => !(node instanceof Element && node.matches(IGNORE_SELECTOR)));
		const textNodes = nonIgnoredNodes.filter((node) => node.nodeType === Node.TEXT_NODE);
		const targetTextNode = textNodes.find((node) => (node.nodeValue ?? "").trim().length > 0) ?? textNodes[0] ?? null;
		for (const node of nonIgnoredNodes) if (node !== targetTextNode) node.remove();
		if (targetTextNode) {
			targetTextNode.nodeValue = text;
			return;
		}
		const newTextNode = document.createTextNode(text);
		const firstStripChild = el.querySelector(":scope > [naizo-strip], :scope > [data-naizo-strip]");
		if (firstStripChild) el.insertBefore(newTextNode, firstStripChild);
		else el.appendChild(newTextNode);
	}
	function isSkippedElement(el, warn = false) {
		if (el instanceof HTMLInputElement) {
			const type = (el.getAttribute("type") ?? el.type ?? "text").toLowerCase();
			if (SKIPPED_INPUT_TYPES.has(type)) {
				if (warn) console.warn(`[naizo.js] Skipping unsupported input[type="${type}"] binding.`);
				return true;
			}
			return false;
		}
		if (isNonLeafElement(el)) {
			if (warn) console.warn("[naizo.js] Skipping non-leaf element binding with child elements to avoid wiping children.");
			return true;
		}
		return false;
	}
	function isContentEditableElement(el) {
		if (!el.hasAttribute("contenteditable")) return false;
		const attr = (el.getAttribute("contenteditable") ?? "").trim().toLowerCase();
		return attr === "" || attr === "true" || attr === "plaintext-only";
	}
	function readElementValue(el) {
		if (isSkippedElement(el)) return void 0;
		if (el instanceof HTMLInputElement) {
			const type = (el.getAttribute("type") ?? el.type ?? "text").toLowerCase();
			if (type === "checkbox") return el.checked;
			if (type === "radio") return el.checked ? el.value : void 0;
			if (type === "number" || type === "range") {
				const raw = el.value.trim();
				if (raw === "") return null;
				const num = Number(raw);
				return Number.isFinite(num) ? num : null;
			}
			return el.value;
		}
		if (el instanceof HTMLSelectElement) {
			if (el.multiple) return Array.from(el.options).filter((opt) => opt.selected).map((opt) => opt.value);
			return el.value;
		}
		if (el instanceof HTMLTextAreaElement) return el.value;
		if (isDetailsElement(el)) return Boolean(el.open);
		return readCleanTextContent(el);
	}
	function writeElementValue(el, val) {
		if (isSkippedElement(el, true)) return;
		const textVal = toTextValue(val);
		if (el instanceof HTMLInputElement) {
			const type = (el.getAttribute("type") ?? el.type ?? "text").toLowerCase();
			if (type === "checkbox") el.checked = toBooleanValue(val);
			else if (type === "radio") el.checked = el.value === textVal;
			else if (type === "number" || type === "range") el.value = val == null ? "" : textVal;
			else el.value = textVal;
			return;
		}
		if (el instanceof HTMLSelectElement) {
			if (el.multiple) {
				const values = Array.isArray(val) ? val.map((v) => toTextValue(v)) : [textVal];
				const valSet = new Set(values);
				if (values.some((v) => v !== "" && !Array.from(el.options).some((opt) => opt.value === v))) console.warn("[naizo.js] Stored value in <select multiple> has no matching <option>; preserving stored value.");
				Array.from(el.options).forEach((opt) => {
					opt.selected = valSet.has(opt.value);
				});
				return;
			}
			if (!Array.from(el.options).some((opt) => opt.value === textVal)) {
				if (textVal === "") {
					el.selectedIndex = -1;
					return;
				}
				console.warn(`[naizo.js] Stored value "${textVal}" has no matching <option> in <select>; preserving stored value.`);
				return;
			}
			el.value = textVal;
			return;
		}
		if (el instanceof HTMLTextAreaElement) {
			el.value = textVal;
			return;
		}
		if (isDetailsElement(el)) {
			el.open = toBooleanValue(val);
			return;
		}
		writeCleanTextContent(el, textVal);
	}
	function bakeClonedElementAttributes(liveEl, cloneEl) {
		if (isSkippedElement(liveEl)) return;
		if (liveEl instanceof HTMLInputElement && cloneEl instanceof HTMLInputElement) {
			if (liveEl.type === "checkbox" || liveEl.type === "radio") {
				if (liveEl.checked) cloneEl.setAttribute("checked", "checked");
				else cloneEl.removeAttribute("checked");
			} else cloneEl.setAttribute("value", liveEl.value);
			return;
		}
		if (liveEl instanceof HTMLSelectElement && cloneEl instanceof HTMLSelectElement) {
			Array.from(liveEl.options).forEach((opt, idx) => {
				const cloneOpt = cloneEl.options[idx];
				if (!cloneOpt) return;
				if (opt.selected) cloneOpt.setAttribute("selected", "selected");
				else cloneOpt.removeAttribute("selected");
			});
			return;
		}
		if (liveEl instanceof HTMLTextAreaElement && cloneEl instanceof HTMLTextAreaElement) {
			cloneEl.textContent = liveEl.value;
			return;
		}
		if (isDetailsElement(liveEl) && isDetailsElement(cloneEl)) {
			if (liveEl.open) cloneEl.setAttribute("open", "");
			else cloneEl.removeAttribute("open");
			return;
		}
		if (isContentEditableElement(liveEl)) writeCleanTextContent(cloneEl, readCleanTextContent(liveEl));
	}
	function clearElementValue(el) {
		if (el instanceof HTMLInputElement) {
			if (el.type === "checkbox" || el.type === "radio") {
				el.checked = false;
				el.removeAttribute("checked");
			} else {
				el.value = "";
				el.removeAttribute("value");
			}
		} else if (el instanceof HTMLSelectElement) {
			if (el.multiple) Array.from(el.options).forEach((opt) => {
				opt.selected = false;
				opt.removeAttribute("selected");
			});
			else {
				const emptyIdx = Array.from(el.options).findIndex((opt) => opt.value === "");
				el.selectedIndex = emptyIdx;
				Array.from(el.options).forEach((opt, i) => {
					if (i === emptyIdx) opt.setAttribute("selected", "selected");
					else opt.removeAttribute("selected");
				});
			}
		} else if (el instanceof HTMLTextAreaElement) {
			el.value = "";
			el.textContent = "";
		} else if (isDetailsElement(el)) {
			el.open = false;
			el.removeAttribute("open");
		} else if (!isNonLeafElement(el)) writeCleanTextContent(el, "");
	}
	function shouldUpdateStoredValue(prevVal, nextVal, exists) {
		if (!exists) return true;
		if (Object.is(prevVal, nextVal)) return false;
		if (Array.isArray(prevVal) && Array.isArray(nextVal)) return JSON.stringify(prevVal) !== JSON.stringify(nextVal);
		if (typeof nextVal === "string" && (typeof prevVal === "number" || typeof prevVal === "boolean") && String(prevVal) === nextVal) return false;
		return true;
	}
	function queryStandaloneBoundElements(root = document) {
		const result = [];
		if (root instanceof Element && root.matches(BOUND_SELECTOR)) {
			if (!isIgnoredElement(root) && !root.closest(ITEM_SELECTOR) && !isSkippedElement(root, true)) result.push(root);
		}
		root.querySelectorAll(BOUND_SELECTOR).forEach((el) => {
			if (isIgnoredElement(el) || el.closest(ITEM_SELECTOR) || isSkippedElement(el, true)) return;
			result.push(el);
		});
		return result;
	}
	function queryItemBoundElements(itemEl) {
		const result = [];
		if (itemEl.matches(BOUND_SELECTOR) && !isIgnoredElement(itemEl) && !isSkippedElement(itemEl, true)) result.push(itemEl);
		itemEl.querySelectorAll(BOUND_SELECTOR).forEach((el) => {
			if (el.closest(ITEM_SELECTOR) !== itemEl) return;
			if (isIgnoredElement(el) || isSkippedElement(el, true)) return;
			result.push(el);
		});
		return result;
	}
	function getKeyBoundSelector(key) {
		const escaped = escapeSelectorAttr(key);
		return `[naizo="${escaped}"], [data-naizo="${escaped}"]`;
	}
	function propagateStandaloneKey(key, val, sourceEl) {
		document.querySelectorAll(getKeyBoundSelector(key)).forEach((el) => {
			if (el === sourceEl) return;
			if (isIgnoredElement(el) || el.closest(ITEM_SELECTOR) || isSkippedElement(el, true)) return;
			writeElementValue(el, val);
		});
	}
	function propagateItemKey(itemEl, key, val, sourceEl) {
		const selector = getKeyBoundSelector(key);
		if (itemEl !== sourceEl && itemEl.matches(selector) && !isIgnoredElement(itemEl) && !isSkippedElement(itemEl, true)) writeElementValue(itemEl, val);
		itemEl.querySelectorAll(selector).forEach((el) => {
			if (el === sourceEl || el.closest(ITEM_SELECTOR) !== itemEl) return;
			if (isIgnoredElement(el) || isSkippedElement(el, true)) return;
			writeElementValue(el, val);
		});
	}
	function scopeRowRadioInputs(itemEl, listName) {
		const radios = Array.from(itemEl.querySelectorAll("input[type=\"radio\"]"));
		if (radios.length === 0) return;
		radioScopeCounter += 1;
		const scopeId = radioScopeCounter;
		radios.forEach((radio) => {
			if (radio.closest(ITEM_SELECTOR) !== itemEl) return;
			const baseName = radio.getAttribute("data-naizo-radio-name") ?? radio.getAttribute("name") ?? getElementKey(radio) ?? "radio";
			radio.setAttribute("data-naizo-radio-name", baseName);
			radio.name = `__naizo_${listName}_${scopeId}_${baseName}`;
		});
	}
	function queryListElements(root = document) {
		const lists = [];
		if (root instanceof HTMLElement && root.matches(LIST_SELECTOR) && !isIgnoredElement(root)) lists.push(root);
		root.querySelectorAll(LIST_SELECTOR).forEach((el) => {
			if (!isIgnoredElement(el)) lists.push(el);
		});
		return lists;
	}
	function restoreScopedRadioNames(root) {
		root.querySelectorAll("input[data-naizo-radio-name]").forEach((r) => {
			const orig = r.getAttribute("data-naizo-radio-name");
			if (orig !== null) r.setAttribute("name", orig);
			r.removeAttribute("data-naizo-radio-name");
		});
	}
	function stripLoadingStateAttrs(root) {
		root.querySelectorAll("[data-naizo-loading], [data-naizo-loading-disabled]").forEach((el) => {
			const addedDisabled = el.hasAttribute("data-naizo-loading-disabled");
			el.removeAttribute("data-naizo-loading");
			el.removeAttribute("data-naizo-loading-disabled");
			if (addedDisabled) {
				if ("disabled" in el) el.disabled = false;
				el.removeAttribute("disabled");
			}
		});
	}
	function ensureListBlueprints(root = document, forceRegenerateAuto = false) {
		queryListElements(root).forEach((listEl) => {
			const authoredTpl = listEl.querySelector(AUTHORED_TEMPLATE_SELECTOR);
			if (authoredTpl) {
				if (!hasAttr(authoredTpl, "naizo-template")) authoredTpl.setAttribute("naizo-template", "");
				return;
			}
			const firstItem = listEl.querySelector(DIRECT_ITEM_SELECTOR);
			const existingAutoTpl = listEl.querySelector(AUTO_TEMPLATE_SELECTOR);
			if (existingAutoTpl && (!forceRegenerateAuto || !firstItem)) return;
			if (existingAutoTpl && firstItem) existingAutoTpl.remove();
			if (!firstItem) return;
			const cleanClone = firstItem.cloneNode(true);
			cleanClone.querySelectorAll(RUNTIME_STRIP_SELECTOR).forEach((n) => n.remove());
			restoreScopedRadioNames(cleanClone);
			if (cleanClone.matches(BOUND_SELECTOR) && !isIgnoredElement(cleanClone)) clearElementValue(cleanClone);
			cleanClone.querySelectorAll(BOUND_SELECTOR).forEach((el) => {
				if (!isIgnoredElement(el)) clearElementValue(el);
			});
			const tpl = document.createElement("template");
			tpl.setAttribute("naizo-template", "");
			tpl.setAttribute("data-naizo-auto-template", "true");
			tpl.content.appendChild(cleanClone);
			listEl.prepend(tpl);
		});
	}
	function decorateListControls(listEl) {
		if (hasAttr(listEl, "naizo-no-controls")) return;
		const listName = getAttr(listEl, "naizo-list");
		if (!listName) return;
		listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).forEach((itemEl) => {
			if (itemEl.querySelector("[naizo-remove], [data-naizo-remove]")) return;
			const tools = document.createElement("span");
			tools.className = "naizo-item-tools";
			tools.setAttribute("data-naizo-strip", "true");
			tools.innerHTML = `
      <button type="button" naizo-move="up" title="Move up" aria-label="Move item up">↑</button>
      <button type="button" naizo-move="down" title="Move down" aria-label="Move item down">↓</button>
      <button type="button" naizo-remove title="Delete item" aria-label="Delete item">×</button>
    `;
			if (itemEl.tagName.toLowerCase() === "tr") {
				const cells = itemEl.querySelectorAll(":scope > td, :scope > th");
				const lastCell = cells[cells.length - 1];
				if (lastCell) lastCell.appendChild(tools);
				else {
					const td = document.createElement("td");
					td.setAttribute("data-naizo-strip", "true");
					td.appendChild(tools);
					itemEl.appendChild(td);
				}
			} else itemEl.appendChild(tools);
		});
		const escaped = escapeSelectorAttr(listName);
		if (!Boolean(document.querySelector(`[naizo-add="${escaped}"]:not(.naizo-add-btn), [data-naizo-add="${escaped}"]:not(.naizo-add-btn)`))) {
			const tag = listEl.tagName.toLowerCase();
			const anchorEl = tag === "tbody" || tag === "thead" || tag === "tfoot" ? listEl.closest("table") ?? listEl : listEl;
			let cursor = anchorEl.nextElementSibling;
			let hasFooterForList = false;
			let insertAfter = anchorEl;
			while (cursor?.classList.contains("naizo-list-footer")) {
				if (cursor.querySelector(`[naizo-add="${escaped}"], [data-naizo-add="${escaped}"]`)) {
					hasFooterForList = true;
					break;
				}
				insertAfter = cursor;
				cursor = cursor.nextElementSibling;
			}
			if (!hasFooterForList) {
				const addWrap = document.createElement("div");
				addWrap.className = "naizo-list-footer";
				addWrap.setAttribute("data-naizo-strip", "true");
				const addBtn = document.createElement("button");
				addBtn.type = "button";
				addBtn.className = "naizo-add-btn";
				addBtn.setAttribute("naizo-add", listName);
				addBtn.setAttribute("aria-label", `Add item to ${listName}`);
				addBtn.textContent = "+ Add Item";
				addWrap.appendChild(addBtn);
				insertAfter.insertAdjacentElement("afterend", addWrap);
			}
		}
	}
	function bindItemElementToRecord(itemEl, rowObj, listName, seedMissing = true) {
		if (listName) scopeRowRadioInputs(itemEl, listName);
		itemDataMap.set(itemEl, rowObj);
		orderInteractiveFirst(queryItemBoundElements(itemEl)).forEach((el) => {
			const key = getElementKey(el);
			if (!key) return;
			if (hasOwn(rowObj, key)) writeElementValue(el, getOwn(rowObj, key));
			else if (seedMissing) {
				const val = readElementValue(el);
				if (val !== void 0) setOwn(rowObj, key, val);
			} else clearElementValue(el);
		});
	}
	function createItemNode(listEl, itemData = {}, seedMissing = true) {
		const tpl = listEl.querySelector(TEMPLATE_SELECTOR);
		if (!tpl) return null;
		const fragment = tpl.content.cloneNode(true);
		const itemEl = fragment.querySelector(ITEM_SELECTOR) ?? fragment.firstElementChild;
		if (!itemEl) return null;
		bindItemElementToRecord(itemEl, itemData, getAttr(listEl, "naizo-list") ?? "list", seedMissing);
		return itemEl;
	}
	function renderListItems(listEl, itemsArray, seedMissing = true) {
		listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).forEach((el) => el.remove());
		itemsArray.forEach((itemData) => {
			const node = createItemNode(listEl, itemData, seedMissing);
			if (node) listEl.appendChild(node);
		});
		decorateListControls(listEl);
	}
	function seedInteractiveTemplateDefaultsForList(listName, items) {
		if (items.length === 0) return;
		const interactiveTplControls = [];
		findListElements(listName).forEach((listEl) => {
			const tpl = listEl.querySelector(TEMPLATE_SELECTOR);
			const tplItem = tpl?.content.querySelector(ITEM_SELECTOR) ?? tpl?.content.firstElementChild;
			if (tplItem) queryItemBoundElements(tplItem).forEach((el) => {
				if (isInteractiveBoundElement(el)) interactiveTplControls.push(el);
			});
		});
		if (interactiveTplControls.length === 0) return;
		items.forEach((rowObj) => {
			seedMissingIntoRecord(interactiveTplControls, rowObj);
		});
	}
	function renderListFromStore(listName) {
		const rawArr = getOwn(ensureStore().lists, listName);
		const itemsArray = Array.isArray(rawArr) ? rawArr : [];
		const listEls = findListElements(listName);
		listEls.forEach((listEl) => ensureListBlueprints(listEl, false));
		seedInteractiveTemplateDefaultsForList(listName, itemsArray);
		listEls.forEach((listEl) => {
			renderListItems(listEl, itemsArray, true);
			syncNetVisibility(listEl);
		});
	}
	function getOrBindItemRecord(itemEl) {
		const existing = itemDataMap.get(itemEl);
		if (existing) return existing;
		const listEl = itemEl.closest(LIST_SELECTOR);
		if (!listEl) return null;
		const listName = getAttr(listEl, "naizo-list");
		if (!listName) return null;
		const db = ensureStore();
		let listArr = getOwn(db.lists, listName);
		if (!Array.isArray(listArr)) {
			listArr = [];
			setOwn(db.lists, listName, listArr);
		}
		const idx = Array.from(listEl.querySelectorAll(DIRECT_ITEM_SELECTOR)).indexOf(itemEl);
		if (idx === -1) return null;
		let rowObj = listArr[idx];
		if (!isPlainObject(rowObj)) {
			rowObj = {};
			listArr[idx] = rowObj;
		}
		itemDataMap.set(itemEl, rowObj);
		return rowObj;
	}
	function isElementActive(el) {
		if (typeof document === "undefined") return false;
		const active = document.activeElement;
		if (!active || active === document.body || active === document.documentElement) return false;
		return el === active || el.contains(active);
	}
	function writeStoreToDomScript(db, allowMetaBump) {
		const nextContent = serializeContentBuckets(db);
		if (allowMetaBump && nextContent !== lastSerializedContent) setOwn(db._meta, "updatedAt", (/* @__PURE__ */ new Date()).toISOString());
		lastSerializedContent = nextContent;
		const formatted = "\n" + serializeDbJson(db) + "\n";
		if (!startupInvalidDb) {
			const scriptEl = getDbScript();
			scriptEl.textContent = formatted;
			trackedDbScriptEl = scriptEl;
		}
		return formatted;
	}
	function seedMissingIntoRecord(elements, targetRec) {
		orderInteractiveFirst(elements).forEach((el) => {
			const key = getElementKey(el);
			if (!key || hasOwn(targetRec, key)) return;
			const val = readElementValue(el);
			if (val !== void 0) setOwn(targetRec, key, val);
		});
	}
	function buildInitialBaselineDb(diskDb) {
		const baseline = cloneDb(diskDb);
		seedMissingIntoRecord(queryStandaloneBoundElements(document), baseline.fields);
		const preSeededInteractiveLists = /* @__PURE__ */ new Set();
		queryListElements(document).forEach((listEl) => {
			const listName = getAttr(listEl, "naizo-list");
			if (!listName) return;
			if (hasOwn(baseline.lists, listName) && Array.isArray(getOwn(baseline.lists, listName))) {
				const items = getOwn(baseline.lists, listName);
				if (!preSeededInteractiveLists.has(listName)) {
					preSeededInteractiveLists.add(listName);
					seedInteractiveTemplateDefaultsForList(listName, items);
				}
				const tpl = listEl.querySelector(TEMPLATE_SELECTOR);
				const tplItem = tpl?.content.querySelector(ITEM_SELECTOR) ?? tpl?.content.firstElementChild;
				if (tplItem) {
					const tplBound = queryItemBoundElements(tplItem);
					items.forEach((rowObj) => {
						seedMissingIntoRecord(tplBound, rowObj);
					});
				}
				return;
			}
			const seededItems = [];
			listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).forEach((itemEl) => {
				const rowObj = {};
				seedMissingIntoRecord(queryItemBoundElements(itemEl), rowObj);
				seededItems.push(rowObj);
			});
			setOwn(baseline.lists, listName, seededItems);
		});
		return baseline;
	}
	function computeLongestIncreasingIndices(entries) {
		const n = entries.length;
		if (n === 0) return [];
		const tails = [];
		const prev = Array.from({ length: n }, () => -1);
		for (let i = 0; i < n; i += 1) {
			const val = entries[i].oldPos;
			let lo = 0;
			let hi = tails.length;
			while (lo < hi) {
				const mid = lo + hi >>> 1;
				if (entries[tails[mid]].oldPos < val) lo = mid + 1;
				else hi = mid;
			}
			if (lo > 0) prev[i] = tails[lo - 1];
			tails[lo] = i;
		}
		const out = [];
		let cur = tails[tails.length - 1];
		while (cur !== -1) {
			out.push(entries[cur].targetIdx);
			cur = prev[cur];
		}
		return out.reverse();
	}
	function reconcileListItems(listEl, targetItems, preserveActive, seedMissing = true) {
		const currentRows = Array.from(listEl.querySelectorAll(DIRECT_ITEM_SELECTOR));
		if (currentRows.length === 0 || targetItems.length === 0) {
			renderListItems(listEl, targetItems, seedMissing);
			return;
		}
		const listName = getAttr(listEl, "naizo-list") ?? "list";
		const rowCount = currentRows.length;
		const targetCount = targetItems.length;
		const matchedOldForTarget = Array.from({ length: targetCount }, () => -1);
		const usedOld = Array.from({ length: rowCount }, () => false);
		const oldRecords = currentRows.map((r) => itemDataMap.get(r));
		const oldIds = oldRecords.map((rec) => rec ? getPrimitiveItemIdKey(rec) : null);
		const targetIds = targetItems.map((rec) => getPrimitiveItemIdKey(rec));
		const refToOldIndices = /* @__PURE__ */ new Map();
		for (let i = 0; i < rowCount; i += 1) {
			const rec = oldRecords[i];
			if (rec) {
				const list = refToOldIndices.get(rec);
				if (list) list.push(i);
				else refToOldIndices.set(rec, [i]);
			}
		}
		for (let j = 0; j < targetCount; j += 1) {
			const oldIdx = refToOldIndices.get(targetItems[j])?.shift();
			if (oldIdx !== void 0 && !usedOld[oldIdx]) {
				matchedOldForTarget[j] = oldIdx;
				usedOld[oldIdx] = true;
			}
		}
		const oldIdCounts = /* @__PURE__ */ new Map();
		const oldIdIndex = /* @__PURE__ */ new Map();
		for (let i = 0; i < rowCount; i += 1) {
			const idKey = oldIds[i];
			if (idKey) {
				oldIdCounts.set(idKey, (oldIdCounts.get(idKey) ?? 0) + 1);
				oldIdIndex.set(idKey, i);
			}
		}
		const targetIdCounts = /* @__PURE__ */ new Map();
		for (let j = 0; j < targetCount; j += 1) {
			const idKey = targetIds[j];
			if (idKey) targetIdCounts.set(idKey, (targetIdCounts.get(idKey) ?? 0) + 1);
		}
		for (let j = 0; j < targetCount; j += 1) {
			if (matchedOldForTarget[j] !== -1) continue;
			const idKey = targetIds[j];
			if (!idKey || targetIdCounts.get(idKey) !== 1 || oldIdCounts.get(idKey) !== 1) continue;
			const oldIdx = oldIdIndex.get(idKey);
			if (oldIdx !== void 0 && !usedOld[oldIdx]) {
				matchedOldForTarget[j] = oldIdx;
				usedOld[oldIdx] = true;
			}
		}
		const prefixLimit = Math.min(rowCount, targetCount);
		for (let k = 0; k < prefixLimit; k += 1) {
			if (matchedOldForTarget[k] !== -1 || usedOld[k]) continue;
			if (oldIds[k] !== null || targetIds[k] !== null) continue;
			matchedOldForTarget[k] = k;
			usedOld[k] = true;
		}
		for (let i = 0; i < rowCount; i += 1) if (!usedOld[i]) currentRows[i].remove();
		const desiredRows = [];
		const desiredOldPos = [];
		for (let j = 0; j < targetCount; j += 1) {
			const itemObj = targetItems[j];
			const oldIdx = matchedOldForTarget[j];
			if (oldIdx !== -1) {
				const rowEl = currentRows[oldIdx];
				if (rowEl.querySelector("input[type=\"radio\"]:not([data-naizo-radio-name])")) scopeRowRadioInputs(rowEl, listName);
				itemDataMap.set(rowEl, itemObj);
				orderInteractiveFirst(queryItemBoundElements(rowEl)).forEach((el) => {
					if (preserveActive && isElementActive(el)) return;
					const key = getElementKey(el);
					if (!key) return;
					if (hasOwn(itemObj, key)) writeElementValue(el, getOwn(itemObj, key));
					else if (seedMissing) {
						const val = readElementValue(el);
						if (val !== void 0) setOwn(itemObj, key, val);
					} else clearElementValue(el);
				});
				desiredRows.push(rowEl);
				desiredOldPos.push(oldIdx);
			} else {
				const node = createItemNode(listEl, itemObj, seedMissing);
				if (node) {
					desiredRows.push(node);
					desiredOldPos.push(-1);
				}
			}
		}
		const survivingEntries = [];
		let activeEntryPos = -1;
		for (let j = 0; j < desiredRows.length; j += 1) {
			const oldPos = desiredOldPos[j];
			if (oldPos >= 0) {
				if (preserveActive && activeEntryPos === -1 && isElementActive(desiredRows[j])) activeEntryPos = survivingEntries.length;
				survivingEntries.push({
					targetIdx: j,
					oldPos
				});
			}
		}
		let stationaryIndices;
		if (activeEntryPos !== -1) {
			const activeEntry = survivingEntries[activeEntryPos];
			const before = survivingEntries.slice(0, activeEntryPos).filter((e) => e.oldPos < activeEntry.oldPos);
			const after = survivingEntries.slice(activeEntryPos + 1).filter((e) => e.oldPos > activeEntry.oldPos);
			stationaryIndices = [
				...computeLongestIncreasingIndices(before),
				activeEntry.targetIdx,
				...computeLongestIncreasingIndices(after)
			];
		} else stationaryIndices = computeLongestIncreasingIndices(survivingEntries);
		const stationarySet = new Set(stationaryIndices);
		const lastStationaryIdx = stationaryIndices.length > 0 ? stationaryIndices[stationaryIndices.length - 1] : -1;
		let nextRef = lastStationaryIdx !== -1 ? desiredRows[lastStationaryIdx].nextSibling : null;
		for (let j = desiredRows.length - 1; j >= 0; j -= 1) {
			const rowEl = desiredRows[j];
			if (!stationarySet.has(j)) listEl.insertBefore(rowEl, nextRef);
			nextRef = rowEl;
		}
		decorateListControls(listEl);
	}
	function hydrateSubtreeFromStore(root = document, preserveActive = false, seedMissingFromDom = true) {
		const db = ensureStore();
		ensureListBlueprints(root);
		orderInteractiveFirst(queryStandaloneBoundElements(root)).forEach((el) => {
			const key = getElementKey(el);
			if (!key) return;
			if (hasOwn(db.fields, key)) {
				if (preserveActive && isElementActive(el)) return;
				writeElementValue(el, getOwn(db.fields, key));
			} else if (seedMissingFromDom) {
				const val = readElementValue(el);
				if (val !== void 0) {
					setOwn(db.fields, key, val);
					propagateStandaloneKey(key, val, el);
				}
			} else if (!preserveActive || !isElementActive(el)) clearElementValue(el);
		});
		const preSeededInteractiveLists = /* @__PURE__ */ new Set();
		queryListElements(root).forEach((listEl) => {
			const listName = getAttr(listEl, "naizo-list");
			if (!listName) return;
			if (hasOwn(db.lists, listName) && Array.isArray(getOwn(db.lists, listName))) {
				const targetItems = getOwn(db.lists, listName);
				if (seedMissingFromDom && !preSeededInteractiveLists.has(listName)) {
					preSeededInteractiveLists.add(listName);
					seedInteractiveTemplateDefaultsForList(listName, targetItems);
				}
				const currentRows = Array.from(listEl.querySelectorAll(DIRECT_ITEM_SELECTOR));
				if (currentRows.length > 0 && (!seedMissingFromDom || currentRows.every((r) => itemDataMap.has(r)))) reconcileListItems(listEl, targetItems, preserveActive, seedMissingFromDom);
				else renderListItems(listEl, targetItems, seedMissingFromDom);
				syncNetVisibility(listEl);
			} else if (seedMissingFromDom) {
				const seededItems = [];
				listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).forEach((itemEl) => {
					const rowObj = {};
					bindItemElementToRecord(itemEl, rowObj, listName, true);
					seededItems.push(rowObj);
				});
				setOwn(db.lists, listName, seededItems);
				decorateListControls(listEl);
			} else renderListItems(listEl, [], false);
		});
	}
	function getCleanHtmlString(portable = isOnlineMode()) {
		flushPersistence(false);
		const clone = document.documentElement.cloneNode(true);
		const liveBound = Array.from(document.documentElement.querySelectorAll(BOUND_SELECTOR));
		const cloneBound = Array.from(clone.querySelectorAll(BOUND_SELECTOR));
		for (let i = 0; i < liveBound.length; i += 1) {
			const liveEl = liveBound[i];
			const cloneEl = cloneBound[i];
			if (liveEl && cloneEl && !isIgnoredElement(liveEl)) bakeClonedElementAttributes(liveEl, cloneEl);
		}
		restoreScopedRadioNames(clone);
		clone.querySelectorAll(LIST_SELECTOR).forEach((listEl) => {
			if (listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).length >= 1) listEl.querySelectorAll(AUTO_TEMPLATE_SELECTOR).forEach((tpl) => tpl.remove());
		});
		stripLoadingStateAttrs(clone);
		if (portable) {
			for (const modeHost of [clone, clone.querySelector("body")]) {
				if (!modeHost) continue;
				if ((modeHost.getAttribute("naizo-mode") ?? "").trim().toLowerCase() === "online") modeHost.removeAttribute("naizo-mode");
				if ((modeHost.getAttribute("data-naizo-mode") ?? "").trim().toLowerCase() === "online") modeHost.removeAttribute("data-naizo-mode");
			}
			clone.querySelectorAll("script[src]").forEach((scriptEl) => {
				const rawSrc = (scriptEl.getAttribute("src") ?? "").trim();
				if (!rawSrc || ABSOLUTE_OR_SCHEME_URL_RE.test(rawSrc)) return;
				if (RELATIVE_NAIZO_SCRIPT_RE.test(rawSrc)) scriptEl.setAttribute("src", CDN_NAIZO_MIN_JS_URL);
			});
		}
		clone.querySelectorAll(RUNTIME_STRIP_SELECTOR).forEach((el) => el.remove());
		return "<!DOCTYPE html>\n" + clone.outerHTML;
	}
	async function readFileTextPreservingBom(file) {
		if (typeof file.arrayBuffer === "function") try {
			const buf = await file.arrayBuffer();
			return new TextDecoder("utf-8", { ignoreBOM: true }).decode(buf);
		} catch {}
		if (typeof file.text === "function") return await file.text();
		return "";
	}
	function parseHtmlOpenTag(text, startIdx) {
		const len = text.length;
		let pos = startIdx + 1;
		while (pos < len) {
			const c = text.charCodeAt(pos);
			if (!(c >= 65 && c <= 90 || c >= 97 && c <= 122 || c >= 48 && c <= 57 || c === 45 || c === 58)) break;
			pos += 1;
		}
		if (pos === startIdx + 1) return null;
		const tagName = text.slice(startIdx + 1, pos).toLowerCase();
		const attrs = {};
		while (pos < len) {
			while (pos < len && /\s/.test(text[pos])) pos += 1;
			if (pos >= len) return null;
			const ch = text[pos];
			if (ch === ">") return {
				tagName,
				attrs,
				openStart: startIdx,
				openEnd: pos + 1
			};
			if (ch === "/") {
				pos += 1;
				continue;
			}
			const attrStart = pos;
			while (pos < len && !/[\s=/>"']/.test(text[pos])) pos += 1;
			if (pos === attrStart) {
				pos += 1;
				continue;
			}
			const attrName = text.slice(attrStart, pos).toLowerCase();
			while (pos < len && /\s/.test(text[pos])) pos += 1;
			let attrVal = "";
			if (pos < len && text[pos] === "=") {
				pos += 1;
				while (pos < len && /\s/.test(text[pos])) pos += 1;
				if (pos < len && (text[pos] === "\"" || text[pos] === "'")) {
					const quote = text[pos];
					pos += 1;
					const qEnd = text.indexOf(quote, pos);
					if (qEnd === -1) return null;
					attrVal = text.slice(pos, qEnd);
					pos = qEnd + 1;
				} else {
					const valStart = pos;
					while (pos < len && !/\s/.test(text[pos]) && text[pos] !== ">" && !(text[pos] === "/" && text[pos + 1] === ">")) pos += 1;
					attrVal = text.slice(valStart, pos);
				}
			}
			if (!hasOwn(attrs, attrName)) setOwn(attrs, attrName, attrVal);
		}
		return null;
	}
	function scanHtmlTags(bodyText, stopPred) {
		let i = 0;
		const len = bodyText.length;
		while (i < len) {
			const lt = bodyText.indexOf("<", i);
			if (lt === -1) break;
			i = lt;
			if (bodyText.startsWith("<!--", i)) {
				if (bodyText.startsWith("<!-->", i)) {
					i += 5;
					continue;
				}
				if (bodyText.startsWith("<!--->", i)) {
					i += 6;
					continue;
				}
				const endStd = bodyText.indexOf("-->", i + 4);
				const endBang = bodyText.indexOf("--!>", i + 4);
				if (endStd === -1 && endBang === -1) break;
				if (endBang !== -1 && (endStd === -1 || endBang < endStd)) i = endBang + 4;
				else i = endStd + 3;
				continue;
			}
			const nextCode = bodyText.charCodeAt(i + 1);
			if (!(nextCode >= 65 && nextCode <= 90 || nextCode >= 97 && nextCode <= 122)) {
				const nextCh = bodyText[i + 1];
				if (nextCh === "!" || nextCh === "?" || nextCh === "/") {
					const gt = bodyText.indexOf(">", i + 2);
					if (gt === -1) break;
					i = gt + 1;
				} else i += 1;
				continue;
			}
			const openTag = parseHtmlOpenTag(bodyText, i);
			if (!openTag) {
				i += 1;
				continue;
			}
			if (openTag.tagName === "script" || openTag.tagName === "style" || openTag.tagName === "title" || openTag.tagName === "textarea") {
				const closeRe = new RegExp(`</${openTag.tagName}(?=[>\\s/])[^>]*>`, "gi");
				closeRe.lastIndex = openTag.openEnd;
				const closeMatch = closeRe.exec(bodyText);
				if (!closeMatch) break;
				const fullTag = {
					...openTag,
					closeStart: closeMatch.index,
					closeEnd: closeMatch.index + closeMatch[0].length
				};
				if (stopPred(fullTag)) return fullTag;
				i = fullTag.closeEnd;
				continue;
			}
			const fullTag = {
				...openTag,
				closeStart: openTag.openEnd,
				closeEnd: openTag.openEnd
			};
			if (stopPred(fullTag)) return fullTag;
			i = openTag.openEnd;
		}
		return null;
	}
	function findDbScriptSpan(bodyText) {
		return scanHtmlTags(bodyText, (t) => t.tagName === "script" && getOwn(t.attrs, "id") === DB_ID);
	}
	function extractDbScriptBody(htmlText) {
		const bodyText = htmlText.startsWith("﻿") ? htmlText.slice(1) : htmlText;
		const span = findDbScriptSpan(bodyText);
		return span ? bodyText.slice(span.openEnd, span.closeStart).trim() : null;
	}
	function replaceDbScriptInHtml(fileText, formattedBlock) {
		const hasBom = fileText.startsWith("﻿");
		const bodyText = hasBom ? fileText.slice(1) : fileText;
		const span = findDbScriptSpan(bodyText);
		if (span) {
			const replaced = bodyText.slice(0, span.openEnd) + formattedBlock + bodyText.slice(span.closeStart);
			return {
				ok: true,
				html: (hasBom ? "﻿" : "") + replaced,
				missingBlock: false
			};
		}
		if (bodyText.trim() === "") return {
			ok: true,
			html: (hasBom ? "﻿" : "") + getCleanHtmlString(false),
			missingBlock: false
		};
		return {
			ok: false,
			html: fileText,
			missingBlock: true
		};
	}
	function injectDbScriptIntoHtml(fileText, formattedBlock) {
		const hasBom = fileText.startsWith("﻿");
		const bodyText = hasBom ? fileText.slice(1) : fileText;
		const scriptTag = `\n<script id="${DB_ID}" type="application/json">${formattedBlock}<\/script>`;
		const headSpan = scanHtmlTags(bodyText, (t) => t.tagName === "head");
		if (headSpan) {
			const injected = bodyText.slice(0, headSpan.openEnd) + scriptTag + bodyText.slice(headSpan.openEnd);
			return (hasBom ? "﻿" : "") + injected;
		}
		return (hasBom ? "﻿" : "") + `${scriptTag}\n${bodyText}`;
	}
	function extractScopeIdFromRawHtml(fileText, diskScriptRaw) {
		const bodyText = fileText.startsWith("﻿") ? fileText.slice(1) : fileText;
		let htmlId = "";
		let bodyId = "";
		scanHtmlTags(bodyText, (t) => {
			if (t.tagName === "html" && !htmlId) {
				const v = getOwn(t.attrs, "naizo-id") ?? getOwn(t.attrs, "data-naizo-id");
				if (v && v.trim()) htmlId = v.trim();
			} else if (t.tagName === "body") {
				const v = getOwn(t.attrs, "naizo-id") ?? getOwn(t.attrs, "data-naizo-id");
				if (v && v.trim()) bodyId = v.trim();
				return true;
			}
			return false;
		});
		if (htmlId) return htmlId;
		if (bodyId) return bodyId;
		if (diskScriptRaw.includes("\"id\"")) try {
			const parsed = JSON.parse(diskScriptRaw);
			if (typeof parsed?._meta?.id === "string" && parsed._meta.id.trim()) return parsed._meta.id.trim();
		} catch {}
		return "";
	}
	function mergeItemProperties(baseItem, browserItem, diskItem) {
		const out = {};
		let hasCollision = false;
		const allProps = /* @__PURE__ */ new Set([
			...Object.keys(diskItem),
			...Object.keys(browserItem),
			...Object.keys(baseItem)
		]);
		for (const prop of allProps) {
			const bHas = hasOwn(baseItem, prop);
			const brHas = hasOwn(browserItem, prop);
			const dkHas = hasOwn(diskItem, prop);
			const bSer = bHas ? canonicalJson(getOwn(baseItem, prop)) : void 0;
			const brSer = brHas ? canonicalJson(getOwn(browserItem, prop)) : void 0;
			const dkSer = dkHas ? canonicalJson(getOwn(diskItem, prop)) : void 0;
			if (brSer === dkSer) {
				if (dkHas) setOwn(out, prop, cloneJsonValue(getOwn(diskItem, prop)));
			} else if (brSer !== bSer && dkSer === bSer) {
				if (brHas) setOwn(out, prop, cloneJsonValue(getOwn(browserItem, prop)));
			} else if (brSer === bSer && dkSer !== bSer) {
				if (dkHas) setOwn(out, prop, cloneJsonValue(getOwn(diskItem, prop)));
			} else {
				hasCollision = true;
				if (dkHas) setOwn(out, prop, cloneJsonValue(getOwn(diskItem, prop)));
			}
		}
		return {
			item: out,
			hasCollision
		};
	}
	function weaveOrderedIds(primaryIds, secondaryIds, keptById) {
		const primaryKept = primaryIds.filter((id) => keptById.has(id));
		const primarySet = new Set(primaryKept);
		const beforeAnchor = /* @__PURE__ */ new Map();
		const tailIds = [];
		let nextAnchor = null;
		for (let i = secondaryIds.length - 1; i >= 0; i -= 1) {
			const id = secondaryIds[i];
			if (primarySet.has(id)) nextAnchor = id;
			else if (keptById.has(id)) {
				if (nextAnchor !== null) {
					const list = beforeAnchor.get(nextAnchor);
					if (list) list.push(id);
					else beforeAnchor.set(nextAnchor, [id]);
				} else tailIds.push(id);
			}
		}
		const out = [];
		for (const pId of primaryKept) {
			const pre = beforeAnchor.get(pId);
			if (pre) for (let i = pre.length - 1; i >= 0; i -= 1) out.push(keptById.get(pre[i]));
			out.push(keptById.get(pId));
		}
		for (let i = tailIds.length - 1; i >= 0; i -= 1) out.push(keptById.get(tailIds[i]));
		return out;
	}
	function mergeList3Way(baseEntry, baseItemsMem, browserList, diskList) {
		let baseItemHashes = null;
		let baseIds = null;
		if (baseItemsMem !== null) {
			baseItemHashes = baseItemsMem.map((it) => fnv1aHex8(canonicalJson(it)));
			baseIds = collectUniqueItemIds(baseItemsMem);
		} else if (baseEntry !== void 0 && typeof baseEntry !== "string") {
			baseItemHashes = baseEntry.i;
			baseIds = baseEntry.k ?? null;
		} else if (baseEntry === void 0) {
			baseItemHashes = [];
			baseIds = [];
		}
		const browserIds = collectUniqueItemIds(browserList);
		const diskIds = collectUniqueItemIds(diskList);
		if (baseIds !== null && browserIds !== null && diskIds !== null) {
			const baseHashById = /* @__PURE__ */ new Map();
			const baseObjById = /* @__PURE__ */ new Map();
			for (let i = 0; i < baseIds.length; i += 1) {
				const idKey = baseIds[i];
				if (baseItemHashes?.[i] !== void 0) baseHashById.set(idKey, baseItemHashes[i]);
				if (baseItemsMem?.[i]) baseObjById.set(idKey, baseItemsMem[i]);
			}
			const browserObjById = /* @__PURE__ */ new Map();
			const browserHashById = /* @__PURE__ */ new Map();
			for (let i = 0; i < browserIds.length; i += 1) {
				const idKey = browserIds[i];
				const item = browserList[i];
				browserObjById.set(idKey, item);
				browserHashById.set(idKey, fnv1aHex8(canonicalJson(item)));
			}
			const diskObjById = /* @__PURE__ */ new Map();
			const diskHashById = /* @__PURE__ */ new Map();
			for (let i = 0; i < diskIds.length; i += 1) {
				const idKey = diskIds[i];
				const item = diskList[i];
				diskObjById.set(idKey, item);
				diskHashById.set(idKey, fnv1aHex8(canonicalJson(item)));
			}
			const keptById = /* @__PURE__ */ new Map();
			let hasCollision = false;
			const allIds = /* @__PURE__ */ new Set([
				...baseIds,
				...browserIds,
				...diskIds
			]);
			for (const idKey of allIds) {
				const inBase = baseHashById.has(idKey);
				const inBr = browserObjById.has(idKey);
				const inDk = diskObjById.has(idKey);
				const bH = baseHashById.get(idKey);
				const brH = browserHashById.get(idKey);
				const dkH = diskHashById.get(idKey);
				if (inBase) {
					if (inBr && inDk) {
						if (brH === dkH) keptById.set(idKey, cloneRecord(diskObjById.get(idKey)));
						else if (brH !== bH && dkH === bH) keptById.set(idKey, cloneRecord(browserObjById.get(idKey)));
						else if (brH === bH && dkH !== bH) keptById.set(idKey, cloneRecord(diskObjById.get(idKey)));
						else {
							const baseObj = baseObjById.get(idKey);
							if (baseObj) {
								const propRes = mergeItemProperties(baseObj, browserObjById.get(idKey), diskObjById.get(idKey));
								if (propRes.hasCollision) hasCollision = true;
								keptById.set(idKey, propRes.item);
							} else {
								hasCollision = true;
								keptById.set(idKey, cloneRecord(diskObjById.get(idKey)));
							}
						}
					} else if (inBr && !inDk) {
						if (brH !== bH) hasCollision = true;
					} else if (!inBr && inDk) {
						if (dkH !== bH) {
							hasCollision = true;
							keptById.set(idKey, cloneRecord(diskObjById.get(idKey)));
						}
					}
				} else if (inBr && !inDk) keptById.set(idKey, cloneRecord(browserObjById.get(idKey)));
				else if (!inBr && inDk) keptById.set(idKey, cloneRecord(diskObjById.get(idKey)));
				else if (inBr && inDk) {
					if (brH !== dkH) hasCollision = true;
					keptById.set(idKey, cloneRecord(diskObjById.get(idKey)));
				}
			}
			const baseSet = new Set(baseIds);
			const brSet = new Set(browserIds);
			const dkSet = new Set(diskIds);
			const sameOrder = (a, b) => a.length === b.length && a.every((v, idx) => v === b[idx]);
			const baseShared = baseIds.filter((id) => brSet.has(id) && dkSet.has(id));
			const brShared = browserIds.filter((id) => dkSet.has(id));
			const dkShared = diskIds.filter((id) => brSet.has(id));
			if (!sameOrder(brShared, dkShared) && !sameOrder(brShared, baseShared) && !sameOrder(dkShared, baseShared)) hasCollision = true;
			const diskKeptBaseOrder = sameOrder(diskIds.filter((id) => baseSet.has(id)), baseIds.filter((id) => dkSet.has(id)));
			const browserReordered = !sameOrder(browserIds.filter((id) => baseSet.has(id)), baseIds.filter((id) => brSet.has(id)));
			const useBrowserOrder = diskKeptBaseOrder && browserReordered;
			const merged = weaveOrderedIds(useBrowserOrder ? browserIds : diskIds, useBrowserOrder ? diskIds : browserIds, keptById);
			return {
				merged,
				hasCollision,
				browserKept: canonicalJson(merged) !== canonicalJson(diskList)
			};
		}
		if (baseItemHashes !== null) {
			const baseLen = baseItemHashes.length;
			if (browserList.length >= baseLen && diskList.length >= baseLen) {
				const merged = [];
				let prefixClean = true;
				for (let i = 0; i < baseLen; i += 1) {
					const bH = baseItemHashes[i];
					const brH = fnv1aHex8(canonicalJson(browserList[i]));
					const dkH = fnv1aHex8(canonicalJson(diskList[i]));
					if (brH === dkH) merged.push(cloneRecord(diskList[i]));
					else if (brH !== bH && dkH === bH) merged.push(cloneRecord(browserList[i]));
					else if (brH === bH && dkH !== bH) merged.push(cloneRecord(diskList[i]));
					else {
						prefixClean = false;
						break;
					}
				}
				if (prefixClean) {
					for (let i = baseLen; i < diskList.length; i += 1) merged.push(cloneRecord(diskList[i]));
					for (let i = baseLen; i < browserList.length; i += 1) merged.push(cloneRecord(browserList[i]));
					return {
						merged,
						hasCollision: false,
						browserKept: canonicalJson(merged) !== canonicalJson(diskList)
					};
				}
			}
		}
		return {
			merged: diskList.map((it) => cloneRecord(it)),
			hasCollision: true,
			browserKept: false
		};
	}
	function shallowMergeDatabases(baseHashes, browserDb, diskDb, baseDb = null) {
		let hasCollision = false;
		let browserKeptKeys = false;
		const mergeBucket = (baseBucketHashes, browserBucket, diskBucket, isListsBucket) => {
			const out = {};
			const allKeys = /* @__PURE__ */ new Set([
				...baseBucketHashes ? Object.keys(baseBucketHashes) : [],
				...Object.keys(browserBucket),
				...Object.keys(diskBucket)
			]);
			for (const key of allKeys) {
				const baseEntry = baseBucketHashes && hasOwn(baseBucketHashes, key) ? getOwn(baseBucketHashes, key) : void 0;
				const baseHash = typeof baseEntry === "string" ? baseEntry : baseEntry?.h;
				const browserVal = hasOwn(browserBucket, key) ? getOwn(browserBucket, key) : void 0;
				const diskVal = hasOwn(diskBucket, key) ? getOwn(diskBucket, key) : void 0;
				const browserSer = browserVal !== void 0 ? canonicalJson(browserVal) : void 0;
				const diskSer = diskVal !== void 0 ? canonicalJson(diskVal) : void 0;
				if (browserSer === diskSer) {
					if (diskVal !== void 0) setOwn(out, key, cloneJsonValue(diskVal));
					continue;
				}
				if (baseHashes !== null) {
					const browserHash = browserSer !== void 0 ? fnv1aStringHash(browserSer) : void 0;
					const diskHash = diskSer !== void 0 ? fnv1aStringHash(diskSer) : void 0;
					const browserChanged = browserHash !== baseHash;
					const diskChanged = diskHash !== baseHash;
					if (browserChanged && !diskChanged) {
						browserKeptKeys = true;
						if (browserVal !== void 0) setOwn(out, key, cloneJsonValue(browserVal));
					} else if (!browserChanged && diskChanged) {
						if (diskVal !== void 0) setOwn(out, key, cloneJsonValue(diskVal));
					} else if (isListsBucket && Array.isArray(browserVal) && Array.isArray(diskVal)) {
						const listRes = mergeList3Way(baseEntry, baseDb !== null ? hasOwn(baseDb.lists, key) && Array.isArray(getOwn(baseDb.lists, key)) ? getOwn(baseDb.lists, key) : [] : null, browserVal, diskVal);
						if (listRes.hasCollision) hasCollision = true;
						if (listRes.browserKept) browserKeptKeys = true;
						setOwn(out, key, listRes.merged);
					} else {
						hasCollision = true;
						if (diskVal !== void 0) setOwn(out, key, cloneJsonValue(diskVal));
					}
				} else {
					hasCollision = true;
					if (diskVal !== void 0) setOwn(out, key, cloneJsonValue(diskVal));
				}
			}
			return out;
		};
		const mergedFields = mergeBucket(baseHashes?.fields ?? null, browserDb.fields, diskDb.fields, false);
		const mergedLists = mergeBucket(baseHashes?.lists ?? null, browserDb.lists, diskDb.lists, true);
		const mergedCustom = mergeBucket(baseHashes?.custom ?? null, browserDb.custom, diskDb.custom, false);
		return {
			merged: {
				_meta: cloneRecord(diskDb._meta),
				fields: mergedFields,
				lists: mergedLists,
				custom: mergedCustom
			},
			hasCollision,
			browserKeptKeys
		};
	}
	function applyExternalDiskUpdate(diskDb, diskRaw, preserveActive) {
		const currentBrowserDb = cloneDb(ensureStore());
		const { merged, hasCollision, browserKeptKeys } = shallowMergeDatabases(lastDiskDb ? buildDbKeyHashMap(lastDiskDb) : null, currentBrowserDb, diskDb, lastDiskDb);
		if (hasCollision) safeSetStorage(getBackupKey(), JSON.stringify(currentBrowserDb));
		store = merged;
		storeInitialized = true;
		lastSerializedContent = serializeContentBuckets(store);
		lastKnownDiskRaw = diskRaw.trim();
		lastDiskDb = cloneDb(diskDb);
		initialDiskDb = cloneDb(lastDiskDb);
		hydrateSubtreeFromStore(document, preserveActive, false);
		writeStoreToDomScript(store, false);
		safeSetStorage(getPageKey(), JSON.stringify(store));
		safeSetStorage(getSnapshotKey(), hashCanonicalDb(lastKnownDiskRaw));
		if (hasCollision) updateUi("conflict", "External Disk Edit · Conflict Backed Up");
		else if (fileHandle) updateUi(browserKeptKeys ? "cached" : "saved", browserKeptKeys ? "Browser Cache · Pending Sync" : "Synced to Disk");
		window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
		return {
			hasCollision,
			browserKeptKeys
		};
	}
	function enterLiveDiskInvalidJsonState(rawDiskScript, modifiedMs) {
		if (saveTimeout !== null) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		writeQueued = false;
		if (typeof modifiedMs === "number") lastObservedModified = modifiedMs;
		safeSetStorage(getRawBackupKey(), rawDiskScript);
		liveDiskInvalidJson = true;
		repairingDiskInvalidDb = false;
		if (isNoPillMode()) console.warn("[naizo.js] Linked disk file contains invalid #naizodb JSON; automatic disk writes are paused and raw text was backed up. Remove naizo-no-pill / data-naizo-no-pill to expose the Repair JSON control.");
		updateUi("error", "Invalid #naizodb JSON");
	}
	function restoreConflictBackup() {
		if (isInvalidDbState()) {
			const wasStartupInvalid = startupInvalidDb;
			startupInvalidDb = false;
			liveDiskInvalidJson = false;
			repairingDiskInvalidDb = true;
			hydrateSubtreeFromStore(document, false, wasStartupInvalid);
			if (fileHandle) {
				flushPersistence(false);
				if (fileHandlePermission === "granted") {
					if (watchInterval === null) startDiskWatch();
					updateUi("saving", "Saving...");
					writeToDisk();
				} else updateUi("needs-permission", "Resume Disk Sync");
			} else flushPersistence(true);
		} else {
			const backupDb = parseCachedState(safeGetStorage(getBackupKey()));
			if (!backupDb) return;
			safeRemoveStorage(getBackupKey());
			store = cloneDb(backupDb);
			storeInitialized = true;
			hydrateSubtreeFromStore(document, false, false);
			flushPersistence(true);
		}
		if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
		dispatchChangeEvent({
			scope: "restore",
			source: "api"
		});
	}
	async function checkDiskForExternalChanges() {
		lastExternalCheckHadConflict = false;
		const epoch = initEpoch;
		const handle = fileHandle;
		if (!handle || typeof handle.getFile !== "function" || startupInvalidDb) return false;
		if (writeInFlightPromise !== null) return false;
		try {
			const perm = await handle.queryPermission({ mode: "readwrite" });
			if (!isCurrentHandle(epoch, handle) || startupInvalidDb || perm !== "granted") return false;
			const diskFile = await handle.getFile();
			if (!isCurrentHandle(epoch, handle) || startupInvalidDb) return false;
			if (typeof diskFile.lastModified === "number" && lastObservedModified !== null && diskFile.lastModified === lastObservedModified) return false;
			const fileText = await readFileTextPreservingBom(diskFile);
			if (!isCurrentHandle(epoch, handle) || startupInvalidDb) return false;
			if (fileText.trim() === "") return false;
			if (typeof diskFile.lastModified === "number") lastObservedModified = diskFile.lastModified;
			const diskScriptRaw = extractDbScriptBody(fileText);
			if (diskScriptRaw === null) return false;
			const diskDetailed = parseDbScriptDetailed(diskScriptRaw);
			if (!diskDetailed.ok) {
				enterLiveDiskInvalidJsonState(diskScriptRaw, diskFile.lastModified);
				return false;
			}
			if (liveDiskInvalidJson) {
				liveDiskInvalidJson = false;
				repairingDiskInvalidDb = false;
			} else if (lastKnownDiskRaw !== null && normalizeJsonComparison(diskScriptRaw) === normalizeJsonComparison(lastKnownDiskRaw)) return false;
			const { hasCollision, browserKeptKeys } = applyExternalDiskUpdate(diskDetailed.db, diskScriptRaw, true);
			lastExternalCheckHadConflict = hasCollision;
			if (browserKeptKeys) scheduleDiskWrite();
			return true;
		} catch {
			return false;
		}
	}
	function startDiskWatch() {
		stopDiskWatch();
		if (!fileHandle || typeof fileHandle.getFile !== "function") return;
		watchInterval = setInterval(() => {
			if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
			checkDiskForExternalChanges();
		}, DISK_WATCH_INTERVAL_MS);
	}
	function stopDiskWatch() {
		if (watchInterval !== null) {
			clearInterval(watchInterval);
			watchInterval = null;
		}
	}
	async function performSingleDiskWrite(epoch) {
		const handle = fileHandle;
		if (!handle || !isCurrentEpoch(epoch) || isInvalidDbState()) {
			if (isCurrentEpoch(epoch)) pendingInitialLinkFile = null;
			return false;
		}
		const preReadLink = pendingInitialLinkFile;
		pendingInitialLinkFile = null;
		try {
			const perm = await handle.queryPermission({ mode: "readwrite" });
			if (!isCurrentHandle(epoch, handle)) return false;
			fileHandlePermission = perm;
			if (perm !== "granted") {
				updateUi("needs-permission", "Resume Disk Sync");
				return false;
			}
			const forceOverwrite = overwriteDiskWithoutMerge;
			overwriteDiskWithoutMerge = false;
			const isRepairWrite = repairingDiskInvalidDb;
			repairingDiskInvalidDb = false;
			const preConfirmedMissingBlock = confirmedMissingDbInject;
			confirmedMissingDbInject = false;
			if (persistTimeout !== null) flushPersistence(false);
			let fileTextToWrite;
			let payloadToWrite;
			let diskRawSnapshotForTracking = null;
			let preWriteHadCollision = false;
			let skipWritable = false;
			let preWriteModifiedMs;
			if (preReadLink !== null || typeof handle.getFile === "function") {
				const diskFile = preReadLink ? preReadLink.file : await handle.getFile();
				if (!isCurrentHandle(epoch, handle)) return false;
				preWriteModifiedMs = diskFile.lastModified;
				const existingFileText = preReadLink ? preReadLink.text : await readFileTextPreservingBom(diskFile);
				if (!isCurrentHandle(epoch, handle)) return false;
				const diskScriptRaw = extractDbScriptBody(existingFileText);
				let parsedExistingDiskDb = null;
				if (!forceOverwrite && diskScriptRaw !== null) {
					const diskDetailed = parseDbScriptDetailed(diskScriptRaw, isRepairWrite);
					if (!diskDetailed.ok) {
						if (!isRepairWrite) {
							enterLiveDiskInvalidJsonState(diskScriptRaw, diskFile.lastModified);
							return false;
						}
					} else {
						parsedExistingDiskDb = diskDetailed.db;
						if (lastKnownDiskRaw !== null && normalizeJsonComparison(diskScriptRaw) !== normalizeJsonComparison(lastKnownDiskRaw)) {
							const { hasCollision, browserKeptKeys } = applyExternalDiskUpdate(diskDetailed.db, diskScriptRaw, true);
							preWriteHadCollision = hasCollision;
							if (!browserKeptKeys) {
								if (typeof diskFile.lastModified === "number") lastObservedModified = diskFile.lastModified;
								return true;
							}
						}
					}
				}
				const currentStore = ensureStore();
				payloadToWrite = serializeDbJson(currentStore);
				if (!forceOverwrite && !isRepairWrite && diskScriptRaw !== null && (diskScriptRaw === payloadToWrite.trim() || parsedExistingDiskDb !== null && canonicalJson(parsedExistingDiskDb) === canonicalJson(currentStore))) {
					skipWritable = true;
					fileTextToWrite = existingFileText;
					diskRawSnapshotForTracking = diskScriptRaw;
				} else {
					const formattedBlock = "\n" + payloadToWrite + "\n";
					const replaced = replaceDbScriptInHtml(existingFileText, formattedBlock);
					if (replaced.missingBlock) {
						if (!(preConfirmedMissingBlock || (typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm("Selected file does not contain <script id=\"naizodb\">. Insert #naizodb into this file?") : false))) {
							console.warn("[naizo.js] Refusing to overwrite file without #naizodb block.");
							updateUi("error", "Target file lacks #naizodb");
							return false;
						}
						fileTextToWrite = injectDbScriptIntoHtml(existingFileText, formattedBlock);
					} else fileTextToWrite = replaced.html;
				}
			} else {
				payloadToWrite = serializeDbJson(ensureStore());
				fileTextToWrite = getCleanHtmlString(false);
			}
			if (!skipWritable) {
				const writable = await handle.createWritable();
				if (!isCurrentHandle(epoch, handle)) {
					try {
						await writable.abort?.();
					} catch {}
					return false;
				}
				await writable.write(fileTextToWrite);
				if (!isCurrentHandle(epoch, handle)) {
					try {
						await writable.abort?.();
					} catch {}
					return false;
				}
				await writable.close();
				if (!isCurrentHandle(epoch, handle)) return false;
			}
			const exactWrittenTrimmed = payloadToWrite.trim();
			const trackedDiskRaw = diskRawSnapshotForTracking ?? exactWrittenTrimmed;
			lastKnownDiskRaw = trackedDiskRaw;
			const writtenParsed = parseDbScriptDetailed(trackedDiskRaw);
			if (writtenParsed.ok) {
				lastDiskDb = cloneDb(writtenParsed.db);
				initialDiskDb = cloneDb(lastDiskDb);
			}
			safeSetStorage(getSnapshotKey(), hashCanonicalDb(trackedDiskRaw));
			if (skipWritable) {
				if (typeof preWriteModifiedMs === "number") lastObservedModified = preWriteModifiedMs;
			} else if (typeof handle.getFile === "function") try {
				const updatedFile = await handle.getFile();
				if (!isCurrentHandle(epoch, handle)) return false;
				if (typeof updatedFile.lastModified === "number") lastObservedModified = updatedFile.lastModified;
			} catch {
				if (!isCurrentHandle(epoch, handle)) return false;
			}
			if (serializeDbJson(ensureStore()).trim() !== exactWrittenTrimmed) {
				writeQueued = true;
				updateUi("cached", "Browser Cache · Pending Sync");
			} else if (preWriteHadCollision) updateUi("conflict", "External Disk Edit · Conflict Backed Up");
			else updateUi("saved", "Synced to Disk");
			return true;
		} catch (err) {
			if (!isCurrentHandle(epoch, handle)) return false;
			console.warn("[naizo.js] Disk write failed:", err);
			updateUi("cached", "Browser Cache · Click to Link Disk");
			return false;
		}
	}
	async function writeToDisk() {
		if (!fileHandle || isInvalidDbState()) return false;
		if (writeInFlightPromise !== null) {
			writeQueued = true;
			return writeInFlightPromise;
		}
		const writerEpoch = initEpoch;
		let runner = null;
		runner = (async () => {
			let lastResult = false;
			try {
				do {
					writeQueued = false;
					lastResult = await performSingleDiskWrite(writerEpoch);
				} while (isCurrentEpoch(writerEpoch) && writeQueued && fileHandle && !isInvalidDbState());
				return lastResult;
			} finally {
				if (writeInFlightPromise === runner) writeInFlightPromise = null;
			}
		})();
		writeInFlightPromise = runner;
		return runner;
	}
	function scheduleDiskWrite() {
		if (!fileHandle || isInvalidDbState()) return;
		if (fileHandlePermission !== "granted") {
			if (saveTimeout !== null) {
				clearTimeout(saveTimeout);
				saveTimeout = null;
			}
			updateUi("needs-permission", "Resume Disk Sync");
			return;
		}
		updateUi("saving", "Saving...");
		if (saveTimeout !== null) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			saveTimeout = null;
			writeToDisk();
		}, DISK_DEBOUNCE_MS);
	}
	function updateUnlinkedStatusUi(storedOk = true) {
		if (isOnlineMode()) updateUi(storedOk ? "saved" : "cached", storedOk ? "Saved in Browser" : "In-Memory Only");
		else updateUi("cached", storedOk ? "Browser Cache · Click to Link Disk" : "In-Memory Only · Link Disk");
	}
	function flushPersistence(scheduleDisk = true) {
		const hadPendingPersist = persistTimeout !== null;
		if (hadPendingPersist) {
			clearTimeout(persistTimeout);
			persistTimeout = null;
		}
		if (startupInvalidDb) {
			updateUi("error", "Invalid #naizodb JSON");
			return false;
		}
		const db = ensureStore();
		writeStoreToDomScript(db, true);
		const storedOk = safeSetStorage(getPageKey(), JSON.stringify(db));
		if (liveDiskInvalidJson) {
			updateUi("error", "Invalid #naizodb JSON");
			return storedOk;
		}
		if (!fileHandle) {
			const isShowingConflict = Boolean(dotBtnEl?.classList.contains("conflict")) || statusEl?.textContent === "External Disk Edit · Conflict Backed Up";
			if (scheduleDisk || hadPendingPersist || batchDepth > 0 && batchDirty || !isShowingConflict) updateUnlinkedStatusUi(storedOk);
			return storedOk;
		}
		if (scheduleDisk) scheduleDiskWrite();
		return storedOk;
	}
	function persistStoreMutation() {
		if (batchDepth > 0) {
			batchDirty = true;
			if (batchDeferDepth === 0) batchDeferPersist = false;
			return;
		}
		flushPersistence(true);
	}
	function schedulePersist() {
		if (startupInvalidDb) return;
		if (batchDepth > 0) {
			batchDirty = true;
			return;
		}
		if (persistTimeout !== null) clearTimeout(persistTimeout);
		persistTimeout = setTimeout(() => {
			persistTimeout = null;
			flushPersistence(true);
		}, PERSIST_DEBOUNCE_MS);
	}
	function safeDecodeUriComponent(raw) {
		try {
			return decodeURIComponent(raw);
		} catch {
			return raw;
		}
	}
	function getSuggestedFilename() {
		return safeDecodeUriComponent(typeof location !== "undefined" && location.pathname ? location.pathname.split("/").pop() || "" : "").trim() || "index.html";
	}
	function normalizeRootForShellCompare(root) {
		root.querySelectorAll(RUNTIME_STRIP_SELECTOR).forEach((el) => el.remove());
		root.querySelectorAll(`#${DB_ID}`).forEach((el) => el.remove());
		if (typeof document !== "undefined" && typeof NodeFilter !== "undefined") {
			const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
			const comments = [];
			let cur = walker.nextNode();
			while (cur) {
				comments.push(cur);
				cur = walker.nextNode();
			}
			comments.forEach((c) => c.remove());
		}
		for (const host of [root, root.querySelector("body")]) {
			if (!host) continue;
			host.removeAttribute("data-theme");
			host.removeAttribute("data-naizo-manual");
			host.removeAttribute("naizo-manual");
			host.classList.remove("dark", "light");
			if (host.classList.length === 0) host.removeAttribute("class");
		}
		stripLoadingStateAttrs(root);
		restoreScopedRadioNames(root);
		root.querySelectorAll(LIST_SELECTOR).forEach((listEl) => {
			if (listEl.closest(`[naizo-ignore], [data-naizo-ignore], template`)) return;
			const tpl = listEl.querySelector(":scope > template");
			const bpSource = tpl?.content.querySelector(ITEM_SELECTOR) ?? tpl?.content.firstElementChild ?? listEl.querySelector(DIRECT_ITEM_SELECTOR);
			listEl.querySelectorAll(":scope > template").forEach((n) => n.remove());
			listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).forEach((n) => n.remove());
			if (bpSource) {
				const bpClone = bpSource.cloneNode(true);
				bpClone.querySelectorAll(RUNTIME_STRIP_SELECTOR).forEach((n) => n.remove());
				restoreScopedRadioNames(bpClone);
				bpClone.querySelectorAll("[naizo-ignore], [data-naizo-ignore]").forEach((ig) => {
					ig.innerHTML = "";
				});
				if (bpClone.matches(BOUND_SELECTOR)) clearElementValue(bpClone);
				bpClone.querySelectorAll(BOUND_SELECTOR).forEach((el) => clearElementValue(el));
				const normTpl = document.createElement("template");
				normTpl.content.appendChild(bpClone);
				listEl.prepend(normTpl);
			}
		});
		root.querySelectorAll("[naizo-ignore], [data-naizo-ignore]").forEach((ig) => {
			ig.innerHTML = "";
		});
		root.querySelectorAll(BOUND_SELECTOR).forEach((el) => {
			if (!el.closest("template")) clearElementValue(el);
		});
		return root.outerHTML.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
	}
	function doesRawHtmlShellDifferFromOpenPage(rawFileText) {
		if (typeof DOMParser === "undefined" || typeof document === "undefined") return false;
		try {
			const cleanRaw = rawFileText.startsWith("﻿") ? rawFileText.slice(1) : rawFileText;
			const diskDoc = new DOMParser().parseFromString(cleanRaw, "text/html");
			return normalizeRootForShellCompare(document.documentElement.cloneNode(true)) !== normalizeRootForShellCompare(diskDoc.documentElement);
		} catch {
			return false;
		}
	}
	async function connectOrResumeDisk() {
		if (isInvalidDbState()) return false;
		const epoch = initEpoch;
		if (persistTimeout !== null) flushPersistence(false);
		if (saveTimeout !== null) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		if (fileHandle) {
			const handle = fileHandle;
			try {
				const perm = await handle.requestPermission({ mode: "readwrite" });
				if (!isCurrentHandle(epoch, handle)) return false;
				fileHandlePermission = perm;
				if (perm === "granted") {
					startDiskWatch();
					return await writeToDisk();
				}
				updateUi("needs-permission", "Resume Disk Sync");
				return false;
			} catch {
				if (!isCurrentHandle(epoch, handle)) return false;
				fileHandlePermission = "prompt";
				updateUi("needs-permission", "Resume Disk Sync");
				return false;
			}
		}
		if (typeof window.showSaveFilePicker === "function") try {
			const suggestedName = getSuggestedFilename();
			const pickedHandle = await window.showSaveFilePicker({
				suggestedName,
				types: [{
					description: "HTML Document",
					accept: { "text/html": [".html"] }
				}]
			});
			if (!isCurrentEpoch(epoch) || isInvalidDbState()) return false;
			let confirmedWrongFileOverwrite = false;
			let confirmedMissingBlock = false;
			let preReadLink = null;
			if (typeof pickedHandle.getFile === "function") {
				const diskFile = await pickedHandle.getFile();
				if (!isCurrentEpoch(epoch) || isInvalidDbState()) return false;
				const existingFileText = await readFileTextPreservingBom(diskFile);
				if (!isCurrentEpoch(epoch) || isInvalidDbState()) return false;
				preReadLink = {
					file: diskFile,
					text: existingFileText
				};
				if (existingFileText.trim() !== "") {
					const diskScriptRaw = extractDbScriptBody(existingFileText);
					if (diskScriptRaw === null) {
						if (!(typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm("Selected file does not contain <script id=\"naizodb\">. Insert #naizodb into this file?") : false)) {
							console.warn("[naizo.js] Refusing to overwrite file without #naizodb block.");
							updateUi("error", "Target file lacks #naizodb");
							return false;
						}
						confirmedMissingBlock = true;
					} else {
						const pageScopeId = getDocumentScopeId();
						const diskScopeId = extractScopeIdFromRawHtml(existingFileText, diskScriptRaw);
						const scopeIdsConflict = Boolean(pageScopeId && diskScopeId && pageScopeId !== diskScopeId);
						const scopeIdsMatch = Boolean(pageScopeId && diskScopeId && pageScopeId === diskScopeId);
						const pickedName = typeof pickedHandle.name === "string" ? pickedHandle.name.trim() : "";
						const handleNameDiffers = pickedName.length > 0 && pickedName !== suggestedName;
						if (scopeIdsConflict || !scopeIdsMatch && handleNameDiffers && doesRawHtmlShellDifferFromOpenPage(existingFileText)) {
							if (!(typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm("Selected file appears to belong to a different Naizo document and already contains #naizodb data. Overwrite its #naizodb state with this page?") : false)) return false;
							confirmedWrongFileOverwrite = true;
						}
					}
				}
			}
			overwriteDiskWithoutMerge = confirmedWrongFileOverwrite;
			confirmedMissingDbInject = confirmedMissingBlock;
			pendingInitialLinkFile = preReadLink;
			fileHandle = pickedHandle;
			fileHandlePermission = "granted";
			saveHandleToIDB(fileHandle);
			startDiskWatch();
			return await writeToDisk();
		} catch {
			return false;
		}
		Naizo.downloadHTML();
		return false;
	}
	function resetChangeDispatchState() {
		isDispatchingChange = false;
		pendingChangeQueue = [];
	}
	function dispatchChangeEvent(detail) {
		if (typeof window === "undefined") return;
		if (batchDepth > 0) {
			batchDirty = true;
			if (batchSilentDepth === 0) batchAllSilent = false;
			return;
		}
		const payload = {
			...detail,
			db: store
		};
		if (isDispatchingChange) {
			pendingChangeQueue.push(payload);
			return;
		}
		isDispatchingChange = true;
		try {
			window.dispatchEvent(new CustomEvent("naizo:change", { detail: payload }));
			let passes = 0;
			while (isDispatchingChange && pendingChangeQueue.length > 0) {
				if (passes >= MAX_REENTRANT_CHANGE_PASSES) {
					console.warn(`[naizo.js] Exceeded ${MAX_REENTRANT_CHANGE_PASSES} re-entrant naizo:change passes; dropping queued events.`);
					pendingChangeQueue = [];
					break;
				}
				passes += 1;
				const currentWave = pendingChangeQueue;
				pendingChangeQueue = [];
				for (let i = 0; i < currentWave.length; i += 1) {
					if (!isDispatchingChange) break;
					const nextPayload = currentWave[i];
					if (nextPayload) {
						nextPayload.db = store;
						window.dispatchEvent(new CustomEvent("naizo:change", { detail: nextPayload }));
					}
				}
			}
		} finally {
			resetChangeDispatchState();
		}
	}
	function dispatchItemEvent(listName, itemEl, rowObj, index) {
		if (typeof window === "undefined") return;
		window.dispatchEvent(new CustomEvent("naizo:item", { detail: {
			list: listName,
			item: itemEl,
			data: rowObj,
			index
		} }));
	}
	function dispatchFetchEvent(result) {
		if (typeof window === "undefined") return;
		window.dispatchEvent(new CustomEvent("naizo:fetch", { detail: result }));
	}
	function applyNetUiState() {
		if (!netBtn || !netSepEl) return;
		netSepEl.style.display = netRevealed ? "inline-block" : "none";
		netBtn.style.display = netRevealed ? "inline-flex" : "none";
		if (netState === "active") {
			netBtn.className = "net-slot active";
			setPillElementTitle(netBtn, "API active");
			netBtn.dataset.tip = "API Active";
		} else if (netState === "error") {
			netBtn.className = "net-slot error";
			setPillElementTitle(netBtn, "API request failed");
			netBtn.dataset.tip = "API Request Failed · Click to Clear";
		} else {
			netBtn.className = "net-slot idle";
			setPillElementTitle(netBtn, "API idle");
			netBtn.dataset.tip = "API Idle";
		}
		refreshActivePillTooltip();
	}
	function revealNetIndicator() {
		if (!netRevealed) {
			netRevealed = true;
			applyNetUiState();
		}
	}
	function syncNetVisibility(root = document) {
		if (netRevealed) return;
		if (root instanceof Element && root.matches(API_REQUEST_SELECTOR) && !isIgnoredElement(root)) {
			revealNetIndicator();
			return;
		}
		const candidates = root.querySelectorAll(API_REQUEST_SELECTOR);
		for (const el of candidates) if (!isIgnoredElement(el)) {
			revealNetIndicator();
			return;
		}
	}
	function beginNetRequest() {
		revealNetIndicator();
		if (netHoldTimeout !== null) {
			clearTimeout(netHoldTimeout);
			netHoldTimeout = null;
		}
		if (netInFlightCount === 0) netActiveStartMs = Date.now();
		netInFlightCount += 1;
		netState = netPendingError ? "error" : "active";
		applyNetUiState();
	}
	function endNetRequest(ok) {
		netInFlightCount = Math.max(0, netInFlightCount - 1);
		if (!ok) {
			netPendingError = true;
			if (netHoldTimeout !== null) {
				clearTimeout(netHoldTimeout);
				netHoldTimeout = null;
			}
			netState = "error";
			applyNetUiState();
			return;
		}
		if (netPendingError) {
			if (netHoldTimeout !== null) {
				clearTimeout(netHoldTimeout);
				netHoldTimeout = null;
			}
			netState = "error";
			applyNetUiState();
			return;
		}
		if (netInFlightCount > 0) return;
		const elapsed = Date.now() - netActiveStartMs;
		const remaining = NET_ACTIVE_HOLD_MS - elapsed;
		if (remaining > 0) {
			netState = "active";
			applyNetUiState();
			if (netHoldTimeout !== null) clearTimeout(netHoldTimeout);
			netHoldTimeout = setTimeout(() => {
				netHoldTimeout = null;
				if (netInFlightCount === 0 && !netPendingError && netState === "active") {
					netState = "idle";
					applyNetUiState();
				}
			}, remaining);
			return;
		}
		netState = "idle";
		applyNetUiState();
	}
	const PILL_ICONS = {
		link: "<path d=\"M9 17H7A5 5 0 0 1 7 7h2\"/><path d=\"M15 7h2a5 5 0 1 1 0 10h-2\"/><line x1=\"8\" y1=\"12\" x2=\"16\" y2=\"12\"/>",
		unlink: "<path d=\"M9 17H7A5 5 0 0 1 7 7\"/><path d=\"M15 7h2a5 5 0 0 1 4 8\"/><line x1=\"8\" y1=\"12\" x2=\"12\" y2=\"12\"/><line x1=\"3\" y1=\"3\" x2=\"21\" y2=\"21\"/>",
		download: "<path d=\"M21 15v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"4\"/>",
		copy: "<rect x=\"8\" y=\"8\" width=\"13\" height=\"13\" rx=\"2.5\"/><path d=\"M5 16H4.5A1.5 1.5 0 0 1 3 14.5v-10A1.5 1.5 0 0 1 4.5 3h10A1.5 1.5 0 0 1 16 4.5V5\"/>",
		check: "<polyline points=\"20 6.5 9.5 17 4 11.5\"/>",
		restore: "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5\"/><path d=\"M12 7v5l3.5 2\"/>",
		wrench: "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\"/>",
		eraser: "<path d=\"m7 20-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 20\"/><path d=\"M21 20H7\"/><path d=\"m5 11 9 9\"/>"
	};
	const NET_GLOBE_WIRES = "<path d=\"M 3.6 8.2 Q 12 9.7 20.4 8.2\"/><path d=\"M 3.6 15.8 Q 12 14.3 20.4 15.8\"/><ellipse cx=\"12\" cy=\"12\" rx=\"4.6\" ry=\"9.5\"/><circle cx=\"12\" cy=\"12\" r=\"9.5\"/>";
	function getSaveShortcutKbd() {
		if (typeof navigator === "undefined") return "⌘S";
		const platformStr = `${navigator.userAgentData?.platform ?? ""} ${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`;
		return /mac|darwin|iphone|ipad|ipod/i.test(platformStr) ? "⌘S" : "Ctrl+S";
	}
	function nowHighResMs() {
		return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
	}
	function resolveExplicitPageTheme() {
		if (typeof document === "undefined") return null;
		for (const el of [document.documentElement, document.body]) {
			if (!el) continue;
			const attr = (el.getAttribute("data-theme") ?? "").trim().toLowerCase();
			if (attr === "dark" || attr === "light") return attr;
			if (el.classList?.contains("dark")) return "dark";
			if (el.classList?.contains("light")) return "light";
		}
		return null;
	}
	function matchesMediaQuery(query) {
		try {
			return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
		} catch {
			return false;
		}
	}
	function syncHostTheme(host) {
		if (!host) return;
		const effective = resolveExplicitPageTheme() ?? (matchesMediaQuery("(prefers-color-scheme: dark)") ? "dark" : null);
		const current = host.getAttribute("data-naizo-theme");
		if (effective === null) {
			if (current !== null) host.removeAttribute("data-naizo-theme");
		} else if (current !== effective) host.setAttribute("data-naizo-theme", effective);
	}
	function clearSavingHold() {
		if (savingHoldTimeout !== null) {
			clearTimeout(savingHoldTimeout);
			savingHoldTimeout = null;
		}
	}
	function syncSavingBeat(state) {
		if (!dotBtnEl) {
			clearSavingHold();
			savingCycleStart = 0;
			savingMinCycles = 1;
			return;
		}
		if (state === "saving") {
			clearSavingHold();
			if (savingCycleStart === 0) {
				savingCycleStart = nowHighResMs();
				savingMinCycles = 1;
			} else {
				const elapsed = Math.max(0, nowHighResMs() - savingCycleStart);
				savingMinCycles = Math.max(1, Math.ceil((elapsed + 450) / SAVING_CYCLE_MS));
			}
			dotBtnEl.dataset.naizoSaving = "1";
			return;
		}
		if ((state === "saved" || state === "") && savingCycleStart > 0) {
			clearSavingHold();
			const elapsed = Math.max(0, nowHighResMs() - savingCycleStart);
			const targetCycles = Math.max(savingMinCycles, Math.floor(elapsed / SAVING_CYCLE_MS) + 1);
			const remainingMs = Math.max(16, Math.round(targetCycles * SAVING_CYCLE_MS - elapsed));
			savingHoldTimeout = setTimeout(() => {
				savingHoldTimeout = null;
				savingCycleStart = 0;
				savingMinCycles = 1;
				if (dotBtnEl) delete dotBtnEl.dataset.naizoSaving;
			}, remainingMs);
			return;
		}
		clearSavingHold();
		savingCycleStart = 0;
		savingMinCycles = 1;
		delete dotBtnEl.dataset.naizoSaving;
	}
	function stashElementTitle(el) {
		if (el.dataset.savedTitle === void 0 && el.hasAttribute("title")) {
			el.dataset.savedTitle = el.getAttribute("title") ?? "";
			el.removeAttribute("title");
		}
	}
	function restoreElementTitle(el) {
		if (el.dataset.savedTitle !== void 0) {
			el.setAttribute("title", el.dataset.savedTitle);
			delete el.dataset.savedTitle;
		}
	}
	function setPillElementTitle(el, nextTitle) {
		if (!el) return;
		if (el.dataset.savedTitle !== void 0) el.dataset.savedTitle = nextTitle;
		else el.title = nextTitle;
	}
	function clearPillTooltipTimersAndTitles() {
		if (transientTipTimeout !== null) {
			clearTimeout(transientTipTimeout);
			transientTipTimeout = null;
		}
		if (dragClickResetTimeout !== null) {
			clearTimeout(dragClickResetTimeout);
			dragClickResetTimeout = null;
		}
		pillTipTargets.forEach((btn) => {
			restoreElementTitle(btn);
		});
		activeTipBtn = null;
	}
	function showPillTooltip(text, kbd = "") {
		if (!tooltipEl || !tooltipTextEl || !tooltipKbdEl) return;
		if (!text || resetConfirmEl && resetConfirmEl.style.display !== "none") {
			tooltipEl.classList.remove("visible");
			return;
		}
		tooltipTextEl.textContent = text;
		if (kbd) {
			tooltipKbdEl.textContent = kbd;
			tooltipKbdEl.style.display = "inline-block";
		} else {
			tooltipKbdEl.textContent = "";
			tooltipKbdEl.style.display = "none";
		}
		tooltipEl.classList.add("visible");
	}
	function hidePillTooltip(clearTransient = false) {
		if (clearTransient && transientTipTimeout !== null) {
			clearTimeout(transientTipTimeout);
			transientTipTimeout = null;
		}
		tooltipEl?.classList.remove("visible");
	}
	function refreshActivePillTooltip() {
		if (!activeTipBtn) return;
		if (!activeTipBtn.isConnected || activeTipBtn.style.display === "none" || resetConfirmEl && resetConfirmEl.style.display !== "none") {
			restoreElementTitle(activeTipBtn);
			activeTipBtn = null;
			if (transientTipTimeout === null) hidePillTooltip();
			return;
		}
		if (transientTipTimeout !== null) return;
		showPillTooltip(activeTipBtn.dataset.tip ?? "", activeTipBtn.dataset.kbd ?? "");
	}
	function flashPillTooltip(text, durationMs = 1200) {
		if (transientTipTimeout !== null) {
			clearTimeout(transientTipTimeout);
			transientTipTimeout = null;
		}
		if (!tooltipEl || resetConfirmEl && resetConfirmEl.style.display !== "none") return;
		showPillTooltip(text, "");
		transientTipTimeout = setTimeout(() => {
			transientTipTimeout = null;
			if (activeTipBtn) refreshActivePillTooltip();
			else hidePillTooltip();
		}, durationMs);
	}
	function teardownUiTimersAndObservers() {
		if (themeObserver !== null) {
			themeObserver.disconnect();
			themeObserver = null;
		}
		if (themeMediaCleanup !== null) {
			themeMediaCleanup();
			themeMediaCleanup = null;
		}
		clearPillTooltipTimersAndTitles();
		if (bootClearTimeout !== null) {
			clearTimeout(bootClearTimeout);
			bootClearTimeout = null;
		}
		if (copyResetTimeout !== null) {
			clearTimeout(copyResetTimeout);
			copyResetTimeout = null;
		}
		if (savingHoldTimeout !== null) {
			clearTimeout(savingHoldTimeout);
			savingHoldTimeout = null;
		}
		savingCycleStart = 0;
		savingMinCycles = 1;
	}
	function resetUiRefs() {
		uiHost = null;
		statusEl = null;
		dotBtnEl = null;
		actionBtn = null;
		actionSrEl = null;
		actionSvgEl = null;
		restoreBtn = null;
		restoreSrEl = null;
		restoreSvgEl = null;
		copySrEl = null;
		copySvgEl = null;
		resetBtn = null;
		resetConfirmEl = null;
		unlinkBtn = null;
		netSepEl = null;
		netBtn = null;
		tooltipEl = null;
		tooltipTextEl = null;
		tooltipKbdEl = null;
		activeTipBtn = null;
		pillTipTargets = [];
	}
	function mountUi() {
		if (!document.getElementById(STYLE_ID)) {
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.setAttribute("data-naizo-strip", "true");
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
      @media print {
        [naizo-strip], [data-naizo-strip], #__naizodb_host__, .naizo-item-tools, .naizo-list-footer {
          display: none !important;
        }
      }
    `;
			document.head.appendChild(style);
		}
		teardownUiTimersAndObservers();
		document.querySelectorAll(`#${UI_ID}`).forEach((el) => el.remove());
		resetUiRefs();
		if (isNoPillMode()) return;
		const host = document.createElement("div");
		uiHost = host;
		host.id = UI_ID;
		host.setAttribute("data-naizo-strip", "true");
		syncHostTheme(host);
		const shadow = host.attachShadow({ mode: "open" });
		const initialCorner = readSavedUiCorner();
		const saveKbd = getSaveShortcutKbd();
		shadow.innerHTML = `
    <style>
      :host {
        --pill-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.56) 0%, rgba(255, 255, 255, 0.36) 100%);
        --pill-text: #0f172a;
        --pill-muted: #64748b;
        --pill-border: transparent;
        --pill-shadow: 0 0 0 1px rgba(15, 23, 42, 0.07), 0 4px 14px rgba(15, 23, 42, 0.09);
        --btn-bg: rgba(15, 23, 42, 0.055);
        --btn-bg-hover: rgba(15, 23, 42, 0.12);
        --btn-border: rgba(15, 23, 42, 0.11);
        --btn-color: #334155;
        --btn-color-hover: #0f172a;
        --sep-color: rgba(15, 23, 42, 0.11);
        --drop-bg: rgba(255, 255, 255, 0.42);
        --drop-border: rgba(15, 23, 42, 0.2);
        --drop-active-bg: rgba(255, 255, 255, 0.72);
        --drop-active-border: rgba(15, 23, 42, 0.38);
        --drop-active-shadow: 0 4px 14px rgba(15, 23, 42, 0.09);
        --restore-color: #d97706;
      }
      :host([data-naizo-theme="dark"]) {
        --pill-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.13) 0%, rgba(15, 23, 42, 0.44) 100%);
        --pill-text: #f8fafc;
        --pill-muted: #94a3b8;
        --pill-border: transparent;
        --pill-shadow: 0 0 0 1px rgba(255, 255, 255, 0.09), 0 6px 18px rgba(0, 0, 0, 0.42);
        --btn-bg: rgba(255, 255, 255, 0.08);
        --btn-bg-hover: rgba(255, 255, 255, 0.18);
        --btn-border: rgba(255, 255, 255, 0.14);
        --btn-color: #e2e8f0;
        --btn-color-hover: #ffffff;
        --sep-color: rgba(255, 255, 255, 0.15);
        --drop-bg: rgba(255, 255, 255, 0.07);
        --drop-border: rgba(255, 255, 255, 0.24);
        --drop-active-bg: rgba(255, 255, 255, 0.16);
        --drop-active-border: rgba(255, 255, 255, 0.52);
        --drop-active-shadow: 0 0 16px rgba(255, 255, 255, 0.1);
        --restore-color: #fbbf24;
      }
      .pill-drop-zone {
        position: fixed; z-index: 2147483646;
        width: 146px; height: 30px; border-radius: 999px;
        background: var(--drop-bg); border: 1.5px dashed var(--drop-border);
        backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
        pointer-events: none; opacity: 0; transform: scale(0.96);
        transition: opacity 0.16s ease, transform 0.16s ease, background-color 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;
      }
      .pill-drop-zone[data-corner="bottom-right"] { bottom: 16px; right: 16px; }
      .pill-drop-zone[data-corner="bottom-left"] { bottom: 16px; left: 16px; }
      .pill-drop-zone[data-corner="top-right"] { top: 16px; right: 16px; }
      .pill-drop-zone[data-corner="top-left"] { top: 16px; left: 16px; }
      :host([data-naizo-dragging="1"]) .pill-drop-zone {
        opacity: 1; transform: scale(1);
      }
      :host([data-naizo-dragging="1"]) .pill-drop-zone.active-target {
        background: var(--drop-active-bg); border: 1.5px solid var(--drop-active-border);
        box-shadow: var(--drop-active-shadow); transform: scale(1.03);
      }
      .pill-anchor {
        position: fixed; z-index: 2147483647; pointer-events: none;
        display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
        font: 500 12px/1.2 system-ui, -apple-system, sans-serif;
        transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .pill-anchor.is-dragging {
        transition: none; cursor: grabbing;
      }
      .pill-anchor.is-dragging .pill-tooltip {
        opacity: 0 !important;
      }
      .pill-anchor[data-corner="bottom-right"] { bottom: 16px; right: 16px; align-items: flex-end; }
      .pill-anchor[data-corner="bottom-left"] { bottom: 16px; left: 16px; align-items: flex-start; }
      .pill-anchor[data-corner="top-right"] { top: 16px; right: 16px; align-items: flex-end; flex-direction: column-reverse; }
      .pill-anchor[data-corner="top-left"] { top: 16px; left: 16px; align-items: flex-start; flex-direction: column-reverse; }
      .pill {
        pointer-events: auto; touch-action: none;
        display: inline-flex; align-items: center; gap: 5px;
        padding: 4px 6px; border-radius: 999px;
        background: var(--pill-bg); color: var(--pill-text);
        border: 1px solid var(--pill-border); box-shadow: var(--pill-shadow);
        backdrop-filter: blur(12px) saturate(180%); -webkit-backdrop-filter: blur(12px) saturate(180%);
        user-select: none;
      }
      .sr-only {
        position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
        overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
      }
      .dot {
        width: 20px; height: 20px; padding: 0; border: none; background: transparent;
        display: inline-flex; align-items: center; justify-content: center;
        cursor: grab; touch-action: none; color: #f59e0b; border-radius: 50%; flex-shrink: 0;
        transition: color 0.2s ease, transform 0.15s ease;
      }
      .dot:active { cursor: grabbing; }
      .dot:focus-visible,
      .icon-btn:focus-visible,
      button.net-slot:focus-visible,
      .confirm-pop button:focus-visible {
        outline: 2px solid #10b981;
        outline-offset: 2px;
      }
      .dot.saved,
      .dot.saving,
      .dot[data-naizo-saving="1"] {
        color: #10b981;
      }
      .dot.conflict,
      .dot.needs-permission {
        color: #f59e0b;
      }
      .dot.error {
        color: #ef4444;
      }
      .naizo-logo-svg {
        width: 21.5px; height: 21.5px; overflow: visible; display: block; flex-shrink: 0;
      }
      .naizo-logo-svg .ring,
      .naizo-logo-svg .c-top,
      .naizo-logo-svg .c-bl,
      .naizo-logo-svg .c-br {
        transform-box: fill-box;
        transform-origin: center;
      }
      @keyframes naizoBootRing {
        0% { stroke-dasharray: 263.89; stroke-dashoffset: 263.89; transform: scale(0.92); opacity: 0.3; }
        65% { stroke-dasharray: 263.89; stroke-dashoffset: 0; transform: scale(1.03); opacity: 1; }
        100% { stroke-dasharray: 263.89; stroke-dashoffset: 0; transform: scale(1); opacity: 1; }
      }
      @keyframes naizoBootTop {
        0%, 15% { transform: translate(0px, 13px) scale(0); opacity: 0; }
        70% { transform: translate(0px, -1.5px) scale(1.05); opacity: 1; }
        100% { transform: translate(0px, 0px) scale(1); opacity: 1; }
      }
      @keyframes naizoBootBL {
        0%, 26% { transform: translate(13px, -13px) scale(0); opacity: 0; }
        78% { transform: translate(-1.2px, 1.2px) scale(1.05); opacity: 1; }
        100% { transform: translate(0px, 0px) scale(1); opacity: 1; }
      }
      @keyframes naizoBootBR {
        0%, 37% { transform: translate(-13px, -13px) scale(0); opacity: 0; }
        86% { transform: translate(1.2px, 1.2px) scale(1.05); opacity: 1; }
        100% { transform: translate(0px, 0px) scale(1); opacity: 1; }
      }
      .dot[data-naizo-boot="1"]:not(.saving):not([data-naizo-saving="1"]):not(.conflict):not(.needs-permission):not(.error) .ring {
        animation: naizoBootRing 1.2s cubic-bezier(0.22, 1, 0.36, 1) 1;
      }
      .dot[data-naizo-boot="1"]:not(.saving):not([data-naizo-saving="1"]):not(.conflict):not(.needs-permission):not(.error) .c-top {
        animation: naizoBootTop 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) 1;
      }
      .dot[data-naizo-boot="1"]:not(.saving):not([data-naizo-saving="1"]):not(.conflict):not(.needs-permission):not(.error) .c-bl {
        animation: naizoBootBL 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) 1;
      }
      .dot[data-naizo-boot="1"]:not(.saving):not([data-naizo-saving="1"]):not(.conflict):not(.needs-permission):not(.error) .c-br {
        animation: naizoBootBR 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) 1;
      }
      @keyframes naizoHeartTop {
        0%, 29%, 100% { transform: translate(0, 0) scale(1); }
        11.5% { transform: translate(0, -1.4px) scale(1.22); }
      }
      @keyframes naizoHeartBR {
        0%, 33.33%, 62.33%, 100% { transform: translate(0, 0) scale(1); }
        44.83% { transform: translate(1.1px, 1.1px) scale(1.22); }
      }
      @keyframes naizoHeartBL {
        0%, 66.67%, 95.67%, 100% { transform: translate(0, 0) scale(1); }
        78.17% { transform: translate(-1.1px, 1.1px) scale(1.22); }
      }
      @keyframes naizoRingBreath {
        0%, 6%, 33.33%, 39.33%, 66.67%, 72.67%, 100% { transform: scale(1); }
        18.5%, 51.83%, 85.17% { transform: scale(1.064); }
      }
      .dot.saving .ring,
      .dot[data-naizo-saving="1"] .ring {
        animation: naizoRingBreath 1.55s ease-out infinite;
      }
      .dot.saving .c-top,
      .dot[data-naizo-saving="1"] .c-top {
        animation: naizoHeartTop 1.55s ease-in-out infinite;
      }
      .dot.saving .c-br,
      .dot[data-naizo-saving="1"] .c-br {
        animation: naizoHeartBR 1.55s ease-in-out infinite;
      }
      .dot.saving .c-bl,
      .dot[data-naizo-saving="1"] .c-bl {
        animation: naizoHeartBL 1.55s ease-in-out infinite;
      }
      @keyframes naizoConflictBL {
        0%, 100% { transform: translate(0, 0) scale(1); }
        25% { transform: translate(-2.5px, 0) scale(0.97, 1.02); }
        38%, 41% { transform: translate(1.4px, 0) scale(1.04, 0.95); }
        54% { transform: translate(-0.7px, 0) scale(1); }
        74% { transform: translate(0, 0) scale(1); }
      }
      @keyframes naizoConflictBR {
        0%, 100% { transform: translate(0, 0) scale(1); }
        25% { transform: translate(2.5px, 0) scale(0.97, 1.02); }
        38%, 41% { transform: translate(-1.4px, 0) scale(1.04, 0.95); }
        54% { transform: translate(0.7px, 0) scale(1); }
        74% { transform: translate(0, 0) scale(1); }
      }
      @keyframes naizoConflictTop {
        0%, 100% { transform: translate(0, 0) scale(1); }
        25%, 37% { transform: translate(0, 1.6px) scale(1.02, 0.97); }
        41.5% { transform: translate(0, 2.2px) scale(1.05, 0.92); }
        54% { transform: translate(0, -5.8px) scale(0.96, 1.06); }
        80% { transform: translate(0, 0) scale(1); }
      }
      @keyframes naizoConflictRing {
        0%, 40%, 100% { transform: scale(1); }
        50% { transform: scale(1.055); }
        76% { transform: scale(1); }
      }
      .dot.conflict .ring { animation: naizoConflictRing 1.75s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
      .dot.conflict .c-top { animation: naizoConflictTop 1.75s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
      .dot.conflict .c-bl { animation: naizoConflictBL 1.75s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
      .dot.conflict .c-br { animation: naizoConflictBR 1.75s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
      @keyframes naizoSyncRing {
        0%, 100% { transform: scale(1); }
        20% { transform: scale(0.97); }
        52% { transform: scale(1.06); }
        85% { transform: scale(1); }
      }
      @keyframes naizoSyncTop {
        0%, 100% { transform: translate(0, 0) scale(1); }
        20% { transform: translate(0, 2.2px) scale(0.93); }
        50% { transform: translate(0, -5.5px) scale(1.04); }
      }
      @keyframes naizoSyncBL {
        0%, 100% { transform: translate(0, 0) scale(1); }
        20% { transform: translate(2px, -2px) scale(0.93); }
        50% { transform: translate(-2px, 2px) scale(1.04); }
      }
      @keyframes naizoSyncBR {
        0%, 100% { transform: translate(0, 0) scale(1); }
        20% { transform: translate(-2px, -2px) scale(0.93); }
        50% { transform: translate(2px, 2px) scale(1.04); }
      }
      .dot.error .ring { animation: naizoSyncRing 1.6s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
      .dot.error .c-top { animation: naizoSyncTop 1.6s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
      .dot.error .c-bl { animation: naizoSyncBL 1.6s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
      .dot.error .c-br { animation: naizoSyncBR 1.6s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
      @keyframes naizoWaveRing {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.045); }
      }
      @keyframes naizoWaveTop {
        0%, 65%, 100% { transform: translate(0, 0) scale(1); }
        22% { transform: translate(0, -5.5px) scale(1.04); }
      }
      @keyframes naizoWaveBR {
        0%, 14%, 79%, 100% { transform: translate(0, 0) scale(1); }
        36% { transform: translate(2px, 2px) scale(1.04); }
      }
      @keyframes naizoWaveBL {
        0%, 28%, 92%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(-2px, 2px) scale(1.04); }
      }
      .dot.needs-permission .ring { animation: naizoWaveRing 1.75s ease-in-out infinite; }
      .dot.needs-permission .c-top { animation: naizoWaveTop 1.75s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
      .dot.needs-permission .c-br { animation: naizoWaveBR 1.75s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
      .dot.needs-permission .c-bl { animation: naizoWaveBL 1.75s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
      .pill-sep {
        width: 1px; height: 13px; background: var(--sep-color);
        margin: 0 1px; flex-shrink: 0;
      }
      .icon-btn {
        width: 22px; height: 22px; padding: 0; border-radius: 50%;
        border: 1px solid var(--btn-border); background: var(--btn-bg); color: var(--btn-color);
        display: inline-flex; align-items: center; justify-content: center;
        cursor: pointer; flex-shrink: 0;
        transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.12s ease;
      }
      .icon-btn:not([style*="display: none"]):not([style*="display:none"]) {
        display: inline-flex !important;
      }
      .icon-btn:hover {
        background: var(--btn-bg-hover); color: var(--btn-color-hover);
        transform: translateY(-0.5px);
      }
      .icon-btn:active {
        transform: translateY(0) scale(0.95);
      }
      .icon-btn svg {
        width: 13px; height: 13px; stroke: currentColor; stroke-width: 2.05;
        stroke-linecap: round; stroke-linejoin: round; fill: none;
        display: block; flex-shrink: 0;
      }
      .icon-btn.copied {
        color: #10b981; border-color: rgba(16, 185, 129, 0.35); background: rgba(16, 185, 129, 0.12);
      }
      .icon-btn.restore-btn {
        color: var(--restore-color); border-color: rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.12);
      }
      .icon-btn.reset-btn {
        color: #ef4444; border-color: rgba(239, 68, 68, 0.32); background: rgba(239, 68, 68, 0.09);
      }
      .icon-btn.reset-btn:hover {
        color: #ffffff; background: #ef4444; border-color: #ef4444;
      }
      .icon-btn.danger-hover:hover {
        color: #ef4444; border-color: rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.12);
      }
      button.net-slot {
        width: 18px; height: 18px; padding: 0; border: none; background: transparent;
        display: inline-flex; align-items: center; justify-content: center;
        cursor: pointer; flex-shrink: 0; border-radius: 50%; position: relative;
        transition: color 0.25s ease, transform 0.15s ease;
      }
      button.net-slot.idle,
      button.net-slot.active,
      button.net-slot.idle:hover,
      button.net-slot.active:hover {
        background: transparent; border: none; color: rgba(16, 185, 129, 0.38);
      }
      button.net-slot.error,
      button.net-slot.error:hover {
        background: transparent; border: none; color: #ef4444;
      }
      button.net-slot:hover {
        background: transparent; border: none; transform: scale(1.08);
      }
      .net-globe-svg {
        width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.85;
        stroke-linecap: round; stroke-linejoin: round; fill: none;
        display: block; flex-shrink: 0; overflow: visible;
        transform-box: fill-box; transform-origin: center;
      }
      .anim-net-error {
        transform-box: fill-box; transform-origin: center;
      }
      .net-globe-svg .globe-lit {
        opacity: 0; stroke: #10b981;
      }
      button.net-slot.active .net-globe-svg .globe-lit {
        opacity: 1;
      }
      @keyframes naizoGlobeWaveBand {
        0% { transform: translateX(-11px); }
        56% { transform: translateX(25px); }
        56.01%, 100% { transform: translateX(-11px); }
      }
      button.net-slot.active .wave-band-rect {
        animation: naizoGlobeWaveBand 1.65s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
      @keyframes naizoGlobeErrorPulse {
        0%, 100% { transform: scale(1); opacity: 0.72; }
        50% { transform: scale(1.1); opacity: 1; }
      }
      button.net-slot.error .net-globe-svg {
        animation: naizoGlobeErrorPulse 1.5s ease-in-out infinite;
      }
      .pill-tooltip {
        position: absolute; bottom: calc(100% + 7px); right: 0;
        padding: 4px 10px; border-radius: 999px;
        background: var(--pill-bg); color: var(--pill-text);
        border: 1px solid var(--pill-border); box-shadow: var(--pill-shadow);
        backdrop-filter: blur(12px) saturate(180%); -webkit-backdrop-filter: blur(12px) saturate(180%);
        font-size: 11px; font-weight: 500; letter-spacing: -0.01em;
        white-space: nowrap; pointer-events: none;
        opacity: 0; transform: translateY(4px) scale(0.97);
        transition: opacity 0.14s ease, transform 0.14s ease;
        display: inline-flex; align-items: center; gap: 6px;
      }
      .pill-anchor[data-corner$="-left"] .pill-tooltip {
        right: auto; left: 0;
      }
      .pill-anchor[data-corner^="top-"] .pill-tooltip {
        bottom: auto; top: calc(100% + 7px);
        transform: translateY(-4px) scale(0.97);
      }
      .pill-tooltip.visible,
      .pill-anchor[data-corner^="top-"] .pill-tooltip.visible {
        opacity: 1; transform: translateY(0) scale(1);
      }
      .pill-tooltip .kbd {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 10px; color: var(--pill-muted); padding: 0 4px;
        border-radius: 4px; border: 1px solid var(--btn-border); background: var(--btn-bg);
      }
      .confirm-pop {
        pointer-events: auto;
        display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
        padding: 5px 10px; border-radius: 999px;
        background: var(--pill-bg); color: var(--pill-text);
        border: 1px solid var(--pill-border); box-shadow: var(--pill-shadow);
        backdrop-filter: blur(12px) saturate(180%); -webkit-backdrop-filter: blur(12px) saturate(180%);
        font-size: 11px; font-weight: 500;
      }
      .confirm-pop button {
        font-family: inherit; font-size: 10.5px; font-weight: 600;
        padding: 2px 8px; border-radius: 999px;
        border: 1px solid var(--btn-border); background: var(--btn-bg); color: var(--pill-text);
        cursor: pointer;
      }
      .confirm-pop button:hover {
        background: var(--btn-bg-hover);
      }
      .confirm-pop button.danger {
        background: #ef4444; border-color: #ef4444; color: #ffffff;
      }
      .confirm-pop button.danger:hover {
        background: #dc2626; border-color: #dc2626;
      }
      @media (prefers-reduced-motion: reduce) {
        .dot, .icon-btn, button.net-slot, .pill-anchor, .pill-tooltip { transition: none; }
        .dot .ring, .dot .c-top, .dot .c-bl, .dot .c-br,
        button.net-slot.active .wave-band-rect,
        button.net-slot.error .net-globe-svg { animation: none !important; }
        button.net-slot.active,
        button.net-slot.active:hover { color: #10b981; }
      }
      @media print {
        .pill-anchor, .pill-drop-zone, .pill { display: none !important; }
      }
    </style>
    <div class="pill-drop-zone" data-corner="top-left" aria-hidden="true"></div>
    <div class="pill-drop-zone" data-corner="top-right" aria-hidden="true"></div>
    <div class="pill-drop-zone" data-corner="bottom-left" aria-hidden="true"></div>
    <div class="pill-drop-zone" data-corner="bottom-right" aria-hidden="true"></div>
    <div class="pill-anchor" id="pill-anchor" data-corner="${initialCorner}">
      <div class="confirm-pop" id="reset-confirm" role="alertdialog" aria-label="Confirm reset" style="display: none">
        <span>Reset app to initial state?</span>
        <button id="reset-yes" type="button" class="danger" aria-label="Confirm reset to initial state">Reset</button>
        <button id="reset-cancel" type="button" aria-label="Cancel reset">Cancel</button>
      </div>
      <div class="pill-tooltip" id="pill-tooltip" role="tooltip" aria-hidden="true">
        <span id="tooltip-text">Browser Cache · Click to Link Disk</span>
        <span class="kbd" id="tooltip-kbd" style="display: none">${saveKbd}</span>
      </div>
      <div class="pill" id="pill" role="region" aria-label="naizo.js sync status">
        <span id="status" class="sr-only" role="status" aria-live="polite">Browser Cache · Click to Link Disk</span>
        <button type="button" class="dot" id="dot" data-naizo-boot="1" data-tip="Browser Cache · Click to Link Disk" title="Browser Cache · Click to Link Disk" aria-label="Naizo sync status"><svg class="naizo-logo-svg" viewBox="0 0 100 100" aria-hidden="true"><circle class="ring" cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="8" /><rect class="c-top" x="39" y="26" width="22" height="22" rx="4.5" fill="currentColor" /><rect class="c-bl" x="26" y="52" width="22" height="22" rx="4.5" fill="currentColor" /><rect class="c-br" x="52" y="52" width="22" height="22" rx="4.5" fill="currentColor" /></svg></button>
        <span class="pill-sep" id="dot-sep" aria-hidden="true"></span>
        <button id="action" type="button" class="icon-btn" data-tip="Link Disk" data-kbd="${saveKbd}" title="Link local HTML file on disk (⌘S / Ctrl+S)" aria-label="Link disk file"><span class="sr-only" id="action-sr">Link Disk</span><svg id="action-svg" viewBox="0 0 24 24" aria-hidden="true">${PILL_ICONS.link}</svg></button>
        <button id="unlink" type="button" class="icon-btn danger-hover" style="display: none" data-tip="Unlink Disk" title="Forget linked disk file" aria-label="Unlink disk file"><span class="sr-only">× Unlink</span><svg viewBox="0 0 24 24" aria-hidden="true">${PILL_ICONS.unlink}</svg></button>
        <button id="copy" type="button" class="icon-btn" data-tip="Copy JSON" title="Copy #naizodb JSON state" aria-label="Copy #naizodb JSON"><span class="sr-only" id="copy-sr">📋 Copy</span><svg id="copy-svg" viewBox="0 0 24 24" aria-hidden="true">${PILL_ICONS.copy}</svg></button>
        <button id="restore" type="button" class="icon-btn restore-btn" style="display: none" data-tip="Restore Backup" title="Restore browser state before conflict or reset" aria-label="Restore conflict backup"><span class="sr-only" id="restore-sr">↺ Restore</span><svg id="restore-svg" viewBox="0 0 24 24" aria-hidden="true">${PILL_ICONS.restore}</svg></button>
        <button id="reset" type="button" class="icon-btn reset-btn" style="display: none" data-tip="Reset to Initial State" title="Reset app to initial published state" aria-label="Reset to initial state"><span class="sr-only">↺ Reset</span><svg viewBox="0 0 24 24" aria-hidden="true">${PILL_ICONS.eraser}</svg></button>
        <span class="pill-sep" id="net-sep" style="display: none" aria-hidden="true"></span>
        <button type="button" id="net" class="net-slot idle" data-tip="API Idle" title="API idle" aria-label="API network status" style="display: none">
          <svg class="net-globe-svg" viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <clipPath id="naizo-net-wave-clip">
                <rect class="wave-band-rect" x="-4" y="0" width="9" height="24" rx="4" />
              </clipPath>
            </defs>
            <g class="globe-base">${NET_GLOBE_WIRES}</g>
            <g class="globe-lit" clip-path="url(#naizo-net-wave-clip)">${NET_GLOBE_WIRES}</g>
          </svg>
        </button>
      </div>
    </div>
  `;
		const byId = (id) => shadow.getElementById(id);
		statusEl = byId("status");
		dotBtnEl = byId("dot");
		actionBtn = byId("action");
		actionSrEl = byId("action-sr");
		actionSvgEl = byId("action-svg");
		restoreBtn = byId("restore");
		restoreSrEl = byId("restore-sr");
		restoreSvgEl = byId("restore-svg");
		copySrEl = byId("copy-sr");
		copySvgEl = byId("copy-svg");
		resetBtn = byId("reset");
		resetConfirmEl = byId("reset-confirm");
		unlinkBtn = byId("unlink");
		netSepEl = byId("net-sep");
		netBtn = byId("net");
		tooltipEl = byId("pill-tooltip");
		tooltipTextEl = byId("tooltip-text");
		tooltipKbdEl = byId("tooltip-kbd");
		const anchorEl = byId("pill-anchor");
		const pillEl = byId("pill");
		const dropZones = Array.from(shadow.querySelectorAll(".pill-drop-zone"));
		const copyBtn = byId("copy");
		const resetYesBtn = byId("reset-yes");
		const resetCancelBtn = byId("reset-cancel");
		bootClearTimeout = setTimeout(() => {
			bootClearTimeout = null;
			if (dotBtnEl) delete dotBtnEl.dataset.naizoBoot;
		}, 1250);
		if (typeof MutationObserver !== "undefined") {
			themeObserver = new MutationObserver(() => {
				syncHostTheme(host);
			});
			for (const themeEl of [document.documentElement, document.body]) if (themeEl) themeObserver.observe(themeEl, {
				attributes: true,
				attributeFilter: ["data-theme", "class"]
			});
		}
		if (typeof window !== "undefined" && typeof window.matchMedia === "function") try {
			const mq = window.matchMedia("(prefers-color-scheme: dark)");
			const onMqChange = () => {
				syncHostTheme(host);
			};
			if (typeof mq.addEventListener === "function") {
				mq.addEventListener("change", onMqChange);
				themeMediaCleanup = () => {
					mq.removeEventListener("change", onMqChange);
				};
			} else if (typeof mq.addListener === "function") {
				mq.addListener(onMqChange);
				themeMediaCleanup = () => {
					mq.removeListener(onMqChange);
				};
			}
		} catch {}
		let suppressNextDotClick = false;
		let lastPointerWasTouch = false;
		dotBtnEl?.addEventListener("click", (e) => {
			if (suppressNextDotClick) {
				suppressNextDotClick = false;
				e.preventDefault();
				return;
			}
			if (isInvalidDbState() || isOnlineMode()) return;
			if (!fileHandle || fileHandlePermission !== "granted") connectOrResumeDisk();
			else if (dotBtnEl?.className === "dot") Naizo.save();
		});
		actionBtn?.addEventListener("click", () => {
			if (isOnlineMode()) Naizo.downloadHTML();
			else connectOrResumeDisk();
		});
		restoreBtn?.addEventListener("click", () => {
			restoreConflictBackup();
		});
		copyBtn?.addEventListener("click", () => {
			const copyEpoch = initEpoch;
			Naizo.copyJSON().then(() => {
				if (!isCurrentEpoch(copyEpoch) || !copyBtn.isConnected) return;
				if (copyResetTimeout !== null) clearTimeout(copyResetTimeout);
				copyBtn.classList.add("copied");
				copyBtn.dataset.tip = "✓ Copied";
				if (copySrEl) copySrEl.textContent = "✓ Copied";
				if (copySvgEl) copySvgEl.innerHTML = PILL_ICONS.check;
				if (activeTipBtn === copyBtn) refreshActivePillTooltip();
				else showPillTooltip("✓ Copied", "");
				copyResetTimeout = setTimeout(() => {
					copyResetTimeout = null;
					if (!isCurrentEpoch(copyEpoch) || !copyBtn.isConnected) return;
					copyBtn.classList.remove("copied");
					copyBtn.dataset.tip = "Copy JSON";
					if (copySrEl) copySrEl.textContent = "📋 Copy";
					if (copySvgEl) copySvgEl.innerHTML = PILL_ICONS.copy;
					if (activeTipBtn === copyBtn) refreshActivePillTooltip();
					else if (!activeTipBtn && transientTipTimeout === null) hidePillTooltip();
				}, 1500);
			});
		});
		resetBtn?.addEventListener("click", () => {
			if (!resetConfirmEl) return;
			const opening = resetConfirmEl.style.display === "none";
			resetConfirmEl.style.display = opening ? "inline-flex" : "none";
			if (opening) hidePillTooltip(true);
			else refreshActivePillTooltip();
		});
		resetYesBtn?.addEventListener("click", () => {
			if (resetConfirmEl) resetConfirmEl.style.display = "none";
			Naizo.reset();
		});
		resetCancelBtn?.addEventListener("click", () => {
			if (resetConfirmEl) resetConfirmEl.style.display = "none";
			refreshActivePillTooltip();
		});
		unlinkBtn?.addEventListener("click", () => {
			Naizo.unlink();
		});
		netBtn?.addEventListener("click", () => {
			if (netState === "error" || netPendingError) {
				netPendingError = false;
				if (netHoldTimeout !== null) {
					clearTimeout(netHoldTimeout);
					netHoldTimeout = null;
				}
				if (netInFlightCount > 0) {
					netActiveStartMs = Date.now();
					netState = "active";
				} else netState = "idle";
				applyNetUiState();
				if (activeTipBtn !== netBtn) hidePillTooltip();
			}
		});
		pillTipTargets = [
			dotBtnEl,
			actionBtn,
			unlinkBtn,
			copyBtn,
			restoreBtn,
			resetBtn,
			netBtn
		].filter((btn) => btn !== null);
		pillTipTargets.forEach((btn) => {
			const activateTip = (stash) => {
				if (stash) stashElementTitle(btn);
				activeTipBtn = btn;
				if (transientTipTimeout !== null) {
					clearTimeout(transientTipTimeout);
					transientTipTimeout = null;
				}
				refreshActivePillTooltip();
			};
			btn.addEventListener("pointerdown", (e) => {
				if (e.pointerType === "touch") {
					lastPointerWasTouch = true;
					activeTipBtn = null;
					hidePillTooltip(true);
				} else lastPointerWasTouch = false;
			});
			btn.addEventListener("pointerenter", (e) => {
				if (e.pointerType === "touch") {
					activeTipBtn = null;
					hidePillTooltip();
					return;
				}
				lastPointerWasTouch = false;
				activateTip(true);
			});
			btn.addEventListener("mouseenter", () => {
				if (!lastPointerWasTouch) activateTip(true);
			});
			btn.addEventListener("focus", () => {
				if (!lastPointerWasTouch) activateTip(false);
			});
			const onLeave = () => {
				restoreElementTitle(btn);
				if (activeTipBtn === btn) {
					activeTipBtn = null;
					if (transientTipTimeout === null) hidePillTooltip();
				}
			};
			btn.addEventListener("pointerleave", onLeave);
			btn.addEventListener("mouseleave", onLeave);
			btn.addEventListener("blur", onLeave);
		});
		const highlightDropZone = (corner) => {
			dropZones.forEach((zone) => {
				zone.classList.toggle("active-target", zone.dataset.corner === corner);
			});
		};
		highlightDropZone(initialCorner);
		const syncDropZoneSizes = () => {
			const w = pillEl && pillEl.offsetWidth > 0 ? pillEl.offsetWidth : 146;
			const h = pillEl && pillEl.offsetHeight > 0 ? pillEl.offsetHeight : 30;
			dropZones.forEach((zone) => {
				zone.style.width = `${w}px`;
				zone.style.height = `${h}px`;
			});
		};
		const getNearestViewportCorner = (clientX, clientY) => {
			const vw = typeof window !== "undefined" && window.innerWidth > 0 ? window.innerWidth : 1024;
			const vh = typeof window !== "undefined" && window.innerHeight > 0 ? window.innerHeight : 768;
			const isRight = clientX >= vw / 2;
			return clientY >= vh / 2 ? isRight ? "bottom-right" : "bottom-left" : isRight ? "top-right" : "top-left";
		};
		let dragState = null;
		pillEl?.addEventListener("pointerdown", (e) => {
			if ((e.pointerType === "mouse" || !e.pointerType) && typeof e.button === "number" && e.button !== 0) return;
			if (dragState !== null) return;
			const clickedBtn = e.target?.closest("button");
			if (clickedBtn && clickedBtn !== dotBtnEl) return;
			suppressNextDotClick = false;
			if (dragClickResetTimeout !== null) {
				clearTimeout(dragClickResetTimeout);
				dragClickResetTimeout = null;
			}
			syncDropZoneSizes();
			const pointerId = e.pointerId ?? 0;
			dragState = {
				pointerId,
				startX: e.clientX,
				startY: e.clientY,
				moved: false
			};
			try {
				pillEl.setPointerCapture?.(pointerId);
			} catch {}
		});
		pillEl?.addEventListener("pointermove", (e) => {
			if (!dragState || (e.pointerId ?? 0) !== dragState.pointerId) return;
			const dx = e.clientX - dragState.startX;
			const dy = e.clientY - dragState.startY;
			if (!dragState.moved && Math.hypot(dx, dy) > 5) {
				dragState.moved = true;
				host.setAttribute("data-naizo-dragging", "1");
				anchorEl?.classList.add("is-dragging");
				hidePillTooltip(true);
			}
			if (dragState.moved && anchorEl) {
				anchorEl.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
				highlightDropZone(getNearestViewportCorner(e.clientX, e.clientY));
			}
		});
		const finishDrag = (e) => {
			if (!dragState || (e.pointerId ?? 0) !== dragState.pointerId) return;
			const wasMoved = dragState.moved;
			const activePointerId = dragState.pointerId;
			dragState = null;
			try {
				pillEl?.releasePointerCapture?.(activePointerId);
			} catch {}
			host.removeAttribute("data-naizo-dragging");
			if (!wasMoved) {
				anchorEl?.classList.remove("is-dragging");
				if (anchorEl) anchorEl.style.transform = "";
				return;
			}
			if (e.type !== "pointercancel") {
				suppressNextDotClick = true;
				if (dragClickResetTimeout !== null) clearTimeout(dragClickResetTimeout);
				dragClickResetTimeout = setTimeout(() => {
					dragClickResetTimeout = null;
					suppressNextDotClick = false;
				}, 60);
			}
			if (!anchorEl) return;
			const fromRect = anchorEl.getBoundingClientRect();
			if (e.type !== "pointercancel") {
				const targetCorner = getNearestViewportCorner(e.clientX, e.clientY);
				highlightDropZone(targetCorner);
				anchorEl.dataset.corner = targetCorner;
				saveUiCorner(targetCorner);
			} else {
				const existingCorner = anchorEl.dataset.corner ?? initialCorner;
				highlightDropZone(existingCorner);
			}
			anchorEl.style.transform = "";
			const toRect = anchorEl.getBoundingClientRect();
			if (toRect.width > 0 && !matchesMediaQuery("(prefers-reduced-motion: reduce)")) {
				const flipDx = fromRect.left - toRect.left;
				const flipDy = fromRect.top - toRect.top;
				if (Math.abs(flipDx) > .5 || Math.abs(flipDy) > .5) {
					anchorEl.style.transform = `translate3d(${flipDx}px, ${flipDy}px, 0)`;
					anchorEl.offsetWidth;
				}
			}
			anchorEl.classList.remove("is-dragging");
			anchorEl.style.transform = "";
		};
		pillEl?.addEventListener("pointerup", finishDrag);
		pillEl?.addEventListener("pointercancel", finishDrag);
		applyNetUiState();
		const dotClasses = /* @__PURE__ */ new Set([
			"saved",
			"saving",
			"conflict",
			"needs-permission",
			"error"
		]);
		host._setDot = (state) => {
			if (dotBtnEl) dotBtnEl.className = dotClasses.has(state) ? `dot ${state}` : "dot";
			syncSavingBeat(state);
		};
		document.body.appendChild(host);
	}
	function isDirtyFromInitial() {
		if (!initialDiskDb || isInvalidDbState()) return false;
		return canonicalContentBuckets(ensureStore()) !== canonicalContentBuckets(initialDiskDb);
	}
	function setButtonIconAndSr(srEl, svgEl, srText, svgInner) {
		if (srEl && srEl.textContent !== srText) srEl.textContent = srText;
		if (svgEl && svgEl.dataset.icon !== svgInner) {
			svgEl.dataset.icon = svgInner;
			svgEl.innerHTML = svgInner;
		}
	}
	function updateUi(state, message) {
		if (!statusEl || !actionBtn) return;
		const online = isOnlineMode();
		const saveKbd = getSaveShortcutKbd();
		statusEl.textContent = message;
		if (dotBtnEl) {
			dotBtnEl.dataset.tip = message;
			setPillElementTitle(dotBtnEl, message);
		}
		(uiHost ?? document.getElementById(UI_ID))?._setDot?.(state);
		if (online) {
			if (state === "error") actionBtn.style.display = "none";
			else {
				actionBtn.style.display = "inline-block";
				setButtonIconAndSr(actionSrEl, actionSvgEl, "⬇ Save to PC", PILL_ICONS.download);
				actionBtn.dataset.tip = "Save to PC";
				actionBtn.dataset.kbd = "";
				setPillElementTitle(actionBtn, "Download portable HTML app to your computer (⌘S / Ctrl+S saves in browser)");
				actionBtn.setAttribute("aria-label", "Save portable HTML to PC");
			}
		} else if (state === "saved" || isInvalidDbState()) {
			actionBtn.style.display = "none";
			setPillElementTitle(actionBtn, "Save to disk (⌘S / Ctrl+S)");
		} else if (state === "needs-permission") {
			actionBtn.style.display = "inline-block";
			setButtonIconAndSr(actionSrEl, actionSvgEl, "Resume Disk Sync", PILL_ICONS.link);
			actionBtn.dataset.tip = "Resume Disk Sync";
			actionBtn.dataset.kbd = saveKbd;
			setPillElementTitle(actionBtn, "Resume disk sync (⌘S / Ctrl+S)");
			actionBtn.setAttribute("aria-label", "Resume disk sync");
		} else if (fileHandle) {
			actionBtn.style.display = "none";
			setPillElementTitle(actionBtn, "Save to disk (⌘S / Ctrl+S)");
		} else {
			actionBtn.style.display = "inline-block";
			setButtonIconAndSr(actionSrEl, actionSvgEl, "Link Disk", PILL_ICONS.link);
			actionBtn.dataset.tip = "Link Disk";
			actionBtn.dataset.kbd = saveKbd;
			setPillElementTitle(actionBtn, "Link local HTML file on disk (⌘S / Ctrl+S)");
			actionBtn.setAttribute("aria-label", "Link disk file");
		}
		if (restoreBtn) {
			if (isInvalidDbState()) {
				setButtonIconAndSr(restoreSrEl, restoreSvgEl, "↺ Repair", PILL_ICONS.wrench);
				restoreBtn.dataset.tip = "Repair JSON";
				setPillElementTitle(restoreBtn, "Repair invalid #naizodb JSON");
				restoreBtn.setAttribute("aria-label", "Repair invalid #naizodb JSON");
				restoreBtn.style.display = "inline-block";
			} else {
				setButtonIconAndSr(restoreSrEl, restoreSvgEl, "↺ Restore", PILL_ICONS.restore);
				restoreBtn.dataset.tip = "Restore Backup";
				setPillElementTitle(restoreBtn, "Restore browser state before conflict or reset");
				restoreBtn.setAttribute("aria-label", "Restore conflict backup");
				const hasBackup = safeGetStorage(getBackupKey()) !== null;
				restoreBtn.style.display = hasBackup || state === "conflict" ? "inline-block" : "none";
			}
		}
		if (resetBtn) {
			const showReset = (online || !fileHandle) && !isInvalidDbState() && isDirtyFromInitial();
			resetBtn.style.display = showReset ? "inline-block" : "none";
			if (!showReset && resetConfirmEl) resetConfirmEl.style.display = "none";
		}
		if (unlinkBtn) unlinkBtn.style.display = !online && fileHandle ? "inline-block" : "none";
		refreshActivePillTooltip();
	}
	function findRowElementInList(listEl, rowObj, fallbackIndex) {
		const rows = Array.from(listEl.querySelectorAll(DIRECT_ITEM_SELECTOR));
		if (rowObj) {
			const matched = rows.find((r) => itemDataMap.get(r) === rowObj);
			if (matched) return matched;
		}
		return fallbackIndex >= 0 ? rows[fallbackIndex] : void 0;
	}
	function resolveListItemIndex(listEl, listName, itemEl) {
		const mappedObj = itemDataMap.get(itemEl);
		const listArr = getOwn(ensureStore().lists, listName);
		if (mappedObj && Array.isArray(listArr)) {
			const mappedIdx = listArr.indexOf(mappedObj);
			if (mappedIdx !== -1) return {
				idx: mappedIdx,
				total: listArr.length
			};
		}
		const rows = Array.from(listEl.querySelectorAll(DIRECT_ITEM_SELECTOR));
		return {
			idx: rows.indexOf(itemEl),
			total: rows.length
		};
	}
	function propagateItemKeyAcrossContainers(listName, sourceListEl, sourceItemEl, rowObj, fallbackIndex, key, val, sourceEl) {
		propagateItemKey(sourceItemEl, key, val, sourceEl);
		if (!listName) return;
		findListElements(listName).forEach((otherListEl) => {
			if (otherListEl === sourceListEl) return;
			const mirrorItemEl = findRowElementInList(otherListEl, rowObj, fallbackIndex);
			if (mirrorItemEl && mirrorItemEl !== sourceItemEl) propagateItemKey(mirrorItemEl, key, val, sourceEl);
		});
	}
	function handleInputOrChange(e) {
		const target = e.target;
		if (!(target instanceof Element)) return;
		if (isIgnoredElement(target)) return;
		if (e.type === "toggle" && !isDetailsElement(target)) return;
		const boundEl = target.closest(BOUND_SELECTOR);
		if (!boundEl || isIgnoredElement(boundEl) || isSkippedElement(boundEl, true)) return;
		if (boundEl !== target && !isContentEditableElement(boundEl)) return;
		const key = getElementKey(boundEl);
		if (!key) return;
		const nextVal = readElementValue(boundEl);
		if (nextVal === void 0) return;
		const db = ensureStore();
		const itemEl = boundEl.closest(ITEM_SELECTOR);
		if (itemEl) {
			const rowObj = getOrBindItemRecord(itemEl);
			if (!rowObj) return;
			const exists = hasOwn(rowObj, key);
			if (!shouldUpdateStoredValue(getOwn(rowObj, key), nextVal, exists)) return;
			setOwn(rowObj, key, nextVal);
			const listEl = itemEl.closest(LIST_SELECTOR);
			const listName = listEl ? getAttr(listEl, "naizo-list") : null;
			const listArr = listName ? getOwn(db.lists, listName) : void 0;
			const index = Array.isArray(listArr) ? listArr.indexOf(rowObj) : -1;
			propagateItemKeyAcrossContainers(listName, listEl, itemEl, rowObj, index, key, nextVal, boundEl);
			schedulePersist();
			dispatchChangeEvent({
				scope: "lists",
				action: "update",
				list: listName,
				...index !== -1 ? { index } : {},
				key,
				value: nextVal,
				source: "dom"
			});
			return;
		}
		const exists = hasOwn(db.fields, key);
		if (!shouldUpdateStoredValue(getOwn(db.fields, key), nextVal, exists)) return;
		setOwn(db.fields, key, nextVal);
		propagateStandaloneKey(key, nextVal, boundEl);
		schedulePersist();
		dispatchChangeEvent({
			scope: "fields",
			key,
			value: nextVal,
			source: "dom"
		});
	}
	function handleFormReset(e) {
		if (e.defaultPrevented) return;
		const form = e.target;
		if (!(form instanceof Element) || !form.isConnected || isIgnoredElement(form)) return;
		const resetEpoch = initEpoch;
		setTimeout(() => {
			if (e.defaultPrevented || !form.isConnected || !isCurrentEpoch(resetEpoch)) return;
			const db = ensureStore();
			let changed = false;
			const applyResetElements = (elements, targetRec, propagate) => {
				const interactiveKeys = /* @__PURE__ */ new Set();
				orderInteractiveFirst(elements).forEach((el) => {
					const key = getElementKey(el);
					if (!key) return;
					const interactive = isInteractiveBoundElement(el);
					if (interactive) interactiveKeys.add(key);
					else if (interactiveKeys.has(key)) {
						if (hasOwn(targetRec, key)) writeElementValue(el, getOwn(targetRec, key));
						return;
					}
					const nextVal = readElementValue(el);
					if (nextVal === void 0) return;
					if (shouldUpdateStoredValue(getOwn(targetRec, key), nextVal, hasOwn(targetRec, key))) {
						setOwn(targetRec, key, nextVal);
						propagate(key, nextVal, el);
						changed = true;
					} else if (interactive && hasOwn(targetRec, key)) propagate(key, getOwn(targetRec, key), el);
				});
			};
			applyResetElements(queryStandaloneBoundElements(form), db.fields, propagateStandaloneKey);
			form.querySelectorAll(ITEM_SELECTOR).forEach((itemEl) => {
				if (isIgnoredElement(itemEl)) return;
				const rowObj = getOrBindItemRecord(itemEl);
				if (!rowObj) return;
				const listEl = itemEl.closest(LIST_SELECTOR);
				const listName = listEl ? getAttr(listEl, "naizo-list") : null;
				const listArr = listName ? getOwn(db.lists, listName) : void 0;
				const idx = Array.isArray(listArr) ? listArr.indexOf(rowObj) : -1;
				applyResetElements(queryItemBoundElements(itemEl), rowObj, (key, val, srcEl) => {
					propagateItemKeyAcrossContainers(listName, listEl, itemEl, rowObj, idx, key, val, srcEl);
				});
			});
			if (changed) {
				persistStoreMutation();
				dispatchChangeEvent({
					scope: "reset",
					source: "dom"
				});
			}
		}, 0);
	}
	function addItemInternal(listName, itemData, focusTargetListEl) {
		if (!listName || !isPlainObject(itemData) || !isValidJsonValue(itemData)) {
			console.warn("[naizo.js] Rejected invalid list item data for:", listName);
			return;
		}
		const db = ensureStore();
		const rowObj = cloneRecord(itemData);
		let listArr = getOwn(db.lists, listName);
		if (!Array.isArray(listArr)) {
			listArr = [];
			setOwn(db.lists, listName, listArr);
		}
		const listEls = findListElements(listName);
		if (listEls.length === 0) {
			listArr.push(rowObj);
			persistStoreMutation();
			dispatchChangeEvent({
				scope: "lists",
				action: "add",
				list: listName,
				index: listArr.length - 1,
				value: rowObj,
				source: "api"
			});
			return;
		}
		listEls.forEach((el) => ensureListBlueprints(el, false));
		seedInteractiveTemplateDefaultsForList(listName, [rowObj]);
		const createdPairs = [];
		for (const listEl of listEls) {
			const node = createItemNode(listEl, rowObj);
			if (node) {
				listEl.appendChild(node);
				createdPairs.push({
					listEl,
					node
				});
			}
		}
		if (createdPairs.length > 0) {
			listArr.push(rowObj);
			const index = listArr.length - 1;
			for (const { listEl, node } of createdPairs) {
				decorateListControls(listEl);
				Naizo.bind(node);
				dispatchItemEvent(listName, node, rowObj, index);
			}
			persistStoreMutation();
			dispatchChangeEvent({
				scope: "lists",
				action: "add",
				list: listName,
				index,
				value: rowObj,
				source: "api"
			});
			if (focusTargetListEl) ((createdPairs.find((p) => p.listEl === focusTargetListEl) ?? createdPairs[0])?.node.querySelector("input[type=\"text\"], [contenteditable=\"true\"], [contenteditable=\"\"], [contenteditable=\"plaintext-only\"], textarea"))?.focus();
		}
	}
	function isRemoteNaizoDbCandidate(val) {
		if (!isPlainObject(val) || !isValidJsonValue(val)) return false;
		return hasOwn(val, "_meta") || hasOwn(val, "fields") || hasOwn(val, "lists") || hasOwn(val, "custom");
	}
	function extractByDotPath(rootValue, dotPath) {
		const trimmed = dotPath.trim();
		if (!trimmed) return {
			ok: true,
			value: rootValue
		};
		const segments = trimmed.split(".");
		if (segments.some((seg) => seg.length === 0)) return {
			ok: false,
			value: void 0
		};
		let current = rootValue;
		for (const seg of segments) if (Array.isArray(current)) {
			if (!/^(?:0|[1-9]\d*)$/.test(seg)) return {
				ok: false,
				value: void 0
			};
			const idx = Number(seg);
			if (!Number.isSafeInteger(idx) || idx < 0 || idx >= current.length || !hasOwn(current, seg)) return {
				ok: false,
				value: void 0
			};
			current = current[idx];
		} else if (isPlainObject(current)) {
			if (!hasOwn(current, seg)) return {
				ok: false,
				value: void 0
			};
			current = getOwn(current, seg);
		} else return {
			ok: false,
			value: void 0
		};
		return {
			ok: true,
			value: current
		};
	}
	function resolveDeclarativeBodySource(bodySource) {
		const db = ensureStore();
		const trimmed = (bodySource ?? "db").trim();
		if (!trimmed || trimmed === "db") return JSON.stringify(db, null, 2);
		if (trimmed === "fields") return JSON.stringify(db.fields, null, 2);
		if (trimmed === "custom") return JSON.stringify(db.custom, null, 2);
		if (trimmed.startsWith("list:")) {
			const listName = trimmed.slice(5).trim();
			const rawList = hasOwn(db.lists, listName) ? getOwn(db.lists, listName) : [];
			return JSON.stringify(Array.isArray(rawList) ? rawList : [], null, 2);
		}
		if (trimmed.startsWith("field:")) {
			const fieldKey = trimmed.slice(6).trim();
			const val = hasOwn(db.fields, fieldKey) ? getOwn(db.fields, fieldKey) : null;
			return JSON.stringify(val ?? null);
		}
		return JSON.stringify(db, null, 2);
	}
	function resolveProgrammaticBody(bodyOption) {
		if (bodyOption === void 0) return JSON.stringify(ensureStore(), null, 2);
		if (typeof bodyOption === "string") return bodyOption;
		if (!isValidJsonValue(bodyOption)) throw new Error("Invalid non-JSON request body");
		return JSON.stringify(bodyOption);
	}
	function isValueEmptyForInit(val) {
		if (val === void 0 || val === null || val === "") return true;
		if (Array.isArray(val)) return val.length === 0;
		return false;
	}
	function isStoreContentEmpty(db) {
		const fieldsEmpty = Object.keys(db.fields).every((k) => isValueEmptyForInit(getOwn(db.fields, k)));
		const listsEmpty = Object.keys(db.lists).every((k) => {
			const arr = getOwn(db.lists, k);
			return !Array.isArray(arr) || arr.length === 0;
		});
		const customEmpty = Object.keys(db.custom).length === 0;
		return fieldsEmpty && listsEmpty && customEmpty;
	}
	function isInitTargetEmpty(target, method) {
		const db = ensureStore();
		if (target !== null) {
			if (target.startsWith("field:")) {
				const key = target.slice(6).trim();
				if (!key) return false;
				return !hasOwn(db.fields, key) || isValueEmptyForInit(getOwn(db.fields, key));
			}
			if (target.startsWith("list:")) {
				const listName = target.slice(5).trim();
				if (!listName) return false;
				if (!hasOwn(db.lists, listName)) return true;
				const arr = getOwn(db.lists, listName);
				return !Array.isArray(arr) || arr.length === 0;
			}
			if (target.startsWith("custom:")) {
				const key = target.slice(7).trim();
				if (!key) return false;
				if (!hasOwn(db.custom, key)) return true;
				const val = getOwn(db.custom, key);
				if (isPlainObject(val)) return Object.keys(val).length === 0;
				return isValueEmptyForInit(val);
			}
			if (target !== "db") try {
				const first = Array.from(document.querySelectorAll(target)).filter((el) => !isIgnoredElement(el))[0];
				if (!first) return false;
				if (first instanceof HTMLInputElement || first instanceof HTMLTextAreaElement || first instanceof HTMLSelectElement) return first.value.trim() === "";
				return readCleanTextContent(first).trim() === "";
			} catch {
				return false;
			}
		}
		if (method !== "GET" && target === null) return false;
		return isStoreContentEmpty(db);
	}
	function writeSelectorTarget(selector, extracted) {
		let matched;
		try {
			matched = Array.from(document.querySelectorAll(selector)).filter((el) => !isIgnoredElement(el));
		} catch {
			throw new Error(`Invalid target selector: ${selector}`);
		}
		if (matched.length === 0) throw new Error(`Target selector "${selector}" matched no elements`);
		const formatted = isPlainObject(extracted) || Array.isArray(extracted) ? JSON.stringify(extracted, null, 2) : extracted;
		matched.forEach((el) => {
			const boundKey = getElementKey(el);
			if (boundKey) {
				const hint = Boolean(el.closest(ITEM_SELECTOR)) ? "naizo-into=\"list:<name>\"" : `naizo-into="field:${boundKey}"`;
				console.warn(`[naizo.js] Selector target "${selector}" matched bound element [naizo="${boundKey}"]; selector targets update DOM only and do not persist to #naizodb. Use ${hint} to persist.`);
			}
			if (isNonLeafElement(el)) writeCleanTextContent(el, toTextValue(formatted));
			else writeElementValue(el, formatted);
		});
	}
	function routeFetchPayload(target, extracted) {
		if (target === null) return;
		if (target === "db") {
			if (isInvalidDbState()) throw new Error("Cannot hydrate #naizodb while startup JSON is invalid");
			if (!isRemoteNaizoDbCandidate(extracted)) throw new Error("Response is not a valid NaizoDatabase object");
			const normalized = validateAndNormalizeDb(extracted);
			if (!normalized) throw new Error("Response failed NaizoDatabase validation");
			const prevDb = ensureStore();
			if (!isStoreContentEmpty(prevDb) && canonicalContentBuckets(prevDb) !== canonicalContentBuckets(normalized)) safeSetStorage(getBackupKey(), JSON.stringify(cloneDb(prevDb)));
			store = normalized;
			storeInitialized = true;
			hydrateSubtreeFromStore(document, true, false);
			persistStoreMutation();
			if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
			dispatchChangeEvent({
				scope: "db",
				action: "set",
				value: store,
				source: "api"
			});
			return;
		}
		if (target.startsWith("field:")) {
			const key = target.slice(6).trim();
			if (!key || !isValidJsonValue(extracted)) throw new Error(`Invalid field target or JSON value for "${target}"`);
			Naizo.setField(key, extracted);
			return;
		}
		if (target.startsWith("list:")) {
			const listName = target.slice(5).trim();
			if (!listName || !Array.isArray(extracted) || !isValidJsonValue(extracted) || !extracted.every((item) => isPlainObject(item))) throw new Error(`Expected array of plain JSON objects for "${target}"`);
			Naizo.setList(listName, extracted);
			return;
		}
		if (target.startsWith("custom:")) {
			const key = target.slice(7).trim();
			if (!key || !isValidJsonValue(extracted)) throw new Error(`Invalid custom target or JSON value for "${target}"`);
			Naizo.set(key, extracted);
			return;
		}
		writeSelectorTarget(target, extracted);
	}
	async function executeFetch(url, options, declarativeBodySource) {
		const epoch = initEpoch;
		const trimmedUrl = (url ?? "").trim();
		const method = (options?.method ?? "GET").trim().toUpperCase() || "GET";
		const rawInto = options?.into !== void 0 ? options.into.trim() : "";
		const target = rawInto.length > 0 ? rawInto : null;
		const rawPath = options?.path !== void 0 ? options.path.trim() : "";
		const buildStaleFetchResult = (finalStatus) => ({
			url: trimmedUrl,
			method,
			ok: false,
			status: finalStatus,
			target,
			data: null,
			error: "Aborted due to Naizo re-initialization"
		});
		beginNetRequest();
		const finishFetch = (ok, finalStatus, data, error) => {
			const result = {
				url: trimmedUrl,
				method,
				ok,
				status: finalStatus,
				target,
				data,
				error
			};
			if (!isCurrentEpoch(epoch)) return result;
			endNetRequest(ok);
			dispatchFetchEvent(result);
			return result;
		};
		if (!trimmedUrl) return finishFetch(false, 0, null, "Missing request URL");
		let status = 0;
		try {
			if (typeof fetch !== "function") throw new Error("Global fetch() is unavailable in this environment");
			const fetchInit = { method };
			if (method !== "GET" && method !== "HEAD" && (method === "POST" || declarativeBodySource !== void 0 || options?.body !== void 0)) {
				if (persistTimeout !== null) flushPersistence(true);
				const payload = declarativeBodySource !== void 0 ? resolveDeclarativeBodySource(declarativeBodySource) : resolveProgrammaticBody(options?.body);
				const mergedHeaders = {};
				let hasContentType = false;
				if (options?.headers) for (const [hk, hv] of Object.entries(options.headers)) {
					mergedHeaders[hk] = hv;
					if (hk.toLowerCase() === "content-type") hasContentType = true;
				}
				if (!hasContentType) mergedHeaders["Content-Type"] = "text/plain;charset=UTF-8";
				fetchInit.headers = mergedHeaders;
				fetchInit.body = payload;
			} else if (options?.headers && Object.keys(options.headers).length > 0) fetchInit.headers = { ...options.headers };
			if (options?.mode) fetchInit.mode = options.mode;
			if (options?.signal) fetchInit.signal = options.signal;
			const res = await fetch(trimmedUrl, fetchInit);
			status = res.status;
			if (!isCurrentEpoch(epoch)) return buildStaleFetchResult(status);
			if (options?.mode === "no-cors" && target === null && res.type === "opaque") return finishFetch(true, 0, null, null);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const rawText = await res.text();
			if (!isCurrentEpoch(epoch)) return buildStaleFetchResult(status);
			const contentType = (res.headers?.get?.("content-type") ?? "").toLowerCase();
			const mustParseJson = target !== null && (target === "db" || target.startsWith("field:") || target.startsWith("list:") || target.startsWith("custom:")) || rawPath.length > 0;
			let parsed;
			if (target === null && rawText.trim() === "" && rawPath.length === 0) parsed = null;
			else if (mustParseJson || contentType.includes("json")) try {
				parsed = JSON.parse(rawText);
			} catch {
				throw new Error("Invalid JSON response");
			}
			else parsed = rawText;
			let extracted = parsed;
			if (rawPath.length > 0) {
				const pathRes = extractByDotPath(parsed, rawPath);
				if (!pathRes.ok) throw new Error(`Path "${rawPath}" not found in response`);
				extracted = pathRes.value;
			}
			routeFetchPayload(target, extracted);
			return finishFetch(true, status, extracted, null);
		} catch (err) {
			if (!isCurrentEpoch(epoch)) return buildStaleFetchResult(status);
			return finishFetch(false, status, null, err instanceof Error ? err.message : String(err));
		}
	}
	function getDeclarativeRequestConfig(el) {
		if (isIgnoredElement(el)) return null;
		const getUrl = getAttr(el, "naizo-get");
		const postUrl = getAttr(el, "naizo-post");
		if (getUrl === null && postUrl === null) return null;
		const method = getUrl !== null ? "GET" : "POST";
		const url = (getUrl ?? postUrl ?? "").trim();
		const intoAttr = getAttr(el, "naizo-into");
		const pathAttr = getAttr(el, "naizo-path");
		const bodyAttr = getAttr(el, "naizo-body");
		const corsAttr = (getAttr(el, "naizo-cors") ?? "").trim().toLowerCase();
		const triggerRaw = (getAttr(el, "naizo-trigger") ?? "click").trim().toLowerCase();
		const trigger = triggerRaw === "init" ? "init" : triggerRaw === "load" ? "load" : "click";
		return {
			url,
			method,
			into: intoAttr !== null ? intoAttr : void 0,
			path: pathAttr !== null ? pathAttr : void 0,
			bodySource: bodyAttr !== null && bodyAttr.trim().length > 0 ? bodyAttr.trim() : void 0,
			mode: corsAttr === "no-cors" ? "no-cors" : void 0,
			trigger
		};
	}
	async function triggerDeclarativeRequest(el, applyDisabledGuard) {
		const cfg = getDeclarativeRequestConfig(el);
		if (!cfg) return null;
		if (el.getAttribute("data-naizo-loading") === "true") return null;
		const reqEpoch = initEpoch;
		el.setAttribute("data-naizo-loading", "true");
		let addedDisabled = false;
		if (applyDisabledGuard) {
			if (!(el.hasAttribute("disabled") || "disabled" in el && Boolean(el.disabled))) {
				el.setAttribute("data-naizo-loading-disabled", "true");
				addedDisabled = true;
				if ("disabled" in el) el.disabled = true;
				else el.setAttribute("disabled", "");
			}
		}
		try {
			return await executeFetch(cfg.url, {
				method: cfg.method,
				into: cfg.into ?? (cfg.method === "GET" ? "db" : void 0),
				path: cfg.path,
				mode: cfg.mode
			}, cfg.method === "POST" ? cfg.bodySource ?? "db" : void 0);
		} finally {
			if (isCurrentEpoch(reqEpoch)) {
				el.removeAttribute("data-naizo-loading");
				if (addedDisabled || el.hasAttribute("data-naizo-loading-disabled")) {
					el.removeAttribute("data-naizo-loading-disabled");
					if ("disabled" in el) el.disabled = false;
					el.removeAttribute("disabled");
				}
			}
		}
	}
	function runAutoTriggers(root = document) {
		if (isInvalidDbState()) return;
		const candidates = [];
		if (root instanceof Element && root.matches(API_REQUEST_SELECTOR)) candidates.push(root);
		root.querySelectorAll(API_REQUEST_SELECTOR).forEach((el) => {
			candidates.push(el);
		});
		for (const el of candidates) {
			if (autoTriggeredElements.has(el)) continue;
			const cfg = getDeclarativeRequestConfig(el);
			if (!cfg || cfg.trigger === "click") continue;
			autoTriggeredElements.add(el);
			if (cfg.trigger === "load") triggerDeclarativeRequest(el, false);
			else if (cfg.trigger === "init") {
				if (isInitTargetEmpty(cfg.into !== void 0 && cfg.into.trim().length > 0 ? cfg.into.trim() : null, cfg.method)) triggerDeclarativeRequest(el, false);
			}
		}
	}
	function resolveClickedAddListEl(addBtn, listName) {
		const ancestorList = addBtn.closest(LIST_SELECTOR);
		if (ancestorList && getAttr(ancestorList, "naizo-list") === listName) return ancestorList;
		let prev = addBtn.closest(".naizo-list-footer")?.previousElementSibling ?? null;
		while (prev?.classList.contains("naizo-list-footer")) prev = prev.previousElementSibling;
		if (prev instanceof HTMLElement) {
			if (prev.matches(LIST_SELECTOR) && getAttr(prev, "naizo-list") === listName) return prev;
			const escaped = escapeSelectorAttr(listName);
			const inner = prev.querySelector(`[naizo-list="${escaped}"], [data-naizo-list="${escaped}"]`);
			if (inner && !isIgnoredElement(inner)) return inner;
		}
		return findListElements(listName)[0] ?? null;
	}
	function handleListClicks(e) {
		const target = e.target;
		if (!target || typeof target.closest !== "function") return;
		const addBtn = target.closest("[naizo-add], [data-naizo-add]");
		if (addBtn) {
			const listName = getAttr(addBtn, "naizo-add");
			if (listName) addItemInternal(listName, {}, resolveClickedAddListEl(addBtn, listName));
			return;
		}
		const removeBtn = target.closest("[naizo-remove], [data-naizo-remove]");
		if (removeBtn) {
			const itemEl = removeBtn.closest(ITEM_SELECTOR);
			const listEl = itemEl?.closest(LIST_SELECTOR);
			if (itemEl && listEl) {
				const listName = getAttr(listEl, "naizo-list");
				const idx = listName ? resolveListItemIndex(listEl, listName, itemEl).idx : -1;
				const listArr = listName ? getOwn(ensureStore().lists, listName) : void 0;
				if (listName && Array.isArray(listArr) && idx >= 0 && idx < listArr.length) Naizo.removeItem(listName, idx);
				else itemEl.remove();
			}
			return;
		}
		const moveBtn = target.closest("[naizo-move], [data-naizo-move]");
		if (moveBtn) {
			const dir = getAttr(moveBtn, "naizo-move");
			const itemEl = moveBtn.closest(ITEM_SELECTOR);
			const listEl = itemEl?.closest(LIST_SELECTOR);
			if (!itemEl || !listEl) return;
			const listName = getAttr(listEl, "naizo-list");
			if (!listName) return;
			const { idx, total } = resolveListItemIndex(listEl, listName, itemEl);
			if (idx === -1) return;
			if (dir === "up" && idx > 0) Naizo.moveItem(listName, idx, idx - 1);
			else if (dir === "down" && idx < total - 1) Naizo.moveItem(listName, idx, idx + 1);
			return;
		}
		const reqEl = target.closest(API_REQUEST_SELECTOR);
		if (reqEl && !isIgnoredElement(reqEl)) {
			const cfg = getDeclarativeRequestConfig(reqEl);
			if (cfg && cfg.trigger === "click") {
				if (reqEl instanceof HTMLAnchorElement || reqEl instanceof HTMLButtonElement && reqEl.form !== null && reqEl.type === "submit") e.preventDefault();
				triggerDeclarativeRequest(reqEl, true);
			}
		}
	}
	const handledKeyEvents = /* @__PURE__ */ new WeakSet();
	function handleKeyDown(e) {
		if (e.defaultPrevented || handledKeyEvents.has(e)) return;
		if (e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && resetConfirmEl && resetConfirmEl.style.display !== "none") {
			handledKeyEvents.add(e);
			e.preventDefault();
			resetConfirmEl.style.display = "none";
			resetBtn?.focus();
			return;
		}
		if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
		if ((e.key ?? "").toLowerCase() !== "s") return;
		handledKeyEvents.add(e);
		e.preventDefault();
		const storedOk = flushPersistence(false);
		if (isInvalidDbState()) return;
		if (isOnlineMode()) {
			if (storedOk) {
				updateUi("saved", "✓ Saved in Browser");
				flashPillTooltip("✓ Saved in Browser", 1200);
			}
			return;
		}
		if (fileHandle && fileHandlePermission === "granted") {
			Naizo.save();
			return;
		}
		connectOrResumeDisk();
	}
	function flushPendingOnHide() {
		const hadPendingPersist = persistTimeout !== null;
		if (!hadPendingPersist && !(saveTimeout !== null)) return;
		if (hadPendingPersist) flushPersistence(false);
		if (saveTimeout !== null) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		if (fileHandle && !isInvalidDbState()) writeToDisk();
	}
	function handleStorageEvent(e) {
		if (!e.key) return;
		if (writeInFlightPromise !== null || isInvalidDbState()) return;
		if (e.key === getSnapshotKey()) {
			if (!e.newValue) return;
			const incomingRootHash = extractRootDiskHash(e.newValue);
			const currentRootHash = fnv1aStringHash(canonicalContentBuckets(ensureStore()));
			if (incomingRootHash && incomingRootHash === currentRootHash) {
				lastKnownDiskRaw = serializeDbJson(ensureStore()).trim();
				lastDiskDb = cloneDb(ensureStore());
				initialDiskDb = cloneDb(lastDiskDb);
				if (saveTimeout !== null) {
					clearTimeout(saveTimeout);
					saveTimeout = null;
				}
				if (!isOnlineMode()) updateUi("saved", "Synced to Disk");
			}
			return;
		}
		if (e.key !== getPageKey()) return;
		const syncStorageUi = (mergedCollision) => {
			if (mergedCollision) updateUi("conflict", "External Disk Edit · Conflict Backed Up");
			else if (!fileHandle) updateUnlinkedStatusUi(true);
			else if (fileHandlePermission !== "granted") updateUi("needs-permission", "Resume Disk Sync");
			else if (lastDiskDb === null || canonicalContentBuckets(store) !== canonicalContentBuckets(lastDiskDb)) updateUi("cached", "Browser Cache · Pending Sync");
			else updateUi("saved", "Synced to Disk");
		};
		if (e.newValue === null) {
			if (!initialDiskDb) return;
			if (persistTimeout !== null) {
				clearTimeout(persistTimeout);
				persistTimeout = null;
			}
			if (saveTimeout !== null) {
				clearTimeout(saveTimeout);
				saveTimeout = null;
			}
			store = cloneDb(initialDiskDb);
			storeInitialized = true;
			lastSerializedContent = serializeContentBuckets(store);
			hydrateSubtreeFromStore(document, false, false);
			writeStoreToDomScript(store, false);
			syncStorageUi(false);
			window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
			return;
		}
		const incomingDb = parseCachedState(e.newValue);
		if (!incomingDb) return;
		let mergedCollision = false;
		if (persistTimeout !== null) {
			const currentBrowserDb = cloneDb(ensureStore());
			const oldDb = e.oldValue ? parseCachedState(e.oldValue) : null;
			const storedSnap = safeGetStorage(getSnapshotKey());
			const storedManifest = storedSnap ? extractKeyHashManifest(storedSnap) : null;
			const { merged, hasCollision, browserKeptKeys } = shallowMergeDatabases(oldDb ? buildDbKeyHashMap(oldDb) : storedManifest ?? (lastDiskDb ? buildDbKeyHashMap(lastDiskDb) : null), currentBrowserDb, incomingDb, oldDb ?? (!storedManifest ? lastDiskDb : null));
			mergedCollision = hasCollision;
			if (hasCollision) safeSetStorage(getBackupKey(), JSON.stringify(currentBrowserDb));
			store = merged;
			if (browserKeptKeys) schedulePersist();
			else {
				clearTimeout(persistTimeout);
				persistTimeout = null;
			}
		} else store = cloneDb(incomingDb);
		storeInitialized = true;
		lastSerializedContent = serializeContentBuckets(store);
		hydrateSubtreeFromStore(document, true, false);
		writeStoreToDomScript(store, false);
		syncStorageUi(mergedCollision);
		window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
	}
	function detachListeners() {
		initEpoch += 1;
		stopDiskWatch();
		writeInFlightPromise = null;
		writeQueued = false;
		if (persistTimeout !== null) {
			clearTimeout(persistTimeout);
			persistTimeout = null;
		}
		if (saveTimeout !== null) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		if (netHoldTimeout !== null) {
			clearTimeout(netHoldTimeout);
			netHoldTimeout = null;
		}
		netInFlightCount = 0;
		netPendingError = false;
		netState = "idle";
		if (typeof document !== "undefined") stripLoadingStateAttrs(document);
		teardownUiTimersAndObservers();
		resetChangeDispatchState();
		bootHydrated = false;
		if (listenerController !== null) {
			listenerController.abort();
			listenerController = null;
		}
	}
	function attachListeners() {
		if (typeof window !== "undefined" && typeof window.__naizoCleanup === "function" && window.__naizoCleanup !== detachListeners) window.__naizoCleanup();
		detachListeners();
		const controller = new AbortController();
		listenerController = controller;
		const { signal } = controller;
		document.addEventListener("click", handleListClicks, { signal });
		document.addEventListener("input", handleInputOrChange, { signal });
		document.addEventListener("change", handleInputOrChange, { signal });
		document.addEventListener("toggle", handleInputOrChange, {
			capture: true,
			signal
		});
		document.addEventListener("reset", handleFormReset, { signal });
		document.addEventListener("keydown", handleKeyDown, { signal });
		window.addEventListener("keydown", handleKeyDown, { signal });
		window.addEventListener("storage", handleStorageEvent, { signal });
		window.addEventListener("focus", () => {
			checkDiskForExternalChanges();
		}, { signal });
		window.addEventListener("pagehide", () => {
			flushPendingOnHide();
		}, { signal });
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") flushPendingOnHide();
			else if (document.visibilityState === "visible") checkDiskForExternalChanges();
		}, { signal });
		if (typeof window !== "undefined") window.__naizoCleanup = detachListeners;
	}
	const Naizo = {
		init: initNaizo,
		ready(callback) {
			if (typeof callback !== "function") return;
			if (bootHydrated) {
				callback(ensureStore());
				return;
			}
			if (typeof window === "undefined") return;
			window.addEventListener("naizo:hydrate", () => {
				callback(ensureStore());
			}, { once: true });
		},
		batch(fn, options) {
			if (batchDepth === 0) {
				batchDirty = false;
				batchAllSilent = true;
				batchDeferPersist = true;
			}
			batchDepth += 1;
			if (options?.silent) batchSilentDepth += 1;
			if (options?.deferPersist) batchDeferDepth += 1;
			try {
				return fn();
			} finally {
				if (options?.silent) batchSilentDepth = Math.max(0, batchSilentDepth - 1);
				if (options?.deferPersist) batchDeferDepth = Math.max(0, batchDeferDepth - 1);
				batchDepth = Math.max(0, batchDepth - 1);
				if (batchDepth === 0) {
					const wasDirty = batchDirty;
					const shouldSilence = Boolean(options?.silent) || batchAllSilent;
					const shouldDefer = Boolean(options?.deferPersist) || batchDeferPersist;
					batchDirty = false;
					batchAllSilent = true;
					batchDeferPersist = true;
					if (wasDirty) {
						if (shouldDefer) schedulePersist();
						else flushPersistence(true);
						if (!shouldSilence) dispatchChangeEvent({
							scope: "batch",
							action: "batch",
							source: "api"
						});
					}
				}
			}
		},
		get(key) {
			const db = ensureStore();
			if (key === void 0) return db;
			return getOwn(db.custom, key);
		},
		set(key, value) {
			if (!key || !isValidJsonValue(value)) {
				console.warn("[naizo.js] Rejected invalid custom key or non-JSON value:", key);
				return;
			}
			const db = ensureStore();
			const cloned = cloneJsonValue(value);
			setOwn(db.custom, key, cloned);
			persistStoreMutation();
			dispatchChangeEvent({
				scope: "custom",
				key,
				value: cloned,
				source: "api"
			});
		},
		delete(key) {
			if (!key) return;
			const db = ensureStore();
			if (!hasOwn(db.custom, key)) return;
			deleteOwn(db.custom, key);
			persistStoreMutation();
			dispatchChangeEvent({
				scope: "custom",
				action: "delete",
				key,
				source: "api"
			});
		},
		getField(key) {
			return getOwn(ensureStore().fields, key);
		},
		setField(key, value) {
			if (!key || !isValidJsonValue(value)) {
				console.warn("[naizo.js] Rejected invalid field key or non-JSON value:", key);
				return;
			}
			const db = ensureStore();
			const cloned = cloneJsonValue(value);
			setOwn(db.fields, key, cloned);
			propagateStandaloneKey(key, cloned);
			persistStoreMutation();
			dispatchChangeEvent({
				scope: "fields",
				key,
				value: cloned,
				source: "api"
			});
		},
		deleteField(key) {
			if (!key) return;
			const db = ensureStore();
			if (!hasOwn(db.fields, key)) return;
			deleteOwn(db.fields, key);
			document.querySelectorAll(getKeyBoundSelector(key)).forEach((el) => {
				if (isIgnoredElement(el) || el.closest(ITEM_SELECTOR) || isSkippedElement(el, true)) return;
				clearElementValue(el);
			});
			persistStoreMutation();
			dispatchChangeEvent({
				scope: "fields",
				action: "delete",
				key,
				source: "api"
			});
		},
		getList(listName) {
			const arr = getOwn(ensureStore().lists, listName);
			return Array.isArray(arr) ? arr : [];
		},
		setList(listName, items) {
			if (!listName || !Array.isArray(items) || !isValidJsonValue(items) || !items.every((item) => isPlainObject(item))) {
				console.warn("[naizo.js] Rejected invalid setList data for:", listName);
				return;
			}
			const db = ensureStore();
			const clonedItems = items.map((item) => cloneRecord(item));
			setOwn(db.lists, listName, clonedItems);
			renderListFromStore(listName);
			persistStoreMutation();
			dispatchChangeEvent({
				scope: "lists",
				action: "set",
				list: listName,
				value: clonedItems,
				source: "api"
			});
		},
		addItem(listName, itemData = {}) {
			addItemInternal(listName, itemData, null);
		},
		updateItem(listName, index, partialData) {
			if (!listName || !isPlainObject(partialData) || !isValidJsonValue(partialData)) {
				console.warn("[naizo.js] Rejected invalid updateItem data for:", listName);
				return;
			}
			const listArr = getOwn(ensureStore().lists, listName);
			if (!Number.isInteger(index) || !Array.isArray(listArr) || index < 0 || index >= listArr.length) return;
			const rowObj = listArr[index];
			if (!isPlainObject(rowObj)) return;
			const matchedRows = findListElements(listName).map((listEl) => findRowElementInList(listEl, rowObj, index)).filter((el) => el !== void 0);
			for (const key of Object.keys(partialData)) {
				const val = cloneJsonValue(getOwn(partialData, key));
				setOwn(rowObj, key, val);
				for (const itemEl of matchedRows) propagateItemKey(itemEl, key, val);
			}
			persistStoreMutation();
			dispatchChangeEvent({
				scope: "lists",
				action: "update",
				list: listName,
				index,
				value: rowObj,
				source: "api"
			});
		},
		removeItem(listName, index) {
			if (!listName || !Number.isInteger(index)) return;
			const listArr = getOwn(ensureStore().lists, listName);
			if (!Array.isArray(listArr) || index < 0 || index >= listArr.length) return;
			const removedObj = listArr[index];
			listArr.splice(index, 1);
			findListElements(listName).forEach((listEl) => {
				findRowElementInList(listEl, removedObj, index)?.remove();
			});
			persistStoreMutation();
			dispatchChangeEvent({
				scope: "lists",
				action: "remove",
				list: listName,
				index,
				source: "api"
			});
		},
		moveItem(listName, fromIndex, toIndex) {
			if (!listName || !Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex === toIndex) return;
			const listArr = getOwn(ensureStore().lists, listName);
			if (!Array.isArray(listArr) || fromIndex < 0 || fromIndex >= listArr.length || toIndex < 0 || toIndex >= listArr.length) return;
			const [moved] = listArr.splice(fromIndex, 1);
			const movedObj = moved;
			if (moved) listArr.splice(toIndex, 0, moved);
			findListElements(listName).forEach((listEl) => {
				const rows = Array.from(listEl.querySelectorAll(DIRECT_ITEM_SELECTOR));
				const fromEl = movedObj ? rows.find((r) => itemDataMap.get(r) === movedObj) ?? rows[fromIndex] : rows[fromIndex];
				if (!fromEl) return;
				if (movedObj) {
					const nextObj = listArr[toIndex + 1];
					if (nextObj) {
						const nextEl = rows.find((r) => r !== fromEl && itemDataMap.get(r) === nextObj);
						if (nextEl) {
							listEl.insertBefore(fromEl, nextEl);
							return;
						}
					} else {
						const lastRow = rows[rows.length - 1];
						if (lastRow) {
							if (lastRow !== fromEl) listEl.insertBefore(fromEl, lastRow.nextSibling);
							return;
						}
					}
				}
				const targetEl = rows[toIndex];
				if (targetEl && targetEl !== fromEl) listEl.insertBefore(fromEl, fromIndex < toIndex ? targetEl.nextSibling : targetEl);
			});
			persistStoreMutation();
			dispatchChangeEvent({
				scope: "lists",
				action: "move",
				list: listName,
				fromIndex,
				toIndex,
				source: "api"
			});
		},
		bind(root = document) {
			const db = ensureStore();
			const beforeContent = serializeContentBuckets(db);
			hydrateSubtreeFromStore(root, false);
			syncNetVisibility(root);
			runAutoTriggers(root);
			if (serializeContentBuckets(db) !== beforeContent) schedulePersist();
		},
		fetch(url, options) {
			return executeFetch(url, options);
		},
		async save() {
			if (saveTimeout !== null) {
				clearTimeout(saveTimeout);
				saveTimeout = null;
			}
			const cachedOk = flushPersistence(false);
			if (fileHandle) return await writeToDisk();
			return cachedOk;
		},
		reset() {
			if (persistTimeout !== null) {
				clearTimeout(persistTimeout);
				persistTimeout = null;
			}
			if (saveTimeout !== null) {
				clearTimeout(saveTimeout);
				saveTimeout = null;
			}
			if (isInvalidDbState() || !initialDiskDb) return;
			if (isDirtyFromInitial()) safeSetStorage(getBackupKey(), JSON.stringify(ensureStore()));
			store = cloneDb(initialDiskDb);
			storeInitialized = true;
			safeRemoveStorage(getPageKey());
			hydrateSubtreeFromStore(document, false, false);
			lastSerializedContent = serializeContentBuckets(store);
			writeStoreToDomScript(store, false);
			if (fileHandle) {
				if (fileHandlePermission === "granted") scheduleDiskWrite();
				else updateUi("needs-permission", "Resume Disk Sync");
			} else updateUnlinkedStatusUi(true);
			if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
			dispatchChangeEvent({
				scope: "reset",
				source: "api"
			});
		},
		link() {
			return connectOrResumeDisk();
		},
		async unlink() {
			const epoch = initEpoch;
			const pageKeyAtUnlink = getPageKey();
			stopDiskWatch();
			if (saveTimeout !== null) {
				clearTimeout(saveTimeout);
				saveTimeout = null;
			}
			fileHandle = null;
			fileHandlePermission = "prompt";
			lastObservedModified = null;
			overwriteDiskWithoutMerge = false;
			repairingDiskInvalidDb = false;
			confirmedMissingDbInject = false;
			pendingInitialLinkFile = null;
			let storedOk = true;
			if (liveDiskInvalidJson) {
				liveDiskInvalidJson = false;
				const db = ensureStore();
				writeStoreToDomScript(db, false);
				storedOk = safeSetStorage(pageKeyAtUnlink, JSON.stringify(db));
			}
			if (startupInvalidDb) updateUi("error", "Invalid #naizodb JSON");
			else updateUnlinkedStatusUi(storedOk);
			await deleteHandleFromIDB(pageKeyAtUnlink);
			if (!isCurrentEpoch(epoch) || fileHandle !== null) return;
		},
		async copyJSON() {
			flushPersistence(false);
			const json = serializeDbJson(ensureStore());
			try {
				await navigator.clipboard?.writeText(json);
			} catch {}
			return json;
		},
		exportHTML() {
			return getCleanHtmlString(isOnlineMode());
		},
		downloadHTML(filename) {
			const html = getCleanHtmlString(true);
			if (startupInvalidDb) return html;
			const suggested = filename && filename.trim() ? filename.trim() : getSuggestedFilename();
			const finalName = /\.html?$/i.test(suggested) ? suggested : `${suggested}.html`;
			if (typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
				const blob = new Blob([html], { type: "text/html" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = finalName;
				a.click();
				URL.revokeObjectURL(url);
			}
			if (!liveDiskInvalidJson) {
				if (isOnlineMode()) updateUi("saved", "Saved to PC · Ready for Local Mode");
				else {
					if (!fileHandle) updateUi("cached", "Browser Cache · Click to Link Disk");
					flashPillTooltip("✓ Downloaded HTML Snapshot", 1200);
				}
			}
			return html;
		}
	};
	const NaizoDB = Naizo;
	async function loadAndQueryPersistedHandle(epoch, pageKey) {
		const loadedHandle = await loadHandleFromIDB(pageKey);
		if (!isCurrentEpoch(epoch)) return { ok: false };
		if (loadedHandle && fileHandle === null) {
			fileHandle = loadedHandle;
			try {
				const perm = await loadedHandle.queryPermission({ mode: "readwrite" });
				if (!isCurrentEpoch(epoch)) return { ok: false };
				if (!isCurrentHandle(epoch, loadedHandle)) return {
					ok: true,
					loaded: false
				};
				fileHandlePermission = perm;
				return {
					ok: true,
					loaded: true,
					handle: loadedHandle,
					perm
				};
			} catch {
				if (!isCurrentEpoch(epoch)) return { ok: false };
				if (!isCurrentHandle(epoch, loadedHandle)) return {
					ok: true,
					loaded: false
				};
				fileHandlePermission = "prompt";
				return {
					ok: true,
					loaded: true,
					handle: loadedHandle,
					perm: "prompt"
				};
			}
		}
		return {
			ok: true,
			loaded: false
		};
	}
	async function initNaizo() {
		store = createEmptyDb();
		storeInitialized = false;
		bootHydrated = false;
		startupInvalidDb = false;
		liveDiskInvalidJson = false;
		repairingDiskInvalidDb = false;
		overwriteDiskWithoutMerge = false;
		confirmedMissingDbInject = false;
		lastExternalCheckHadConflict = false;
		pendingInitialLinkFile = null;
		resetChangeDispatchState();
		batchDepth = 0;
		batchSilentDepth = 0;
		batchDeferDepth = 0;
		batchDirty = false;
		batchAllSilent = true;
		batchDeferPersist = true;
		trackedDbScriptEl = null;
		lastSerializedContent = "";
		lastKnownDiskRaw = null;
		lastDiskDb = null;
		initialDiskDb = null;
		lastObservedModified = null;
		itemDataMap = /* @__PURE__ */ new WeakMap();
		fileHandle = null;
		fileHandlePermission = "prompt";
		writeInFlightPromise = null;
		writeQueued = false;
		netRevealed = false;
		netState = "idle";
		netInFlightCount = 0;
		netActiveStartMs = 0;
		netPendingError = false;
		autoTriggeredElements = /* @__PURE__ */ new WeakSet();
		attachListeners();
		const currentInitEpoch = initEpoch;
		mountUi();
		ensureListBlueprints(document, true);
		syncNetVisibility(document);
		const scriptEl = getDbScript();
		trackedDbScriptEl = scriptEl;
		const currentDiskRaw = scriptEl.textContent?.trim() ?? "";
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
			safeSetStorage(getRawBackupKey(), currentDiskRaw);
			if (cachedState) hydrateSubtreeFromStore(document, false);
			else queryListElements(document).forEach((listEl) => decorateListControls(listEl));
			if (isNoPillMode()) console.warn("[naizo.js] <script id=\"naizodb\"> contains invalid JSON; automatic writes are paused to prevent data loss. Remove naizo-no-pill / data-naizo-no-pill to expose the Repair JSON control.");
			updateUi("error", "Invalid #naizodb JSON");
			bootHydrated = true;
			window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
			const invalidHandleRes = await loadAndQueryPersistedHandle(currentInitEpoch, pageKey);
			if (!invalidHandleRes.ok) return;
			if (invalidHandleRes.loaded) {
				if (isInvalidDbState()) updateUi("error", "Invalid #naizodb JSON");
				else if (invalidHandleRes.perm === "granted") {
					startDiskWatch();
					if (repairingDiskInvalidDb) {
						updateUi("saving", "Saving...");
						writeToDisk();
					} else updateUi("cached", "Browser Cache · Pending Sync");
				} else updateUi("needs-permission", "Resume Disk Sync");
			}
			return;
		}
		startupInvalidDb = false;
		lastKnownDiskRaw = currentDiskRaw;
		lastDiskDb = cloneDb(diskDetailed.db);
		initialDiskDb = buildInitialBaselineDb(diskDetailed.db);
		const currentDiskHashManifest = hashCanonicalDb(currentDiskRaw);
		const diskModifiedExternally = storedDiskSnapshot !== null && extractRootDiskHash(currentDiskHashManifest) !== extractRootDiskHash(storedDiskSnapshot);
		let hasBootConflict = false;
		if (diskModifiedExternally && cachedState) {
			const { merged, hasCollision } = shallowMergeDatabases(extractKeyHashManifest(storedDiskSnapshot), cachedState, diskDetailed.db);
			if (hasCollision) {
				safeSetStorage(getBackupKey(), JSON.stringify(cachedState));
				hasBootConflict = true;
			}
			store = merged;
		} else if (!cachedState) store = cloneDb(diskDetailed.db);
		else store = cloneDb(cachedState);
		storeInitialized = true;
		lastSerializedContent = serializeContentBuckets(store);
		hydrateSubtreeFromStore(document, false, true);
		writeStoreToDomScript(store, false);
		const storedOk = safeSetStorage(pageKey, JSON.stringify(store));
		if (diskModifiedExternally || !cachedState || storedDiskSnapshot === null) safeSetStorage(snapshotKey, currentDiskHashManifest);
		if (hasBootConflict) updateUi("conflict", "External Disk Edit · Conflict Backed Up");
		else updateUnlinkedStatusUi(storedOk);
		bootHydrated = true;
		window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
		const validHandleRes = await loadAndQueryPersistedHandle(currentInitEpoch, pageKey);
		if (!validHandleRes.ok) return;
		if (validHandleRes.loaded) {
			if (validHandleRes.perm === "granted") {
				startDiskWatch();
				await checkDiskForExternalChanges();
				if (!isCurrentEpoch(currentInitEpoch)) return;
				if (isCurrentHandle(currentInitEpoch, validHandleRes.handle) && !isInvalidDbState()) {
					const isDirtyComparedToDisk = lastDiskDb === null || canonicalContentBuckets(ensureStore()) !== canonicalContentBuckets(lastDiskDb);
					if (hasBootConflict || lastExternalCheckHadConflict) updateUi("conflict", "External Disk Edit · Conflict Backed Up");
					else if (isDirtyComparedToDisk) updateUi("cached", "Browser Cache · Click to Link Disk");
					else updateUi("saved", "Synced to Disk");
				}
			} else updateUi("needs-permission", "Resume Disk Sync");
		}
		runAutoTriggers(document);
	}
	//#endregion
	//#region src/iife.ts
	/**
	* naizo.js — Browser IIFE Entrypoint
	* Attaches window.Naizo / window.NaizoDB and auto-initializes unless opted out via data-naizo-manual / naizo-manual.
	* License: MIT
	*/
	function hasManualOptOut() {
		if (typeof document === "undefined") return true;
		const docEl = document.documentElement;
		const bodyEl = document.body;
		const currentScript = document.currentScript;
		return Boolean(docEl?.hasAttribute("data-naizo-manual") || docEl?.hasAttribute("naizo-manual") || bodyEl?.hasAttribute("data-naizo-manual") || bodyEl?.hasAttribute("naizo-manual") || currentScript?.hasAttribute("data-naizo-manual") || currentScript?.hasAttribute("naizo-manual") || document.querySelector("script[data-naizo-manual], script[naizo-manual]"));
	}
	if (typeof window !== "undefined" && typeof document !== "undefined") {
		window.Naizo = Naizo;
		window.NaizoDB = NaizoDB;
		const start = () => {
			if (!hasManualOptOut()) initNaizo();
		};
		if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
		else start();
	}
	//#endregion
})();
