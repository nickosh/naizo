(function() {
	//#region src/index.ts
	const DB_ID = "naizodb";
	const UI_ID = "__naizodb_host__";
	const STYLE_ID = "__naizodb_styles__";
	const IDB_NAME = "NaizoDB_Handles";
	const PERSIST_DEBOUNCE_MS = 150;
	const DISK_DEBOUNCE_MS = 250;
	const BOUND_SELECTOR = "[naizo], [data-naizo], [data-naizo-field]";
	const LIST_SELECTOR = "[naizo-list], [data-naizo-list]";
	const ITEM_SELECTOR = "[naizo-item], [data-naizo-item]";
	const DIRECT_ITEM_SELECTOR = ":scope > [naizo-item], :scope > [data-naizo-item]";
	const TEMPLATE_SELECTOR = "template[naizo-template], template[data-naizo-template], template";
	const IGNORE_SELECTOR = "[naizo-ignore], [data-naizo-ignore]";
	const SKIPPED_INPUT_TYPES = /* @__PURE__ */ new Set([
		"password",
		"file",
		"button",
		"submit",
		"reset",
		"image"
	]);
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
	function getPageKey() {
		return "naizodb_state_" + (typeof location !== "undefined" ? location.pathname : "/");
	}
	function getSnapshotKey() {
		return "naizodb_disk_hash_" + (typeof location !== "undefined" ? location.pathname : "/");
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
	let itemDataMap = /* @__PURE__ */ new WeakMap();
	let fileHandle = null;
	let persistTimeout = null;
	let saveTimeout = null;
	let statusEl = null;
	let actionBtn = null;
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
		idbStore("readwrite", (store) => store.put(handle, getPageKey()));
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
	function isSkippedElement(el, warn = false) {
		if (el instanceof HTMLInputElement) {
			const type = (el.getAttribute("type") ?? el.type ?? "text").toLowerCase();
			if (SKIPPED_INPUT_TYPES.has(type)) {
				if (warn) console.warn(`[naizo.js] Skipping unsupported input[type="${type}"] binding.`);
				return true;
			}
		}
		return false;
	}
	function isContentEditableElement(el) {
		if (!el.hasAttribute("contenteditable")) return false;
		return (el.getAttribute("contenteditable") ?? "").trim().toLowerCase() !== "false";
	}
	function readElementValue(el) {
		if (isSkippedElement(el)) return void 0;
		if (el instanceof HTMLInputElement) {
			if (el.type === "checkbox") return el.checked;
			if (el.type === "radio") return el.checked ? el.value : void 0;
			return el.value;
		}
		if (el instanceof HTMLSelectElement) return el.value;
		if (el instanceof HTMLTextAreaElement) return el.value;
		return el.textContent ?? "";
	}
	function writeElementValue(el, val) {
		if (isSkippedElement(el, true)) return;
		const textVal = toTextValue(val);
		if (el instanceof HTMLInputElement) {
			if (el.type === "checkbox") el.checked = toBooleanValue(val);
			else if (el.type === "radio") el.checked = el.value === textVal;
			else el.value = textVal;
			return;
		}
		if (el instanceof HTMLSelectElement) {
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
		el.textContent = textVal;
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
			if (el.options.length) el.selectedIndex = 0;
			Array.from(el.options).forEach((opt, i) => {
				if (i === 0) opt.setAttribute("selected", "selected");
				else opt.removeAttribute("selected");
			});
		} else if (el instanceof HTMLTextAreaElement) {
			el.value = "";
			el.textContent = "";
		} else el.textContent = "";
	}
	function shouldUpdateStoredValue(prevVal, nextVal, exists) {
		if (!exists) return true;
		if (Object.is(prevVal, nextVal)) return false;
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
	function ensureListBlueprints(root = document) {
		const lists = [];
		if (root instanceof HTMLElement && root.matches(LIST_SELECTOR) && !isIgnoredElement(root)) lists.push(root);
		root.querySelectorAll(LIST_SELECTOR).forEach((el) => {
			if (!isIgnoredElement(el)) lists.push(el);
		});
		lists.forEach((listEl) => {
			let tpl = listEl.querySelector(TEMPLATE_SELECTOR);
			if (!tpl) {
				const firstItem = listEl.querySelector(ITEM_SELECTOR);
				if (!firstItem) return;
				const cleanClone = firstItem.cloneNode(true);
				cleanClone.querySelectorAll(IGNORE_SELECTOR).forEach((n) => n.remove());
				cleanClone.querySelectorAll(BOUND_SELECTOR).forEach(clearElementValue);
				tpl = document.createElement("template");
				tpl.setAttribute("naizo-template", "");
				tpl.content.appendChild(cleanClone);
				listEl.prepend(tpl);
			} else if (!hasAttr(tpl, "naizo-template")) tpl.setAttribute("naizo-template", "");
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
			tools.innerHTML = `
      <button type="button" naizo-move="up" title="Move up">↑</button>
      <button type="button" naizo-move="down" title="Move down">↓</button>
      <button type="button" naizo-remove title="Delete item">×</button>
    `;
			itemEl.appendChild(tools);
		});
		const escaped = escapeSelectorAttr(listName);
		if (!document.querySelector(`[naizo-add="${escaped}"], [data-naizo-add="${escaped}"]`)) {
			const addWrap = document.createElement("div");
			addWrap.className = "naizo-list-footer";
			addWrap.setAttribute("naizo-ignore", "true");
			addWrap.innerHTML = `<button type="button" class="naizo-add-btn" naizo-add="${listName}">+ Add Item</button>`;
			listEl.insertAdjacentElement("afterend", addWrap);
		}
	}
	function bindItemElementToRecord(itemEl, rowObj) {
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
		bindItemElementToRecord(itemEl, itemData);
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
	function writeStoreToDomScript(db, allowMetaBump) {
		const nextContent = serializeContentBuckets(db);
		if (allowMetaBump && nextContent !== lastSerializedContent) setOwn(db._meta, "updatedAt", (/* @__PURE__ */ new Date()).toISOString());
		lastSerializedContent = nextContent;
		const formatted = "\n" + JSON.stringify(db, null, 2) + "\n";
		if (!startupInvalidDb) {
			const scriptEl = getDbScript();
			scriptEl.textContent = formatted;
			trackedDbScriptEl = scriptEl;
		}
		return formatted;
	}
	function hydrateSubtreeFromStore(root = document) {
		const db = ensureStore();
		ensureListBlueprints(root);
		queryStandaloneBoundElements(root).forEach((el) => {
			const key = getElementKey(el);
			if (!key) return;
			if (hasOwn(db.fields, key)) writeElementValue(el, getOwn(db.fields, key));
			else {
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
			if (hasOwn(db.lists, listName) && Array.isArray(getOwn(db.lists, listName))) renderListItems(listEl, getOwn(db.lists, listName));
			else {
				const seededItems = [];
				listEl.querySelectorAll(DIRECT_ITEM_SELECTOR).forEach((itemEl) => {
					const rowObj = {};
					bindItemElementToRecord(itemEl, rowObj);
					seededItems.push(rowObj);
				});
				setOwn(db.lists, listName, seededItems);
				decorateListControls(listEl);
			}
		});
	}
	function getCleanHtmlString() {
		flushPersistence();
		const clone = document.documentElement.cloneNode(true);
		const liveBound = Array.from(document.documentElement.querySelectorAll(BOUND_SELECTOR));
		const cloneBound = Array.from(clone.querySelectorAll(BOUND_SELECTOR));
		for (let i = 0; i < liveBound.length; i += 1) {
			const liveEl = liveBound[i];
			const cloneEl = cloneBound[i];
			if (liveEl && cloneEl && !isIgnoredElement(liveEl)) bakeClonedElementAttributes(liveEl, cloneEl);
		}
		clone.querySelectorAll(`${IGNORE_SELECTOR}, #${UI_ID}, #${STYLE_ID}`).forEach((el) => el.remove());
		return "<!DOCTYPE html>\n" + clone.outerHTML;
	}
	async function writeToDisk() {
		if (!fileHandle || startupInvalidDb) return false;
		try {
			if (await fileHandle.queryPermission({ mode: "readwrite" }) !== "granted") {
				updateUi("needs-permission", "Resume Disk Sync");
				return false;
			}
			const htmlString = getCleanHtmlString();
			const writable = await fileHandle.createWritable();
			await writable.write(htmlString);
			await writable.close();
			safeSetStorage(getSnapshotKey(), getDbScript().textContent?.trim() ?? "");
			updateUi("saved", "Saved " + (/* @__PURE__ */ new Date()).toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit"
			}));
			return true;
		} catch (err) {
			console.warn("[naizo.js] Disk write failed:", err);
			updateUi("cached", "Cached in Browser · Link Disk");
			return false;
		}
	}
	function flushPersistence() {
		if (persistTimeout !== null) {
			clearTimeout(persistTimeout);
			persistTimeout = null;
		}
		if (startupInvalidDb) {
			updateUi("error", "Invalid #naizodb JSON");
			return;
		}
		const db = ensureStore();
		writeStoreToDomScript(db, true);
		const storedOk = safeSetStorage(getPageKey(), JSON.stringify(db));
		if (!fileHandle) {
			if (storedOk) updateUi("cached", "Cached in Browser");
			else updateUi("cached", "In-Memory Only · Link Disk");
			return;
		}
		updateUi("saving", "Saving...");
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			writeToDisk();
		}, DISK_DEBOUNCE_MS);
	}
	function schedulePersist() {
		if (startupInvalidDb) return;
		if (persistTimeout !== null) clearTimeout(persistTimeout);
		persistTimeout = setTimeout(() => {
			persistTimeout = null;
			flushPersistence();
		}, PERSIST_DEBOUNCE_MS);
	}
	function triggerSave() {
		flushPersistence();
	}
	async function connectOrResumeDisk() {
		if (fileHandle) {
			if (await fileHandle.requestPermission({ mode: "readwrite" }) === "granted") {
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
	function mountUi() {
		if (!document.getElementById(STYLE_ID)) {
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.setAttribute("naizo-ignore", "true");
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
		const host = document.createElement("div");
		host.id = UI_ID;
		host.setAttribute("naizo-ignore", "true");
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
    </style>
    <div class="pill">
      <span class="dot" id="dot"></span>
      <span id="status">naizo.js Ready</span>
      <button id="action">Link Disk</button>
      <button id="copy" title="Copy #naizodb JSON state">{ } Copy</button>
    </div>
  `;
		statusEl = shadow.getElementById("status");
		actionBtn = shadow.getElementById("action");
		const dotEl = shadow.getElementById("dot");
		const copyBtn = shadow.getElementById("copy");
		actionBtn?.addEventListener("click", () => {
			connectOrResumeDisk();
		});
		copyBtn?.addEventListener("click", () => {
			flushPersistence();
			const text = "\n" + JSON.stringify(ensureStore(), null, 2) + "\n";
			navigator.clipboard?.writeText(text.trim());
			copyBtn.textContent = "✓ Copied";
			setTimeout(() => {
				copyBtn.textContent = "{ } Copy";
			}, 1500);
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
		} else {
			actionBtn.style.display = "inline-block";
			actionBtn.textContent = "Link Disk";
		}
	}
	function handleInputOrChange(e) {
		const target = e.target;
		if (!(target instanceof Element)) return;
		if (isIgnoredElement(target)) return;
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
			schedulePersist();
			return;
		}
		const exists = hasOwn(db.fields, key);
		if (!shouldUpdateStoredValue(getOwn(db.fields, key), nextVal, exists)) return;
		setOwn(db.fields, key, nextVal);
		propagateStandaloneKey(key, nextVal, boundEl);
		schedulePersist();
	}
	function handleListClicks(e) {
		const target = e.target;
		if (!target || typeof target.closest !== "function") return;
		const addBtn = target.closest("[naizo-add], [data-naizo-add]");
		if (addBtn) {
			const listName = getAttr(addBtn, "naizo-add");
			if (listName) Naizo.addItem(listName, {});
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
					triggerSave();
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
	function attachListeners() {
		if (listenersAttached) return;
		document.addEventListener("click", handleListClicks);
		document.addEventListener("input", handleInputOrChange);
		document.addEventListener("change", handleInputOrChange);
		window.addEventListener("pagehide", () => {
			if (persistTimeout !== null) flushPersistence();
		});
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden" && persistTimeout !== null) flushPersistence();
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
			setOwn(ensureStore().custom, key, cloneJsonValue(value));
			triggerSave();
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
			triggerSave();
		},
		deleteField(key) {
			if (!key) return;
			const db = ensureStore();
			if (!hasOwn(db.fields, key)) return;
			deleteOwn(db.fields, key);
			triggerSave();
		},
		getList(listName) {
			const arr = getOwn(ensureStore().lists, listName);
			return Array.isArray(arr) ? arr : [];
		},
		addItem(listName, itemData = {}) {
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
				triggerSave();
				return;
			}
			ensureListBlueprints(listEl);
			const node = createItemNode(listEl, rowObj);
			if (node) {
				listEl.appendChild(node);
				listArr.push(rowObj);
				decorateListControls(listEl);
				node.querySelector("input[type=\"text\"], [contenteditable=\"true\"], textarea")?.focus();
				triggerSave();
			}
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
			triggerSave();
		},
		removeItem(listName, index) {
			const listArr = getOwn(ensureStore().lists, listName);
			if (Array.isArray(listArr) && index >= 0 && index < listArr.length) listArr.splice(index, 1);
			const listEl = findListElement(listName);
			if (listEl) {
				const items = listEl.querySelectorAll(DIRECT_ITEM_SELECTOR);
				if (items[index]) items[index].remove();
			}
			triggerSave();
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
			triggerSave();
		},
		bind(root = document) {
			ensureStore();
			hydrateSubtreeFromStore(root);
			schedulePersist();
		},
		save: triggerSave,
		exportHTML: getCleanHtmlString
	};
	const NaizoDB = Naizo;
	async function initNaizo() {
		if (persistTimeout !== null) {
			clearTimeout(persistTimeout);
			persistTimeout = null;
		}
		if (saveTimeout !== null) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		mountUi();
		ensureListBlueprints(document);
		attachListeners();
		const pageKey = getPageKey();
		const snapshotKey = getSnapshotKey();
		const scriptEl = getDbScript();
		trackedDbScriptEl = scriptEl;
		const currentDiskRaw = scriptEl.textContent?.trim() ?? "";
		const lastKnownDiskRaw = safeGetStorage(snapshotKey);
		const diskDetailed = parseDbScriptDetailed(currentDiskRaw);
		const cachedState = parseCachedState(safeGetStorage(pageKey));
		if (!diskDetailed.ok) {
			startupInvalidDb = true;
			store = cachedState ? cloneDb(cachedState) : createEmptyDb();
			storeInitialized = true;
			lastSerializedContent = serializeContentBuckets(store);
			if (cachedState) hydrateSubtreeFromStore(document);
			else document.querySelectorAll(LIST_SELECTOR).forEach((listEl) => {
				if (!isIgnoredElement(listEl)) decorateListControls(listEl);
			});
			updateUi("error", "Invalid #naizodb JSON");
			window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
			return;
		}
		startupInvalidDb = false;
		if (lastKnownDiskRaw !== null && currentDiskRaw !== lastKnownDiskRaw || !cachedState) {
			store = cloneDb(diskDetailed.db);
			storeInitialized = true;
			lastSerializedContent = serializeContentBuckets(store);
			hydrateSubtreeFromStore(document);
			writeStoreToDomScript(store, false);
			const storedOk = safeSetStorage(pageKey, JSON.stringify(store));
			safeSetStorage(snapshotKey, currentDiskRaw);
			if (!storedOk) updateUi("cached", "In-Memory Only · Link Disk");
		} else {
			store = cloneDb(cachedState);
			storeInitialized = true;
			lastSerializedContent = serializeContentBuckets(store);
			hydrateSubtreeFromStore(document);
			writeStoreToDomScript(store, false);
			const storedOk = safeSetStorage(pageKey, JSON.stringify(store));
			if (lastKnownDiskRaw === null) safeSetStorage(snapshotKey, currentDiskRaw);
			if (!storedOk) updateUi("cached", "In-Memory Only · Link Disk");
		}
		window.dispatchEvent(new CustomEvent("naizo:hydrate", { detail: store }));
		fileHandle = await loadHandleFromIDB();
		if (fileHandle) try {
			if (await fileHandle.queryPermission({ mode: "readwrite" }) === "granted") updateUi("saved", "Disk Sync Active");
			else updateUi("needs-permission", "File Remembered");
		} catch {
			updateUi("needs-permission", "File Remembered");
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
