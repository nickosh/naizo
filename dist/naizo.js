(function() {
	//#region src/index.ts
	const DB_ID = "naizodb";
	const UI_ID = "__naizodb_host__";
	const STYLE_ID = "__naizodb_styles__";
	const IDB_NAME = "NaizoDB_Handles";
	const PERSIST_DEBOUNCE_MS = 150;
	const DISK_DEBOUNCE_MS = 250;
	const DISK_WATCH_INTERVAL_MS = 2e3;
	const NAIZODB_SCRIPT_RE = /(<script\b[^>]*\bid\s*=\s*(?:"naizodb"|'naizodb'|naizodb(?=[>\s/]))[^>]*>)([\s\S]*?)(<\/script>)/i;
	const HEAD_OPEN_RE = /(<head\b[^>]*>)/i;
	const BOUND_SELECTOR = "[naizo], [data-naizo], [data-naizo-field]";
	const LIST_SELECTOR = "[naizo-list], [data-naizo-list]";
	const ITEM_SELECTOR = "[naizo-item], [data-naizo-item]";
	const DIRECT_ITEM_SELECTOR = ":scope > [naizo-item], :scope > [data-naizo-item]";
	const TEMPLATE_SELECTOR = "template[naizo-template], template[data-naizo-template], template";
	const AUTHORED_TEMPLATE_SELECTOR = ":scope > template[naizo-template]:not([data-naizo-auto-template]), :scope > template[data-naizo-template]:not([data-naizo-auto-template]), :scope > template:not([data-naizo-auto-template])";
	const AUTO_TEMPLATE_SELECTOR = ":scope > template[data-naizo-auto-template]";
	const IGNORE_SELECTOR = "[naizo-ignore], [data-naizo-ignore], [data-naizo-runtime]";
	const RUNTIME_STRIP_SELECTOR = `[data-naizo-runtime], #${UI_ID}, #${STYLE_ID}`;
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
		const attrId = document.documentElement?.getAttribute("naizo-id") ?? document.documentElement?.getAttribute("data-naizo-id") ?? document.body?.getAttribute("naizo-id") ?? document.body?.getAttribute("data-naizo-id");
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
	function getBackupKey() {
		return "naizodb_backup_" + getStorageSuffix();
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
	function findListElement(listName) {
		const escaped = escapeSelectorAttr(listName);
		return document.querySelector(`[naizo-list="${escaped}"], [data-naizo-list="${escaped}"]`);
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
	let store = createEmptyDb();
	let storeInitialized = false;
	let startupInvalidDb = false;
	let trackedDbScriptEl = null;
	let lastSerializedContent = "";
	let lastKnownDiskRaw = null;
	let lastDiskDb = null;
	let lastObservedModified = null;
	let itemDataMap = /* @__PURE__ */ new WeakMap();
	let fileHandle = null;
	let persistTimeout = null;
	let saveTimeout = null;
	let watchInterval = null;
	let writeInFlightPromise = null;
	let writeQueued = false;
	let statusEl = null;
	let actionBtn = null;
	let restoreBtn = null;
	let unlinkBtn = null;
	let listenersAttached = false;
	function idbStore(mode, callback) {
		try {
			if (typeof indexedDB === "undefined") return;
			const req = indexedDB.open(IDB_NAME, 1);
			req.onupgradeneeded = () => req.result.createObjectStore("handles");
			req.onsuccess = () => {
				callback(req.result.transaction("handles", mode).objectStore("handles"));
			};
		} catch {}
	}
	function saveHandleToIDB(handle) {
		idbStore("readwrite", (idb) => idb.put(handle, getPageKey()));
	}
	function deleteHandleFromIDB() {
		return new Promise((resolve) => {
			try {
				if (typeof indexedDB === "undefined") {
					resolve();
					return;
				}
				const req = indexedDB.open(IDB_NAME, 1);
				req.onupgradeneeded = () => req.result.createObjectStore("handles");
				req.onsuccess = () => {
					try {
						const delReq = req.result.transaction("handles", "readwrite").objectStore("handles").delete(getPageKey());
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
	function loadHandleFromIDB() {
		return new Promise((resolve) => {
			try {
				if (typeof indexedDB === "undefined") {
					resolve(null);
					return;
				}
				const req = indexedDB.open(IDB_NAME, 1);
				req.onupgradeneeded = () => req.result.createObjectStore("handles");
				req.onsuccess = () => {
					const getReq = req.result.transaction("handles", "readonly").objectStore("handles").get(getPageKey());
					getReq.onsuccess = () => resolve(getReq.result ?? null);
					getReq.onerror = () => resolve(null);
				};
				req.onerror = () => resolve(null);
			} catch {
				resolve(null);
			}
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
	function parseDbScriptDetailed(rawText) {
		const raw = (rawText ?? getDbScript().textContent ?? "").trim();
		if (!raw) return {
			ok: true,
			db: createEmptyDb(),
			raw
		};
		try {
			const validated = validateAndNormalizeDb(JSON.parse(raw));
			if (!validated) {
				console.warn("[naizo.js] Invalid database shape in #naizodb.");
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
			console.warn("[naizo.js] Invalid JSON in #naizodb, resetting.", e);
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
	function normalizeJsonComparison(raw) {
		const trimmed = raw.trim();
		if (!trimmed) return "";
		try {
			const parsed = JSON.parse(trimmed);
			const validated = validateAndNormalizeDb(parsed);
			if (validated) return serializeContentBuckets(validated);
			return JSON.stringify(parsed);
		} catch {
			return trimmed;
		}
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
		const key = el.getAttribute("naizo") ?? el.getAttribute("data-naizo") ?? el.getAttribute("data-naizo-field");
		return key && key.length > 0 ? key : null;
	}
	function isIgnoredElement(el) {
		return Boolean(el.closest(`${IGNORE_SELECTOR}, template, #${UI_ID}`));
	}
	function isDetailsElement(el) {
		return typeof HTMLDetailsElement !== "undefined" && el instanceof HTMLDetailsElement || el.tagName.toLowerCase() === "details";
	}
	function isNonLeafElement(el) {
		if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement || isDetailsElement(el) || isContentEditableElement(el)) return false;
		return el.children.length > 0;
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
		return el.textContent ?? "";
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
		el.textContent = textVal;
	}
	function bakeClonedElementAttributes(liveEl, cloneEl) {
		if (isSkippedElement(liveEl)) return;
		if (liveEl instanceof HTMLInputElement && cloneEl instanceof HTMLInputElement) {
			const origRadioName = liveEl.getAttribute("data-naizo-radio-name");
			if (origRadioName !== null) {
				cloneEl.setAttribute("name", origRadioName);
				cloneEl.removeAttribute("data-naizo-radio-name");
			}
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
		if (isContentEditableElement(liveEl)) cloneEl.textContent = liveEl.textContent ?? "";
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
				if (el.options.length) el.selectedIndex = 0;
				Array.from(el.options).forEach((opt, i) => {
					if (i === 0) opt.setAttribute("selected", "selected");
					else opt.removeAttribute("selected");
				});
			}
		} else if (el instanceof HTMLTextAreaElement) {
			el.value = "";
			el.textContent = "";
		} else if (isDetailsElement(el)) {
			el.open = false;
			el.removeAttribute("open");
		} else if (!isNonLeafElement(el)) el.textContent = "";
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
	function propagateStandaloneKey(key, val, sourceEl) {
		queryStandaloneBoundElements(document).forEach((el) => {
			if (el === sourceEl) return;
			if (getElementKey(el) === key) writeElementValue(el, val);
		});
	}
	function propagateItemKey(itemEl, key, val, sourceEl) {
		queryItemBoundElements(itemEl).forEach((el) => {
			if (el === sourceEl) return;
			if (getElementKey(el) === key) writeElementValue(el, val);
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
	function ensureListBlueprints(root = document, forceRegenerateAuto = false) {
		const lists = [];
		if (root instanceof HTMLElement && root.matches(LIST_SELECTOR) && !isIgnoredElement(root)) lists.push(root);
		root.querySelectorAll(LIST_SELECTOR).forEach((el) => {
			if (!isIgnoredElement(el)) lists.push(el);
		});
		lists.forEach((listEl) => {
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
			cleanClone.querySelectorAll(IGNORE_SELECTOR).forEach((n) => n.remove());
			cleanClone.querySelectorAll("input[data-naizo-radio-name]").forEach((r) => {
				const orig = r.getAttribute("data-naizo-radio-name");
				if (orig !== null) r.setAttribute("name", orig);
				r.removeAttribute("data-naizo-radio-name");
			});
			if (cleanClone.matches(BOUND_SELECTOR)) clearElementValue(cleanClone);
			cleanClone.querySelectorAll(BOUND_SELECTOR).forEach(clearElementValue);
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
			tools.setAttribute("naizo-ignore", "true");
			tools.setAttribute("data-naizo-runtime", "true");
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
					td.setAttribute("naizo-ignore", "true");
					td.setAttribute("data-naizo-runtime", "true");
					td.appendChild(tools);
					itemEl.appendChild(td);
				}
			} else itemEl.appendChild(tools);
		});
		const escaped = escapeSelectorAttr(listName);
		if (!document.querySelector(`[naizo-add="${escaped}"], [data-naizo-add="${escaped}"]`)) {
			const addWrap = document.createElement("div");
			addWrap.className = "naizo-list-footer";
			addWrap.setAttribute("naizo-ignore", "true");
			addWrap.setAttribute("data-naizo-runtime", "true");
			addWrap.innerHTML = `<button type="button" class="naizo-add-btn" naizo-add="${listName}" aria-label="Add item to ${listName}">+ Add Item</button>`;
			const tag = listEl.tagName.toLowerCase();
			(tag === "tbody" || tag === "thead" || tag === "tfoot" ? listEl.closest("table") ?? listEl : listEl).insertAdjacentElement("afterend", addWrap);
		}
	}
	function bindItemElementToRecord(itemEl, rowObj, listName) {
		if (listName) scopeRowRadioInputs(itemEl, listName);
		itemDataMap.set(itemEl, rowObj);
		queryItemBoundElements(itemEl).forEach((el) => {
			const key = getElementKey(el);
			if (!key) return;
			if (hasOwn(rowObj, key)) writeElementValue(el, getOwn(rowObj, key));
			else {
				const val = readElementValue(el);
				if (val !== void 0) setOwn(rowObj, key, val);
			}
		});
	}
	function createItemNode(listEl, itemData = {}) {
		const tpl = listEl.querySelector(TEMPLATE_SELECTOR);
		if (!tpl) return null;
		const fragment = tpl.content.cloneNode(true);
		const itemEl = fragment.querySelector(ITEM_SELECTOR) ?? fragment.firstElementChild;
		if (!itemEl) return null;
		bindItemElementToRecord(itemEl, itemData, getAttr(listEl, "naizo-list") ?? "list");
		return itemEl;
	}
	function renderListItems(listEl, itemsArray) {
		listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).forEach((el) => el.remove());
		itemsArray.forEach((itemData) => {
			const node = createItemNode(listEl, itemData);
			if (node) listEl.appendChild(node);
		});
		decorateListControls(listEl);
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
	function hydrateSubtreeFromStore(root = document, preserveActive = false) {
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
				if (val !== void 0) setOwn(db.fields, key, val);
			}
		});
		const lists = [];
		if (root instanceof HTMLElement && root.matches(LIST_SELECTOR) && !isIgnoredElement(root)) lists.push(root);
		root.querySelectorAll(LIST_SELECTOR).forEach((el) => {
			if (!isIgnoredElement(el)) lists.push(el);
		});
		lists.forEach((listEl) => {
			const listName = getAttr(listEl, "naizo-list");
			if (!listName) return;
			if (hasOwn(db.lists, listName) && Array.isArray(getOwn(db.lists, listName))) {
				const targetItems = getOwn(db.lists, listName);
				const currentRows = Array.from(listEl.querySelectorAll(DIRECT_ITEM_SELECTOR));
				if (preserveActive && isElementActive(listEl) && currentRows.length === targetItems.length) currentRows.forEach((rowEl, idx) => {
					const itemObj = targetItems[idx];
					if (!itemObj) return;
					itemDataMap.set(rowEl, itemObj);
					queryItemBoundElements(rowEl).forEach((el) => {
						if (isElementActive(el)) return;
						const key = getElementKey(el);
						if (key && hasOwn(itemObj, key)) writeElementValue(el, getOwn(itemObj, key));
					});
				});
				else renderListItems(listEl, targetItems);
			} else {
				const seededItems = [];
				listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).forEach((itemEl) => {
					const rowObj = {};
					bindItemElementToRecord(itemEl, rowObj, listName);
					seededItems.push(rowObj);
				});
				setOwn(db.lists, listName, seededItems);
				decorateListControls(listEl);
			}
		});
	}
	function getCleanHtmlString() {
		flushPersistence(false);
		const clone = document.documentElement.cloneNode(true);
		const liveBound = Array.from(document.documentElement.querySelectorAll(BOUND_SELECTOR));
		const cloneBound = Array.from(clone.querySelectorAll(BOUND_SELECTOR));
		for (let i = 0; i < liveBound.length; i += 1) {
			const liveEl = liveBound[i];
			const cloneEl = cloneBound[i];
			if (liveEl && cloneEl && !isIgnoredElement(liveEl)) bakeClonedElementAttributes(liveEl, cloneEl);
		}
		clone.querySelectorAll("input[data-naizo-radio-name]").forEach((r) => {
			const orig = r.getAttribute("data-naizo-radio-name");
			if (orig !== null) r.setAttribute("name", orig);
			r.removeAttribute("data-naizo-radio-name");
		});
		clone.querySelectorAll(LIST_SELECTOR).forEach((listEl) => {
			if (listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).length >= 1) listEl.querySelectorAll(AUTO_TEMPLATE_SELECTOR).forEach((tpl) => tpl.remove());
		});
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
	function extractDbScriptBody(htmlText) {
		const bodyText = htmlText.startsWith("﻿") ? htmlText.slice(1) : htmlText;
		const match = NAIZODB_SCRIPT_RE.exec(bodyText);
		return match ? match[2]?.trim() ?? "" : null;
	}
	function replaceDbScriptInHtml(fileText, formattedBlock) {
		const hasBom = fileText.startsWith("﻿");
		const bodyText = hasBom ? fileText.slice(1) : fileText;
		if (NAIZODB_SCRIPT_RE.test(bodyText)) {
			const replaced = bodyText.replace(NAIZODB_SCRIPT_RE, (_match, openTag, _inner, closeTag) => `${openTag}${formattedBlock}${closeTag}`);
			return {
				ok: true,
				html: (hasBom ? "﻿" : "") + replaced,
				missingBlock: false
			};
		}
		if (bodyText.trim() === "") return {
			ok: true,
			html: (hasBom ? "﻿" : "") + getCleanHtmlString(),
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
		if (HEAD_OPEN_RE.test(bodyText)) {
			const injected = bodyText.replace(HEAD_OPEN_RE, (headTag) => `${headTag}${scriptTag}`);
			return (hasBom ? "﻿" : "") + injected;
		}
		return (hasBom ? "﻿" : "") + `${scriptTag}\n${bodyText}`;
	}
	function shallowMergeDatabases(baseDb, browserDb, diskDb) {
		let hasCollision = false;
		let browserKeptKeys = false;
		const mergeBucket = (baseBucket, browserBucket, diskBucket) => {
			const out = {};
			const allKeys = /* @__PURE__ */ new Set([
				...baseBucket ? Object.keys(baseBucket) : [],
				...Object.keys(browserBucket),
				...Object.keys(diskBucket)
			]);
			for (const key of allKeys) {
				const baseVal = baseBucket && hasOwn(baseBucket, key) ? getOwn(baseBucket, key) : void 0;
				const browserVal = hasOwn(browserBucket, key) ? getOwn(browserBucket, key) : void 0;
				const diskVal = hasOwn(diskBucket, key) ? getOwn(diskBucket, key) : void 0;
				const baseSer = baseVal !== void 0 ? JSON.stringify(baseVal) : void 0;
				const browserSer = browserVal !== void 0 ? JSON.stringify(browserVal) : void 0;
				const diskSer = diskVal !== void 0 ? JSON.stringify(diskVal) : void 0;
				if (browserSer === diskSer) {
					if (diskVal !== void 0) setOwn(out, key, cloneJsonValue(diskVal));
					continue;
				}
				if (baseDb !== null) {
					const browserChanged = browserSer !== baseSer;
					const diskChanged = diskSer !== baseSer;
					if (browserChanged && !diskChanged) {
						browserKeptKeys = true;
						if (browserVal !== void 0) setOwn(out, key, cloneJsonValue(browserVal));
					} else if (!browserChanged && diskChanged) {
						if (diskVal !== void 0) setOwn(out, key, cloneJsonValue(diskVal));
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
		const mergedFields = mergeBucket(baseDb?.fields ?? null, browserDb.fields, diskDb.fields);
		const mergedLists = mergeBucket(baseDb?.lists ?? null, browserDb.lists, diskDb.lists);
		const mergedCustom = mergeBucket(baseDb?.custom ?? null, browserDb.custom, diskDb.custom);
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
		const { merged, hasCollision, browserKeptKeys } = shallowMergeDatabases(lastDiskDb, currentBrowserDb, diskDb);
		if (hasCollision) safeSetStorage(getBackupKey(), JSON.stringify(currentBrowserDb));
		store = merged;
		storeInitialized = true;
		lastSerializedContent = serializeContentBuckets(store);
		lastKnownDiskRaw = diskRaw.trim();
		lastDiskDb = cloneDb(diskDb);
		safeSetStorage(getSnapshotKey(), lastKnownDiskRaw);
		hydrateSubtreeFromStore(document, preserveActive);
		writeStoreToDomScript(store, false);
		safeSetStorage(getPageKey(), JSON.stringify(store));
		if (hasCollision) updateUi("conflict", "External Disk Edit · Conflict Backed Up");
		else if (fileHandle) updateUi(browserKeptKeys ? "cached" : "saved", browserKeptKeys ? "Browser Cache · Pending Sync" : "Synced to Disk");
		window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
		return {
			hasCollision,
			browserKeptKeys
		};
	}
	function restoreConflictBackup() {
		const backupDb = parseCachedState(safeGetStorage(getBackupKey()));
		if (!backupDb) return;
		safeRemoveStorage(getBackupKey());
		store = cloneDb(backupDb);
		storeInitialized = true;
		hydrateSubtreeFromStore(document, false);
		flushPersistence(true);
		window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
	}
	async function checkDiskForExternalChanges() {
		if (!fileHandle || typeof fileHandle.getFile !== "function" || startupInvalidDb) return false;
		if (writeInFlightPromise !== null) return false;
		try {
			if (await fileHandle.queryPermission({ mode: "readwrite" }) !== "granted") return false;
			const diskFile = await fileHandle.getFile();
			if (typeof diskFile.lastModified === "number" && lastObservedModified !== null && diskFile.lastModified === lastObservedModified) return false;
			const fileText = await readFileTextPreservingBom(diskFile);
			if (typeof diskFile.lastModified === "number") lastObservedModified = diskFile.lastModified;
			const diskScriptRaw = extractDbScriptBody(fileText);
			if (diskScriptRaw === null) return false;
			if (lastKnownDiskRaw !== null && normalizeJsonComparison(diskScriptRaw) === normalizeJsonComparison(lastKnownDiskRaw)) return false;
			const diskDetailed = parseDbScriptDetailed(diskScriptRaw);
			if (!diskDetailed.ok) return false;
			const { browserKeptKeys } = applyExternalDiskUpdate(diskDetailed.db, diskScriptRaw, true);
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
	async function performSingleDiskWrite() {
		if (!fileHandle || startupInvalidDb) return false;
		try {
			if (await fileHandle.queryPermission({ mode: "readwrite" }) !== "granted") {
				updateUi("needs-permission", "Resume Disk Sync");
				return false;
			}
			if (persistTimeout !== null) flushPersistence(false);
			let fileTextToWrite;
			let payloadToWrite;
			if (typeof fileHandle.getFile === "function") {
				const diskFile = await fileHandle.getFile();
				const existingFileText = await readFileTextPreservingBom(diskFile);
				const diskScriptRaw = extractDbScriptBody(existingFileText);
				if (diskScriptRaw !== null && lastKnownDiskRaw !== null && normalizeJsonComparison(diskScriptRaw) !== normalizeJsonComparison(lastKnownDiskRaw)) {
					const diskDetailed = parseDbScriptDetailed(diskScriptRaw);
					if (diskDetailed.ok) {
						const { browserKeptKeys } = applyExternalDiskUpdate(diskDetailed.db, diskScriptRaw, true);
						if (!browserKeptKeys) {
							if (typeof diskFile.lastModified === "number") lastObservedModified = diskFile.lastModified;
							return true;
						}
					}
				}
				payloadToWrite = serializeDbJson(ensureStore());
				const formattedBlock = "\n" + payloadToWrite + "\n";
				const replaced = replaceDbScriptInHtml(existingFileText, formattedBlock);
				if (replaced.missingBlock) {
					if (!(typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm("Selected file does not contain <script id=\"naizodb\">. Insert #naizodb into this file?") : false)) {
						console.warn("[naizo.js] Refusing to overwrite file without #naizodb block.");
						updateUi("error", "Target file lacks #naizodb");
						return false;
					}
					fileTextToWrite = injectDbScriptIntoHtml(existingFileText, formattedBlock);
				} else fileTextToWrite = replaced.html;
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
			if (writtenParsed.ok) lastDiskDb = cloneDb(writtenParsed.db);
			safeSetStorage(getSnapshotKey(), exactWrittenTrimmed);
			if (typeof fileHandle.getFile === "function") try {
				const updatedFile = await fileHandle.getFile();
				if (typeof updatedFile.lastModified === "number") lastObservedModified = updatedFile.lastModified;
			} catch {}
			if (serializeDbJson(ensureStore()).trim() !== exactWrittenTrimmed) {
				writeQueued = true;
				updateUi("cached", "Browser Cache · Pending Sync");
			} else updateUi("saved", "Synced to Disk");
			return true;
		} catch (err) {
			console.warn("[naizo.js] Disk write failed:", err);
			updateUi("cached", "Browser Cache · Click to Link Disk");
			return false;
		}
	}
	async function writeToDisk() {
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
	function scheduleDiskWrite() {
		if (!fileHandle || startupInvalidDb) return;
		updateUi("saving", "Saving...");
		if (saveTimeout !== null) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			saveTimeout = null;
			writeToDisk();
		}, DISK_DEBOUNCE_MS);
	}
	function flushPersistence(scheduleDisk = true) {
		if (persistTimeout !== null) {
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
		if (!fileHandle) {
			if (storedOk) updateUi("cached", "Browser Cache · Click to Link Disk");
			else updateUi("cached", "In-Memory Only · Link Disk");
			return storedOk;
		}
		if (scheduleDisk) scheduleDiskWrite();
		return storedOk;
	}
	function schedulePersist() {
		if (startupInvalidDb) return;
		if (persistTimeout !== null) clearTimeout(persistTimeout);
		persistTimeout = setTimeout(() => {
			persistTimeout = null;
			flushPersistence(true);
		}, PERSIST_DEBOUNCE_MS);
	}
	async function connectOrResumeDisk() {
		if (fileHandle) {
			if (await fileHandle.requestPermission({ mode: "readwrite" }) === "granted") {
				startDiskWatch();
				await writeToDisk();
				return;
			}
		}
		if (typeof window.showSaveFilePicker === "function") try {
			fileHandle = await window.showSaveFilePicker({
				suggestedName: location.pathname.split("/").pop() || "index.html",
				types: [{
					description: "HTML Document",
					accept: { "text/html": [".html"] }
				}]
			});
			saveHandleToIDB(fileHandle);
			startDiskWatch();
			await writeToDisk();
		} catch {}
		else {
			const blob = new Blob([getCleanHtmlString()], { type: "text/html" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = location.pathname.split("/").pop() || "index.html";
			a.click();
			URL.revokeObjectURL(url);
			updateUi("saved", "Downloaded HTML Snapshot");
		}
	}
	function dispatchChangeEvent(detail) {
		if (typeof window === "undefined") return;
		window.dispatchEvent(new CustomEvent("naizo:change", { detail: {
			...detail,
			db: store
		} }));
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
	function mountUi() {
		if (!document.getElementById(STYLE_ID)) {
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.setAttribute("naizo-ignore", "true");
			style.setAttribute("data-naizo-runtime", "true");
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
        [data-naizo-runtime], #__naizodb_host__, .naizo-item-tools, .naizo-list-footer {
          display: none !important;
        }
      }
    `;
			document.head.appendChild(style);
		}
		const existingHost = document.getElementById(UI_ID);
		if (existingHost) existingHost.remove();
		const host = document.createElement("div");
		host.id = UI_ID;
		host.setAttribute("naizo-ignore", "true");
		host.setAttribute("data-naizo-runtime", "true");
		const shadow = host.attachShadow({ mode: "open" });
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
      @media print {
        .pill { display: none !important; }
      }
    </style>
    <div class="pill" role="region" aria-label="naizo.js sync status">
      <span class="dot" id="dot" aria-hidden="true"></span>
      <span id="status" role="status" aria-live="polite">Browser Cache · Click to Link Disk</span>
      <button id="action" type="button" aria-label="Link disk file">Link Disk</button>
      <button id="restore" type="button" style="display: none" title="Restore browser state before disk conflict" aria-label="Restore conflict backup">↺ Restore</button>
      <button id="copy" type="button" title="Copy #naizodb JSON state" aria-label="Copy #naizodb JSON">📋 Copy</button>
      <button id="unlink" type="button" style="display: none" title="Forget linked disk file" aria-label="Unlink disk file">× Unlink</button>
    </div>
  `;
		statusEl = shadow.getElementById("status");
		actionBtn = shadow.getElementById("action");
		restoreBtn = shadow.getElementById("restore");
		unlinkBtn = shadow.getElementById("unlink");
		const dotEl = shadow.getElementById("dot");
		const copyBtn = shadow.getElementById("copy");
		actionBtn?.addEventListener("click", () => {
			connectOrResumeDisk();
		});
		restoreBtn?.addEventListener("click", () => {
			restoreConflictBackup();
		});
		copyBtn?.addEventListener("click", () => {
			Naizo.copyJSON().then(() => {
				copyBtn.textContent = "✓ Copied";
				setTimeout(() => {
					copyBtn.textContent = "📋 Copy";
				}, 1500);
			});
		});
		unlinkBtn?.addEventListener("click", () => {
			Naizo.unlink();
		});
		host._setDot = (state) => {
			if (dotEl) {
				const cls = state === "saved" ? "saved" : state === "saving" ? "saving" : state === "error" ? "error" : "";
				dotEl.className = cls ? `dot ${cls}` : "dot";
			}
		};
		document.body.appendChild(host);
	}
	function updateUi(state, message) {
		if (!statusEl || !actionBtn) return;
		statusEl.textContent = message;
		document.getElementById(UI_ID)?._setDot?.(state);
		if (state === "saved" || state === "error") actionBtn.style.display = "none";
		else if (state === "needs-permission") {
			actionBtn.style.display = "inline-block";
			actionBtn.textContent = "Resume Disk Sync";
		} else if (fileHandle) actionBtn.style.display = "none";
		else {
			actionBtn.style.display = "inline-block";
			actionBtn.textContent = "Link Disk";
		}
		if (restoreBtn) {
			const hasBackup = safeGetStorage(getBackupKey()) !== null;
			restoreBtn.style.display = hasBackup || state === "conflict" ? "inline-block" : "none";
		}
		if (unlinkBtn) unlinkBtn.style.display = fileHandle ? "inline-block" : "none";
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
			propagateItemKey(itemEl, key, nextVal, boundEl);
			const listEl = itemEl.closest(LIST_SELECTOR);
			dispatchChangeEvent({
				scope: "lists",
				list: listEl ? getAttr(listEl, "naizo-list") : null,
				key,
				value: nextVal
			});
			schedulePersist();
			return;
		}
		const exists = hasOwn(db.fields, key);
		if (!shouldUpdateStoredValue(getOwn(db.fields, key), nextVal, exists)) return;
		setOwn(db.fields, key, nextVal);
		propagateStandaloneKey(key, nextVal, boundEl);
		dispatchChangeEvent({
			scope: "fields",
			key,
			value: nextVal
		});
		schedulePersist();
	}
	function handleFormReset(e) {
		const form = e.target;
		if (!(form instanceof Element)) return;
		setTimeout(() => {
			const db = ensureStore();
			let changed = false;
			queryStandaloneBoundElements(form).forEach((el) => {
				const key = getElementKey(el);
				if (!key) return;
				const nextVal = readElementValue(el);
				if (nextVal === void 0) return;
				if (shouldUpdateStoredValue(getOwn(db.fields, key), nextVal, hasOwn(db.fields, key))) {
					setOwn(db.fields, key, nextVal);
					propagateStandaloneKey(key, nextVal, el);
					changed = true;
				}
			});
			form.querySelectorAll(ITEM_SELECTOR).forEach((itemEl) => {
				if (isIgnoredElement(itemEl)) return;
				const rowObj = getOrBindItemRecord(itemEl);
				if (!rowObj) return;
				queryItemBoundElements(itemEl).forEach((el) => {
					const key = getElementKey(el);
					if (!key) return;
					const nextVal = readElementValue(el);
					if (nextVal === void 0) return;
					if (shouldUpdateStoredValue(getOwn(rowObj, key), nextVal, hasOwn(rowObj, key))) {
						setOwn(rowObj, key, nextVal);
						propagateItemKey(itemEl, key, nextVal, el);
						changed = true;
					}
				});
			});
			if (changed) {
				dispatchChangeEvent({ scope: "reset" });
				flushPersistence(true);
			}
		}, 0);
	}
	function addItemInternal(listName, itemData, focusFirstInput) {
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
		const listEl = findListElement(listName);
		if (!listEl) {
			listArr.push(rowObj);
			dispatchChangeEvent({
				scope: "lists",
				action: "add",
				list: listName,
				index: listArr.length - 1,
				value: rowObj
			});
			flushPersistence(true);
			return;
		}
		ensureListBlueprints(listEl, false);
		const node = createItemNode(listEl, rowObj);
		if (node) {
			listEl.appendChild(node);
			listArr.push(rowObj);
			const index = listArr.length - 1;
			decorateListControls(listEl);
			Naizo.bind(node);
			dispatchItemEvent(listName, node, rowObj, index);
			dispatchChangeEvent({
				scope: "lists",
				action: "add",
				list: listName,
				index,
				value: rowObj
			});
			if (focusFirstInput) node.querySelector("input[type=\"text\"], [contenteditable=\"true\"], [contenteditable=\"\"], [contenteditable=\"plaintext-only\"], textarea")?.focus();
			flushPersistence(true);
		}
	}
	function handleListClicks(e) {
		const target = e.target;
		if (!target || typeof target.closest !== "function") return;
		const addBtn = target.closest("[naizo-add], [data-naizo-add]");
		if (addBtn) {
			const listName = getAttr(addBtn, "naizo-add");
			if (listName) addItemInternal(listName, {}, true);
			return;
		}
		const removeBtn = target.closest("[naizo-remove], [data-naizo-remove]");
		if (removeBtn) {
			const itemEl = removeBtn.closest(ITEM_SELECTOR);
			const listEl = itemEl?.closest(LIST_SELECTOR);
			if (itemEl && listEl) {
				const listName = getAttr(listEl, "naizo-list");
				const idx = Array.from(listEl.querySelectorAll(DIRECT_ITEM_SELECTOR)).indexOf(itemEl);
				if (listName && idx !== -1) Naizo.removeItem(listName, idx);
				else {
					itemEl.remove();
					flushPersistence(true);
				}
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
			const rows = Array.from(listEl.querySelectorAll(DIRECT_ITEM_SELECTOR));
			const idx = rows.indexOf(itemEl);
			if (idx === -1) return;
			if (dir === "up" && idx > 0) Naizo.moveItem(listName, idx, idx - 1);
			else if (dir === "down" && idx < rows.length - 1) Naizo.moveItem(listName, idx, idx + 1);
		}
	}
	function handleStorageEvent(e) {
		if (!e.key || e.key !== getPageKey() || !e.newValue) return;
		if (writeInFlightPromise !== null || startupInvalidDb) return;
		const nextDb = parseCachedState(e.newValue);
		if (!nextDb) return;
		store = cloneDb(nextDb);
		storeInitialized = true;
		lastSerializedContent = serializeContentBuckets(store);
		hydrateSubtreeFromStore(document, true);
		writeStoreToDomScript(store, false);
		window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
	}
	function attachListeners() {
		if (listenersAttached) return;
		document.addEventListener("click", handleListClicks);
		document.addEventListener("input", handleInputOrChange);
		document.addEventListener("change", handleInputOrChange);
		document.addEventListener("toggle", handleInputOrChange, true);
		document.addEventListener("reset", handleFormReset);
		window.addEventListener("storage", handleStorageEvent);
		window.addEventListener("focus", () => {
			checkDiskForExternalChanges();
		});
		window.addEventListener("pagehide", () => {
			if (persistTimeout !== null) flushPersistence(false);
		});
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") {
				if (persistTimeout !== null) flushPersistence(false);
			} else if (document.visibilityState === "visible") checkDiskForExternalChanges();
		});
		listenersAttached = true;
	}
	const Naizo = {
		init: initNaizo,
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
			dispatchChangeEvent({
				scope: "custom",
				key,
				value: cloned
			});
			flushPersistence(true);
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
			dispatchChangeEvent({
				scope: "fields",
				key,
				value: cloned
			});
			flushPersistence(true);
		},
		deleteField(key) {
			if (!key) return;
			const db = ensureStore();
			if (!hasOwn(db.fields, key)) return;
			deleteOwn(db.fields, key);
			dispatchChangeEvent({
				scope: "fields",
				action: "delete",
				key
			});
			flushPersistence(true);
		},
		getList(listName) {
			const arr = getOwn(ensureStore().lists, listName);
			return Array.isArray(arr) ? arr : [];
		},
		addItem(listName, itemData = {}) {
			addItemInternal(listName, itemData, false);
		},
		updateItem(listName, index, partialData) {
			if (!listName || !isPlainObject(partialData) || !isValidJsonValue(partialData)) {
				console.warn("[naizo.js] Rejected invalid updateItem data for:", listName);
				return;
			}
			const listArr = getOwn(ensureStore().lists, listName);
			if (!Array.isArray(listArr) || index < 0 || index >= listArr.length) return;
			const rowObj = listArr[index];
			if (!isPlainObject(rowObj)) return;
			const listEl = findListElement(listName);
			const itemEl = (listEl ? Array.from(listEl.querySelectorAll(DIRECT_ITEM_SELECTOR)) : [])[index];
			for (const key of Object.keys(partialData)) {
				const val = cloneJsonValue(getOwn(partialData, key));
				setOwn(rowObj, key, val);
				if (itemEl) propagateItemKey(itemEl, key, val);
			}
			dispatchChangeEvent({
				scope: "lists",
				action: "update",
				list: listName,
				index,
				value: rowObj
			});
			flushPersistence(true);
		},
		removeItem(listName, index) {
			const listArr = getOwn(ensureStore().lists, listName);
			if (Array.isArray(listArr) && index >= 0 && index < listArr.length) listArr.splice(index, 1);
			const listEl = findListElement(listName);
			if (listEl) {
				const items = listEl.querySelectorAll(DIRECT_ITEM_SELECTOR);
				if (items[index]) items[index].remove();
			}
			dispatchChangeEvent({
				scope: "lists",
				action: "remove",
				list: listName,
				index
			});
			flushPersistence(true);
		},
		moveItem(listName, fromIndex, toIndex) {
			if (fromIndex === toIndex) return;
			const listArr = getOwn(ensureStore().lists, listName);
			if (Array.isArray(listArr) && fromIndex >= 0 && fromIndex < listArr.length && toIndex >= 0 && toIndex < listArr.length) {
				const [moved] = listArr.splice(fromIndex, 1);
				if (moved) listArr.splice(toIndex, 0, moved);
			}
			const listEl = findListElement(listName);
			if (listEl) {
				const items = Array.from(listEl.querySelectorAll(DIRECT_ITEM_SELECTOR));
				const fromEl = items[fromIndex];
				const targetEl = items[toIndex];
				if (fromEl && targetEl) listEl.insertBefore(fromEl, fromIndex < toIndex ? targetEl.nextSibling : targetEl);
			}
			dispatchChangeEvent({
				scope: "lists",
				action: "move",
				list: listName,
				fromIndex,
				toIndex
			});
			flushPersistence(true);
		},
		bind(root = document) {
			ensureStore();
			hydrateSubtreeFromStore(root, false);
			schedulePersist();
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
		async unlink() {
			stopDiskWatch();
			if (saveTimeout !== null) {
				clearTimeout(saveTimeout);
				saveTimeout = null;
			}
			fileHandle = null;
			lastObservedModified = null;
			await deleteHandleFromIDB();
			updateUi("cached", "Browser Cache · Click to Link Disk");
		},
		async copyJSON() {
			flushPersistence(false);
			const json = serializeDbJson(ensureStore());
			try {
				await navigator.clipboard?.writeText(json);
			} catch {}
			return json;
		},
		exportHTML: getCleanHtmlString
	};
	const NaizoDB = Naizo;
	async function initNaizo() {
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
		ensureListBlueprints(document, true);
		attachListeners();
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
			if (cachedState) hydrateSubtreeFromStore(document, false);
			else document.querySelectorAll(LIST_SELECTOR).forEach((listEl) => {
				if (!isIgnoredElement(listEl)) decorateListControls(listEl);
			});
			updateUi("error", "Invalid #naizodb JSON");
			window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
			return;
		}
		startupInvalidDb = false;
		lastKnownDiskRaw = currentDiskRaw;
		lastDiskDb = cloneDb(diskDetailed.db);
		const diskModifiedExternally = storedDiskSnapshot !== null && normalizeJsonComparison(currentDiskRaw) !== normalizeJsonComparison(storedDiskSnapshot);
		let hasBootConflict = false;
		if (diskModifiedExternally && cachedState) {
			const { merged, hasCollision } = shallowMergeDatabases(parseCachedState(storedDiskSnapshot), cachedState, diskDetailed.db);
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
			if (hasBootConflict) updateUi("conflict", "External Disk Edit · Conflict Backed Up");
			else if (!storedOk) updateUi("cached", "In-Memory Only · Link Disk");
			else updateUi("cached", "Browser Cache · Click to Link Disk");
		} else if (!cachedState) {
			store = cloneDb(diskDetailed.db);
			storeInitialized = true;
			lastSerializedContent = serializeContentBuckets(store);
			hydrateSubtreeFromStore(document, false);
			writeStoreToDomScript(store, false);
			const storedOk = safeSetStorage(pageKey, JSON.stringify(store));
			safeSetStorage(snapshotKey, currentDiskRaw);
			if (!storedOk) updateUi("cached", "In-Memory Only · Link Disk");
			else updateUi("cached", "Browser Cache · Click to Link Disk");
		} else {
			store = cloneDb(cachedState);
			storeInitialized = true;
			lastSerializedContent = serializeContentBuckets(store);
			hydrateSubtreeFromStore(document, false);
			writeStoreToDomScript(store, false);
			const storedOk = safeSetStorage(pageKey, JSON.stringify(store));
			if (storedDiskSnapshot === null) safeSetStorage(snapshotKey, currentDiskRaw);
			if (!storedOk) updateUi("cached", "In-Memory Only · Link Disk");
			else updateUi("cached", "Browser Cache · Click to Link Disk");
		}
		window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
		fileHandle = await loadHandleFromIDB();
		if (fileHandle) try {
			if (await fileHandle.queryPermission({ mode: "readwrite" }) === "granted") {
				startDiskWatch();
				await checkDiskForExternalChanges();
				const isDirtyComparedToDisk = serializeContentBuckets(ensureStore()) !== serializeContentBuckets(lastDiskDb);
				if (hasBootConflict) updateUi("conflict", "External Disk Edit · Conflict Backed Up");
				else if (isDirtyComparedToDisk) updateUi("cached", "Browser Cache · Click to Link Disk");
				else updateUi("saved", "Synced to Disk");
			} else updateUi("needs-permission", "Resume Disk Sync");
		} catch {
			updateUi("needs-permission", "Resume Disk Sync");
		}
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
