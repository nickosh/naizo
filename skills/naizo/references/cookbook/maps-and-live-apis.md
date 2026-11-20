# `file://`-Portable Interactive Maps & Multi-Provider Live APIs

Use this guide when building route planners, field-inspection notebooks, geospatial dashboards, or weather/telemetry studios with **`naizo.js`** that combine an interactive map, live external HTTP JSON feeds (`Naizo.fetch()`), and a durable `#naizodb` itinerary (as demonstrated in `examples/weather.html` – [live demo](https://naizo.js.org/examples/weather.html)).

---

## 1. Choosing a `file://`-Portable Map Engine (`Origin: null` Compatibility)

When a visitor downloads a `naizo.js` app via **`⬇ Save to PC`** (`Naizo.downloadHTML()`) and opens it directly from disk over `file://`, the browser sends `Origin: null` with no HTTP `Referer` header:

- Vector-GL map SDKs that spawn `blob:` Web Workers or require domain-restricted API tokens often fail under `file://` (`Origin: null`).
- **OpenLayers (`ol` v10.8.0, OSGeo BSD-2-Clause)** renders crisp 2D canvas tiles directly on the main thread with zero API keys, works over both `https://` and `file://`, and degrades gracefully if the user goes completely offline.

### Clean `data-naizo-strip` Map Mount & Offline Fallback

Mount OpenLayers into a dynamically created `data-naizo-strip="true"` child inside a permanent `naizo-ignore` frame:

- On **`⬇ Save to PC` / `Naizo.exportHTML()`**, `naizo.js` strips OpenLayers' injected `.ol-viewport`, `.ol-overlaycontainer`, and tile `<img>`/`<canvas>` nodes so exported `.html` files stay tiny and clean (`D47`).
- When the exported `.html` file is reopened, `#map-frame` (`naizo-ignore`) is still present and re-mounts `#map-canvas` cleanly (or shows a helpful offline coordinate card if `window.ol` could not load without internet).
- **Status Pill Clearance (`D50`, `D57`):** Because map viewports usually place `© OpenStreetMap` attribution in the bottom-right corner, either render map controls inside the card flow above the page footer or set `naizo-pill-corner="bottom-left"` on `<body>` when using a full-bleed viewport map.

```html
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@v10.8.0/ol.css" />
  <script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/ol@v10.8.0/dist/ol.js" defer></script>
</head>

<body>
  <!-- Permanent frame survives export; inner .ol-viewport mount is stripped on export -->
  <div id="map-frame" class="map-frame" naizo-ignore style="height: 360px; position: relative">
    <div id="map-offline-fallback" data-naizo-strip="true" hidden>
      Map tiles unavailable offline – coordinates remain editable below.
    </div>
  </div>

  <script>
    let mapInstance = null;
    let pinFeature = null;

    function ensureMapMounted() {
      if (typeof window.Naizo === 'undefined') return;
      const frame = document.getElementById('map-frame');
      if (!frame) return;
      if (typeof window.ol === 'undefined') {
        const fb = document.getElementById('map-offline-fallback');
        if (fb) fb.hidden = false;
        return;
      }
      if (mapInstance && frame.querySelector('#map-canvas')) return;

      const canvasHost = document.createElement('div');
      canvasHost.id = 'map-canvas';
      canvasHost.setAttribute('data-naizo-strip', 'true');
      canvasHost.style.cssText = 'width: 100%; height: 100%;';
      frame.replaceChildren(canvasHost);

      const lat = Number(Naizo.getField('latitude') ?? 36.2478);
      const lon = Number(Naizo.getField('longitude') ?? 137.6356);
      const center = window.ol.proj.fromLonLat([lon, lat]);

      pinFeature = new window.ol.Feature({ geometry: new window.ol.geom.Point(center) });
      const vectorLayer = new window.ol.layer.Vector({
        source: new window.ol.source.Vector({ features: [pinFeature] }),
      });

      mapInstance = new window.ol.Map({
        target: canvasHost,
        layers: [
          new window.ol.layer.Tile({
            source: new window.ol.source.XYZ({
              url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
              crossOrigin: null, // Avoid tainting canvas tiles when Origin: null on file://
              maxZoom: 17,
            }),
          }),
          vectorLayer,
        ],
        view: new window.ol.View({ center, zoom: 12 }),
      });

      // Click-to-scout updates bound coordinate fields in a single synchronous batch
      mapInstance.on('singleclick', (evt) => {
        const [nextLon, nextLat] = window.ol.proj.toLonLat(evt.coordinate);
        const roundedLat = Number(nextLat.toFixed(4));
        const roundedLon = Number(nextLon.toFixed(4));
        pinFeature.getGeometry().setCoordinates(evt.coordinate);
        Naizo.batch(() => {
          Naizo.setField('latitude', roundedLat);
          Naizo.setField('longitude', roundedLon);
        });
        void refreshLiveFeed(roundedLat, roundedLon);
      });
    }

    Naizo.ready(() => {
      ensureMapMounted();
      void refreshLiveFeed(
        Number(Naizo.getField('latitude') ?? 36.2478),
        Number(Naizo.getField('longitude') ?? 137.6356),
      );
    });
  </script>
</body>
```

---

## 2. Multi-Provider CORS API Chains via Non-Mutating `Naizo.fetch()` (`D52`)

When pulling live forecasts, elevation, or geocoding data from public HTTP APIs:

1. **Call `await Naizo.fetch(url)` without `options.into` (`D52`):** Omitting `options.into` drives the Status Pill's rightmost `#net` wired-globe indicator (`API active` `L→R` emerald sweep → `API idle` or `API request failed`), suppresses thrown exceptions (`{ ok, status, data, error }`), and **never mutates `#naizodb`** – keeping transient 168-hour forecast arrays out of your saved `.html` file and Git diffs.
2. **Parse JSON defensively across `Content-Type` headers:** Some public endpoints return valid JSON with `Content-Type: text/plain`. Use a tiny `asJsonObject(res.data)` helper so both pre-parsed objects and string bodies normalize cleanly.
3. **Chain CORS-enabled providers (`Access-Control-Allow-Origin: *`) with sequence-token cancellation:** Guard out-of-order responses with `const reqId = ++activeReqId` so rapid map clicks never overwrite newer coordinates with a slower earlier response:

```javascript
let activeReqId = 0;
let latestScoutedForecast = null; // Kept in JS memory (not #naizodb) until promoted to a pin

function asJsonObject(payload) {
  if (payload && typeof payload === 'object') return payload;
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
  return null;
}

const PROVIDERS = [
  {
    name: 'Open-Meteo',
    buildUrl: (lat, lon) =>
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m`,
    normalize: (raw) => {
      const json = asJsonObject(raw);
      if (!json?.current) return null;
      return {
        source: 'Open-Meteo',
        elevation_m: typeof json.elevation === 'number' ? Math.round(json.elevation) : null,
        temp_c: Number(json.current.temperature_2m),
        wind_kmh: Number(json.current.wind_speed_10m),
      };
    },
  },
  {
    name: 'wttr.in',
    buildUrl: (lat, lon) => `https://wttr.in/${lat},${lon}?format=j1`,
    normalize: (raw) => {
      const json = asJsonObject(raw);
      const cur = json?.current_condition?.[0];
      if (!cur) return null;
      return {
        source: 'wttr.in',
        elevation_m: null,
        temp_c: Number(cur.temp_C),
        wind_kmh: Number(cur.windspeedKmph),
      };
    },
  },
];

