# Animated SVG Craft, UI Motion, Procedural Web Audio, & Modular Avatars

Use this guide when adding **animated SVG icons/diagrams**, **polished UI transitions**, **procedural Web Audio sound effects**, or **composable SVG avatars** to a single-file **`naizo.js`** application – delivering rich motion, sound, and vector visuals that work offline over `file://` and survive `⬇ Save to PC` (`Naizo.downloadHTML()`) with **zero external MP3, WAV, or PNG files**.

---

## Part 1: Animated SVG Architecture & UI Motion Craft (`D50`, `D56`, `EC52`)

Inline `<svg>` elements inside HTML documents have subtle coordinate-system, shadow-tree, and cascade rules. Following these patterns keeps multi-part SVG animations crisp across Chromium, Firefox, and Safari.

### 1. Position & Scale Icons with `<g transform="translate(x, y) scale(s)">` + `transform-box: fill-box`

Avoid nesting `<svg x="..." y="..." width="..." height="...">` inside another `<svg>`:

- Inner `<svg>` elements default to **`overflow: hidden`**, clipping expanding rings, spring bounces, and outer glow halos at the inner `viewBox` edge.
- Default **`transform-box: view-box`** resolves `transform-origin: center` against the viewport coordinate space rather than each shape's own geometry, causing stones or rings to swing wildly off-center.

**Clean pattern:** Place sub-icons inside `<g transform="translate(x, y) scale(s)">` and declare `transform-box: fill-box; transform-origin: center;` on every animated child shape:

```html
<svg viewBox="0 0 240 120" width="240" height="120" role="img" aria-label="Status crest showcase">
  <style>
    .ring,
    .c-top,
    .c-bl,
    .c-br {
      transform-box: fill-box;
      transform-origin: center;
    }

    /* 1px in SVG CSS = 1 local user unit inside the 100x100 group, scaling uniformly under scale(0.4) */
    @keyframes crestHeartTop {
      0%,
      29%,
      100% {
        transform: translate(0, 0) scale(1);
      }
      11.5% {
        transform: translate(0, -1.4px) scale(1.22);
      }
    }
    @keyframes crestRingBreath {
      0%,
      6%,
      33.33%,
      100% {
        transform: scale(1);
      }
      18.5% {
        transform: scale(1.064);
      }
    }

    .anim-saving .ring {
      animation: crestRingBreath 1.55s ease-out infinite;
    }
    .anim-saving .c-top {
      animation: crestHeartTop 1.55s ease-in-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .ring,
      .c-top,
      .c-bl,
      .c-br {
        animation: none !important;
      }
    }
  </style>

  <!-- Positioned & scaled via <g> (never nested <svg>): zero clipping, exact local user units -->
  <g class="anim-saving" transform="translate(100, 40) scale(0.4)">
    <circle class="ring" cx="50" cy="50" r="42" fill="none" stroke="#10b981" stroke-width="8" />
    <rect class="c-top" x="39" y="26" width="22" height="22" rx="4.5" fill="#10b981" />
    <rect class="c-bl" x="26" y="52" width="22" height="22" rx="4.5" fill="#10b981" />
    <rect class="c-br" x="52" y="52" width="22" height="22" rx="4.5" fill="#10b981" />
  </g>
</svg>
```

### 2. Split Outer Positioning `<g transform="...">` from Inner Animated `<g class="anim-...">`

In SVG2, `transform="translate(66, 18) scale(1.333)"` on a `<g>` is a **CSS presentation attribute**. If you attach a CSS `@keyframes` rule that animates `transform: scale(1.1)` to that **same** `<g>`, CSS `transform` completely overwrites `translate(66, 18) scale(1.333)` – snapping the icon back to `(0, 0)` at `scale(1)`!

Always separate **layout placement** (outer `<g>`) from **keyframe motion** (inner `<g>`):

```xml
<!-- Outer <g> owns placement & scale; inner <g> owns CSS @keyframes transform -->
<g transform="translate(66, 18) scale(1.333)" fill="none" stroke="#ef4444" stroke-width="1.85">
  <g class="anim-net-error">
    <ellipse cx="12" cy="12" rx="4.6" ry="9.5" />
    <circle cx="12" cy="12" r="9.5" />
  </g>
</g>
```