async function refreshLiveFeed(lat, lon) {
  const reqId = ++activeReqId;
  for (const provider of PROVIDERS) {
    const res = await Naizo.fetch(provider.buildUrl(lat, lon)); // Non-mutating (D52)
    if (reqId !== activeReqId) return; // Superseded by a newer map click
    if (!res.ok) continue;
    const normalized = provider.normalize(res.data);
    if (normalized) {
      latestScoutedForecast = normalized;
      if (normalized.elevation_m !== null) {
        Naizo.setField('elevation_m', normalized.elevation_m);
      }
      renderForecastPreview(normalized);
      return;
    }
  }
}
```

---

## 3. Selective Pin Promotion into `[naizo-list]` + 1-Click Clear & `↺ Undo`

Keep transient exploration separate from durable user data:

- **Promote intentionally:** When the user clicks **`+ Save Pin to Route`**, snapshot the active coordinates and current forecast summary into `[naizo-list="route"]` (`Naizo.addItem('route', ...)`). Extra properties (`id`, `lat`, `lon`, `elevation_m`, `temp_c`) survive automatically as `D15` pass-through keys without hidden `<input>` elements.
- **Single-pass clear + in-memory `↺ Undo` (`Naizo.setList`):** Clear all pins in one validated pass via `Naizo.setList('route', [])` while keeping a shallow copy in memory so the user can undo accidental clears in 1 click:

```html
<div class="route-toolbar" naizo-ignore>
  <button id="promote-pin-btn" type="button">+ Add Active Pin to Route</button>
  <button id="clear-pins-btn" type="button">Clear Saved Pins</button>
  <button id="undo-clear-btn" type="button" hidden>↺ Undo Clear</button>
</div>