### 3. Use `px` User-Unit Offsets (Not `%`) Inside Scaled `<g>` Groups

When `transform-box: fill-box` is set on child shapes of different sizes (for example, a `22×22` square stone vs. an `84×84` outer ring inside a `100×100` icon):

- **`translate(10%, 0)`** resolves relative to **each element's own bounding box** (`2.2` units on the stone vs. `8.4` units on the ring), breaking choreographed collisions or alignments.
- **`translate(1.4px, 0)`** in SVG CSS resolves to **`1.4` local user units** in the parent coordinate system and scales proportionally inside `<g transform="scale(0.4)">`.

### 4. Static `<symbol>` + `<use>` Deduplication vs. Inlined Animated Shapes (`M11.2`)

To reuse a brand mark or icon across an HTML document without external `.svg` files (which would break when downloaded via `⬇ Save to PC` onto `file://`):

- **For static marks:** Define `<svg style="display: none" aria-hidden="true"><symbol id="app-crest-icon" viewBox="0 0 100 100">...</symbol></svg>` once in `<body>` and render `<svg><use href="#app-crest-icon"></use></svg>`. Whole-element color (`currentColor`) and whole-SVG transforms work cleanly.
- **For multi-part animated marks:** Inline real `<circle>`, `<rect>`, and `<g>` elements directly. `<use href="#...">` instantiates a **closed SVG shadow tree**, so descendant selectors like `.anim-saving .c-top` cannot reach shapes inside `<symbol>`.

### 5. Globally Unique `<defs>` IDs & Directional `<clipPath>` Light Sweeps

All inline `<svg>` blocks in an HTML document share one global ID namespace. Never repeat generic IDs like `id="grad"` or `id="wave-clip"` across multiple inline SVGs (if the first SVG sits inside a `hidden` tab, `url(#wave-clip)` can fail on visible SVGs). Prefix every `<defs>` ID (`id="net-showcase-wave-clip"`).