<div id="route-list" naizo-list="route">
  <template naizo-template>
    <div class="route-item" naizo-item>
      <label><input type="checkbox" naizo="done" /><span>Visited</span></label>
      <label><input type="text" naizo="place" placeholder="Stop name..." /></label>
      <label><input type="text" naizo="note" placeholder="Trail / timing notes..." /></label>
      <span class="route-meta" naizo-ignore></span>
    </div>
  </template>
</div>

<script>
  let clearedRouteBackup = null;
  const undoBtn = document.getElementById('undo-clear-btn');

  document.getElementById('promote-pin-btn').addEventListener('click', () => {
    Naizo.addItem('route', {
      id: 'stop-' + Date.now(),
      done: false,
      place: String(Naizo.getField('location_name') || 'Pinned Waypoint'),
      note: '',
      lat: Number(Naizo.getField('latitude') ?? 0),
      lon: Number(Naizo.getField('longitude') ?? 0),
      elevation_m: Number(Naizo.getField('elevation_m') ?? 0),
      temp_c: latestScoutedForecast?.temp_c ?? null,
    });
  });

  document.getElementById('clear-pins-btn').addEventListener('click', () => {
    const current = Naizo.getList('route');
    if (current.length === 0) return;
    clearedRouteBackup = structuredClone(current);
    Naizo.setList('route', []);
    undoBtn.hidden = false;
  });

  undoBtn.addEventListener('click', () => {
    if (!clearedRouteBackup) return;
    Naizo.setList('route', clearedRouteBackup);
    clearedRouteBackup = null;
    undoBtn.hidden = true;
  });
</script>
```

---

## 4. Declarative Webhook Sync & Human-Readable `'naizo:fetch'` Receipts (`D43`, `D51`)

Pair declarative `naizo-post` / `naizo-get` buttons (`naizo-into="#api-receipt"` writes plain `textContent` safely without mutating `#naizodb`, `D22`) with a `'naizo:fetch'` listener that formats a friendly timestamped receipt:

```html
<button
  type="button"
  naizo-post="https://httpbin.org/post"
  naizo-body="db"
  naizo-path="url"
  naizo-into="#api-receipt"
>
  Sync Route Snapshot
</button>
<p id="api-receipt">Ready to sync.</p>

<script>
  window.addEventListener('naizo:fetch', (e) => {
    const { ok, method, status, target } = e.detail || {};
    if (target !== '#api-receipt') return;
    const receiptEl = document.getElementById('api-receipt');
    if (!receiptEl) return;
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    receiptEl.textContent = ok
      ? `✓ ${method} succeeded (${status}) at ${stamp}`
      : `⚠ ${method} failed (${status || 'network/CORS'}) — check DevTools Network tab`;
  });
</script>
```

---

## 5. Pitfalls to Avoid & Why

- **Putting `naizo-ignore` (or `data-naizo-ignore`) on a `naizo-into="#selector"` target (`EC50`, `D60`):** `naizo.js`'s selector writer strictly skips `[naizo-ignore]` and `[naizo-strip]` subtrees (`!isIgnoredElement(el)`) so custom widgets remain isolated from declarative writes; adding `naizo-ignore` to `<p id="api-receipt">` causes `naizo-into="#api-receipt"` to fail (`Target selector "#api-receipt" matched no elements`) and latches `#net` Red even on HTTP `200`. Leave `<p id="api-receipt">` without `naizo-ignore` — because `naizo.js` binds strictly opt-in `naizo="key"` / `data-naizo="key"` elements (`D08`, `EC11`), an unbound display element already stays out of `#naizodb`.
- **Passing `{ into: 'db' }` to `Naizo.fetch()` for third-party REST APIs:** `{ into: 'db' }` expects a `{ _meta, fields, lists, custom }` `NaizoDatabase` object (and endpoints returning a top-level `"fields"` key like Jira/Airtable would clobber `store`, `D52`). Omit `options.into` when fetching external API JSON in JavaScript, then write normalized values via `Naizo.setField()` / `Naizo.setList()`.
- **Setting `crossOrigin: 'anonymous'` unconditionally on all map tile layers:** Tile servers that omit `Access-Control-Allow-Origin: *` fail to load images on `file://` (`Origin: null`) when `crossOrigin: 'anonymous'` is forced. Leave `crossOrigin: null` unless reading pixel data via `canvas.toDataURL()`.
- **Leaving `.ol-viewport` or loading skeletons without `data-naizo-strip`:** Bakes dozens of transient tile `<img>` tags and skeleton placeholders into `⬇ Save to PC` downloads (`D47`).
- **Fetching relative `./preset.json` over `file://`:** Browsers block `fetch('./preset.json')` on `file://`; serve over `http://localhost` during local development or embed offline fallback defaults directly inside `<script id="naizodb">`.