To animate a smooth light wave across complex wireframe strokes (like `naizo.js`'s `#net` globe), layer a bright `<g clip-path="url(#unique-wave-clip)">` directly over a dim base `<g>` sharing identical path geometry, and animate `<rect>` inside `<clipPath>`:

```xml
<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <defs>
    <clipPath id="net-card-wave-clip">
      <rect class="wave-band" x="-4" y="0" width="9" height="24" rx="4" />
    </clipPath>
  </defs>
  <!-- 1. Calm translucent base strokes -->
  <g fill="none" stroke="#10b981" stroke-opacity="0.38" stroke-width="1.85">
    <ellipse cx="12" cy="12" rx="4.6" ry="9.5" />
    <circle cx="12" cy="12" r="9.5" />
  </g>
  <!-- 2. Bright L->R clipped highlight wave -->
  <g fill="none" stroke="#10b981" stroke-width="1.85" clip-path="url(#net-card-wave-clip)">
    <ellipse cx="12" cy="12" rx="4.6" ry="9.5" />
    <circle cx="12" cy="12" r="9.5" />
  </g>
</svg>
```

### 6. Cycle-Boundary Animation Completion & FLIP Discrete-Corner Transitions

Two small JS patterns elevate UI motion from "abrupt CSS toggle" to tactile craft:

1. **Cycle/Beat-Boundary Completion (`SAVING_CYCLE_MS`):** Fast local saves finish in `< 15 ms`, and hover interactions (`mouseleave`) end mid-keyframe. Track `beatStartedAt = performance.now()` when starting a rhythmic animation; when the trigger ends normally, hold the animation class for `BEAT_MS - ((performance.now() - beatStartedAt) % BEAT_MS)` so the active beat returns smoothly to `scale(1)` instead of snapping mid-swell (while clearing immediately with `0 ms` delay on urgent error/conflict states).
2. **FLIP `translate3d` for Discrete Corner/Slot Moves:** CSS `transition` cannot interpolate `left: 16px → auto` + `right: auto → 16px`. Measure `fromRect = el.getBoundingClientRect()` before changing the slot attribute and `toRect = el.getBoundingClientRect()` after; if `toRect.width > 0` (guarding zero-layout `jsdom` tests) and `!matchMedia('(prefers-reduced-motion: reduce)').matches`, apply `translate3d(fromRect.left - toRect.left, fromRect.top - toRect.top, 0)` with `transition: none`, force reflow (`void el.offsetWidth`), and clear `transform` to glide along a smooth curve.

### 7. Dual Light/Dark Inline SVG Favicons (Chromium & Safari Dark-Tab Safe)

A single SVG favicon relying on `currentColor` or internal `@media (prefers-color-scheme: dark)` caches as dark-on-dark in Chromium's URL-keyed favicon rasterizer and renders black in Safari dark tabs (`EC52`). Declare two `<link rel="icon" media="...">` data URLs with hardcoded hex strokes/fills (`%231c1917` for light, `%23f5f5f4` for dark):

```html
<link
  rel="icon"
  type="image/svg+xml"
  media="(prefers-color-scheme: light)"
  href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='42' fill='none' stroke='%231c1917' stroke-width='8'/%3E%3Crect x='39' y='26' width='22' height='22' rx='4.5' fill='%231c1917'/%3E%3Crect x='26' y='52' width='22' height='22' rx='4.5' fill='%231c1917'/%3E%3Crect x='52' y='52' width='22' height='22' rx='4.5' fill='%231c1917'/%3E%3C/svg%3E"
/>
<link
  rel="icon"
  type="image/svg+xml"
  media="(prefers-color-scheme: dark)"
  href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='42' fill='none' stroke='%23f5f5f4' stroke-width='8'/%3E%3Crect x='39' y='26' width='22' height='22' rx='4.5' fill='%23f5f5f4'/%3E%3Crect x='26' y='52' width='22' height='22' rx='4.5' fill='%23f5f5f4'/%3E%3Crect x='52' y='52' width='22' height='22' rx='4.5' fill='%23f5f5f4'/%3E%3C/svg%3E"
/>
```

---

## Part 2: Procedural Web Audio Synth, Stage Choreography, & Modular SVG Avatars

For interactive team workshops, voting arenas, timers, and gamified triage tools, browser **Web Audio API (`AudioContext`)** + **modular SVG `<g>` layers** deliver rich audio-visual personality inside one portable `.html` file.

### 1. Lazy `AudioContext` Unlock, `#naizodb` Mute State, & 3-Variant Variety

Browsers suspend audio until a user gesture occurs, and hearing the exact same sound 50 times in a live meeting causes listener fatigue. Lazily initialize one shared `AudioContext`, persist mute state in `db.custom.soundMuted`, and roll `variant = Math.floor(Math.random() * 3)` (returning `variant` so UI banners can display matching Easter-egg text):

```javascript
let audioCtx = null;

function getAudioContext() {
  if (Boolean(Naizo.get('soundMuted'))) return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

function createNoiseBuffer(ctx, durationSec = 1.0) {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}
```

#### Four Zero-Asset Web Audio Synthesis Recipes

```javascript
function playStudioSound(kind) {
  const ctx = getAudioContext();
  const variant = Math.floor(Math.random() * 3);
  if (!ctx) return variant;
  const now = ctx.currentTime;

  if (kind === 'boing') {
    // 1. Pitch-Sweep + LFO Spring Boing (skip / bounce)
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180 + variant * 25, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.38);
    lfo.frequency.value = 24;
    lfoGain.gain.value = 55;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.44);
    lfo.stop(now + 0.44);
  } else if (kind === 'chomp') {
    // 2. Dual-Bandpass Vocal Formant Synthesis (merge / chomp)
    [0, 0.16, 0.32].forEach((offset) => {
      const t = now + offset;
      const saw = ctx.createOscillator();
      const f1 = ctx.createBiquadFilter();
      const f2 = ctx.createBiquadFilter();
      const env = ctx.createGain();
      saw.type = 'sawtooth';
      saw.frequency.setValueAtTime(155, t);
      f1.type = f2.type = 'bandpass';
      f1.Q.value = f2.Q.value = 3.5;
      f1.frequency.setValueAtTime(320, t);
      f1.frequency.linearRampToValueAtTime(780, t + 0.07);
      f1.frequency.linearRampToValueAtTime(280, t + 0.14);
      f2.frequency.value = 1950;
      env.gain.setValueAtTime(0.14, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      saw.connect(f1).connect(env);
      saw.connect(f2).connect(env);
      env.connect(ctx.destination);
      saw.start(t);
      saw.stop(t + 0.16);
    });
  } else if (kind === 'chord') {
    // 3. Polyphonic Warm Pad + Ascending Harp Glissando (promote / win)
    [261.63, 329.63, 392.0, 493.88, 587.33].forEach((freq, idx) => {
      const pad = ctx.createOscillator();
      const pluck = ctx.createOscillator();
      const gPad = ctx.createGain();
      const gPluck = ctx.createGain();
      pad.type = 'sine';
      pad.frequency.value = freq;
      gPad.gain.setValueAtTime(0.001, now);
      gPad.gain.linearRampToValueAtTime(0.06, now + 0.2);
      gPad.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
      pad.connect(gPad).connect(ctx.destination);
      pad.start(now);
      pad.stop(now + 1.3);

      const tPluck = now + idx * 0.075;
      pluck.type = 'triangle';
      pluck.frequency.value = freq * 2;
      gPluck.gain.setValueAtTime(0.08, tPluck);
      gPluck.gain.exponentialRampToValueAtTime(0.001, tPluck + 0.45);
      pluck.connect(gPluck).connect(ctx.destination);
      pluck.start(tPluck);
      pluck.stop(tPluck + 0.48);
    });
  } else if (kind === 'crumple') {
    // 4. Filtered White-Noise Bursts (archive / paper toss)
    const buf = createNoiseBuffer(ctx, 0.15);
    [0, 0.09, 0.19].forEach((offset, idx) => {
      const src = ctx.createBufferSource();
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      bp.type = 'bandpass';
      bp.frequency.value = 2500 + idx * 450;
      bp.Q.value = 2.2;
      g.gain.setValueAtTime(0.16, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.11);
      src.connect(bp).connect(g).connect(ctx.destination);
      src.start(now + offset);
    });
  }
  return variant;
}
```

### 2. Re-Render-Safe CSS Stage Choreography & `data-naizo-strip` Splash Banners

When animating card transitions (`~850 ms`) before committing state to `Naizo.batch()`:

1. **Strip stage animation classes at the top of `renderStage()` AND on timeout:** If `.stage-anim-merge` stays on `#arena-stage` when `naizo:change` rebuilds `#arena-stage`'s children, the newly rendered incoming card immediately matches `.stage-anim-merge .challenger-card { opacity: 0 }` and renders invisible!
2. **Mount splash banners as a `document.body` singleton with `data-naizo-strip="true"`:** Card flights feel snappy at `850 ms`, whereas humans need `~2500 ms` to read a celebration banner. Mounting the banner on `document.body` keeps it visible across the `850 ms` stage re-render, and `data-naizo-strip="true"` ensures it is stripped if the user exports HTML mid-banner (`D47`):

```javascript
const STAGE_CLASSES = ['stage-anim-merge', 'stage-anim-reject', 'stage-anim-skip'];

function renderStage() {
  const stageEl = document.getElementById('arena-stage');
  if (!stageEl) return;
  stageEl.classList.remove(...STAGE_CLASSES); // Always clear leftover flight classes first!
  // ... rebuild or update stage DOM from Naizo.get(...)
}

function showSplashBanner(message) {
  let banner = document.getElementById('studio-splash-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'studio-splash-banner';
    banner.className = 'splash-banner';
    banner.setAttribute('data-naizo-strip', 'true');
    document.body.appendChild(banner);
  }
  banner.textContent = message;
  banner.dataset.visible = 'true';
  clearTimeout(banner._hideTimer);
  banner._hideTimer = setTimeout(() => {
    banner.dataset.visible = 'false';
  }, 2500);
}
```

### 3. Composable Modular SVG Avatars & `#naizodb` DNA Splicing

Store compact pass-through `dna: { bg, body, head, hat, prop }` objects on items in `#naizodb` (`D15`) and assemble `<g>` layers at render time with a **4-way white sticker `drop-shadow` outline** so dark and light shapes pop cleanly against any backdrop:

```javascript
const AVATAR_PARTS = {
  bg: {
    meadow:
      '<rect width="120" height="120" rx="18" fill="#ecfdf5"/><circle cx="60" cy="58" r="44" fill="#fffbeb" opacity="0.92"/>',
    dusk: '<rect width="120" height="120" rx="18" fill="#eef2ff"/><circle cx="60" cy="58" r="44" fill="#fef3c7" opacity="0.9"/>',
  },
  body: {
    cape: '<path d="M34 108 Q60 72 86 108 Z" fill="#a8432b"/>',
    mech: '<rect x="38" y="76" width="44" height="32" rx="8" fill="#475569"/>',
  },
  head: {
    neko: '<circle cx="60" cy="54" r="22" fill="#f59e0b"/><polygon points="42,38 48,22 56,35" fill="#f59e0b"/><polygon points="78,38 72,22 64,35" fill="#f59e0b"/>',
    owl: '<circle cx="60" cy="54" r="22" fill="#78716c"/><circle cx="52" cy="52" r="6" fill="#fff"/><circle cx="68" cy="52" r="6" fill="#fff"/>',
  },
  hat: {
    crown: '<polygon points="44,32 50,18 60,28 70,18 76,32" fill="#eab308"/>',
    none: '',
  },
  prop: {
    wand: '<line x1="84" y1="88" x2="98" y2="62" stroke="#ca8a04" stroke-width="4" stroke-linecap="round"/>',
    none: '',
  },
};

function renderAvatarSvg(dna = {}) {
  const bg = AVATAR_PARTS.bg[dna.bg] || AVATAR_PARTS.bg.meadow;
  const body = AVATAR_PARTS.body[dna.body] || AVATAR_PARTS.body.cape;
  const head = AVATAR_PARTS.head[dna.head] || AVATAR_PARTS.head.neko;
  const hat = AVATAR_PARTS.hat[dna.hat] || '';
  const prop = AVATAR_PARTS.prop[dna.prop] || '';
  return `<svg viewBox="0 0 120 120" width="72" height="72" aria-hidden="true">
    ${bg}
    <g style="filter: drop-shadow(0px 2px 0px #fff) drop-shadow(0px -1.5px 0px #fff) drop-shadow(2px 0px 0px #fff) drop-shadow(-2px 0px 0px #fff)">
      ${body}${head}${hat}${prop}
    </g>
  </svg>`;
}

function spliceAvatarDna(primaryDna, secondaryDna) {
  return {
    bg: primaryDna.bg || secondaryDna.bg,
    head: primaryDna.head,
    body: secondaryDna.body || primaryDna.body,
    hat: 'crown',
    prop: secondaryDna.prop || primaryDna.prop,
  };
}
```

---

## Pitfalls to Avoid & Why

- **Nesting `<svg x="..." y="..." width="..." height="...">` for animated sub-icons:** Clips outer rings/halos (`overflow: hidden`) and shifts `transform-origin` against the parent viewport; use `<g transform="translate(x, y) scale(s)">` + `transform-box: fill-box; transform-origin: center` (`EC52`).
- **Putting CSS `animation` and SVG `transform="translate(...) scale(...)"` on the same `<g>`:** CSS `transform` overrides the SVG presentation attribute and teleports the group to `(0, 0)`. Split into an outer positioning `<g>` and inner animated `<g>`.
- **Targeting inner sub-shapes with `@keyframes` through `<use href="#symbol">`:** `<use>` creates a closed shadow tree that blocks `.anim .c-top` descendant rules. Reserve `<symbol>` + `<use>` for static icons and inline animated SVGs.
- **Creating `new AudioContext()` at script load time:** Browsers log autoplay warnings and keep the context `'suspended'`. Instantiate and `resume()` lazily inside a user click handler.
- **Storing full rendered `<svg>` strings inside `<script id="naizodb">`:** Bloats `#naizodb` and Git diffs by tens of kilobytes. Store compact `{ head: "neko", body: "mech" }` trait keys in `#naizodb` and render `<svg>` into `[naizo-ignore]` containers.
