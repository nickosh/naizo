# Changelog

## [0.3.0](https://github.com/nickosh/naizo/compare/v0.2.0...v0.3.0) (2026-11-28)


### Features

* add declarative Mini-API client, Naizo.setList, Naizo.fetch, and #net globe (M8.1) ([aae9500](https://github.com/nickosh/naizo/commit/aae9500add160740ce2b1e407bb8cf415bf2db03))
* add M15.1 two-tier 3-way list merge, list DOM reconciliation, and live disk-sync guards ([972db53](https://github.com/nickosh/naizo/commit/972db530f81be474fde9878925e9826e51825a40))
* add naizo-no-pill headless mode and Naizo.link() disk-link API ([f0ac967](https://github.com/nickosh/naizo/commit/f0ac96799695268e29fa6b3b173010cf821f922e))
* add Naizo.batch(), Naizo.ready(), naizo-pill-corner, and M13.1 runtime refinements ([a360248](https://github.com/nickosh/naizo/commit/a360248de169ae0d53e00ad6b6e9c4f246064978))
* **examples:** add weather outing planner and network debugging docs ([12318f6](https://github.com/nickosh/naizo/commit/12318f688f3fce5023e4dbe031d484339f6d9c20))
* harden M19.1 startup JSON repair, initNaizo epoch reset, and Status Pill EC36 transitions ([8bbadab](https://github.com/nickosh/naizo/commit/8bbadab2630a414ec66e9fa397d2e5b71cb0cc74))
* **site:** add brand logo assets, 62x62 Hero Crest, and README header (M9.1) ([cc9a724](https://github.com/nickosh/naizo/commit/cc9a724b2aad0ec4ee28e12a9d4261995d89f1a1))
* **site:** add Maru ni Mitsuishi logo to site SEO metadata and example favicons (M9.1) ([6bd5ebf](https://github.com/nickosh/naizo/commit/6bd5ebf1de11676b1bd7e87b757622d048514b03))
* **ui:** implement frosted-glass Status Pill, Maru ni Mitsuishi #dot animations, 1-6 icon buttons, and 4-corner snap drag (M9.2) ([556d703](https://github.com/nickosh/naizo/commit/556d703920657d0f1aebb2def849148d77cf6008))


### Bug Fixes

* align M15.2 &lt;select&gt; CSS and synchronize browser, live-reload, and list-merge docs ([2a266ef](https://github.com/nickosh/naizo/commit/2a266efe9b994dd12c9c4df1e7c8f386df35e224))
* **docs:** use transform-box fill-box and &lt;g&gt; transforms in SVG explainers for Chrome (M9.3) ([b639c94](https://github.com/nickosh/naizo/commit/b639c94f6630e350b2dd845be504c6be5fbdf096))
* harden M15.3 list merge, live invalid-JSON persistence, and HTML scanner edge cases ([4d3586d](https://github.com/nickosh/naizo/commit/4d3586d0bbdc843edfe8bf765b982db4c5d6df3b))
* harden M19.2 blueprints, playground, and status-pill design assets ([1757d50](https://github.com/nickosh/naizo/commit/1757d50437235f0238e3eb3e86ef0d228daa116d))
* harden M8.1 Mini-API client boundaries and record D51 ([5d9d73b](https://github.com/nickosh/naizo/commit/5d9d73bd66517443460dffc26db35ecdf2d1ecd3))
* keep programmatic Naizo.fetch without into non-mutating ([c83e3ca](https://github.com/nickosh/naizo/commit/c83e3ca0cbcf5b1dc6c9ed62cae4ca1122a25526))
* **net:** persist #net error indicator across subsequent successful requests until clicked (D50, EC50) ([872b4ba](https://github.com/nickosh/naizo/commit/872b4ba1ad2abe28930fc8c9d8404ca2d8459d5a))
* **pill:** clarify unlinked #dot status label and defer drag pointer capture ([a9c1328](https://github.com/nickosh/naizo/commit/a9c13283020e320b0a1ac5dbd3e06be38b54f6a2))
* **pill:** clear stale pre-link Reset backups on Link Disk while preserving conflicts ([6f5928b](https://github.com/nickosh/naizo/commit/6f5928b9b0024e6d8e64ee947c19e33330d09ef0))
* **pill:** harden hit-testing, 22x22 crest, FLIP drag, unlinked Reset, and &lt;100 KB compaction ([0771bda](https://github.com/nickosh/naizo/commit/0771bdaffca2272830412cbc89dce386ae3ab749))
* **pill:** keep status crest a pure indicator and drag handle (M19.7) ([d886c6f](https://github.com/nickosh/naizo/commit/d886c6f1af4a4cf1cdb973ac17cc187b4b7152d3))
* **site:** add dark/light favicons, logo.png, 22x22 crest symbols, and real KB doc sync ([fcfb207](https://github.com/nickosh/naizo/commit/fcfb2072076f5911b3e34ff8dfea631c7b7cc721))
* unify M19.4 initEpoch and handle-session async fencing across peripheral I/O ([3af0dd1](https://github.com/nickosh/naizo/commit/3af0dd1560538354e8f697dc8338ec65208cfd23))

## [0.2.0](https://github.com/nickosh/naizo/compare/v0.1.0...v0.2.0) (2026-10-28)


### Features

* **examples:** add Basecoat UI inventory studio and preserve naizo-ignore in auto-templates ([c78dd64](https://github.com/nickosh/naizo/commit/c78dd64378afb0a3c4bdffbc18cdd8c1e4044154))
* **examples:** add Basecoat UI self-persisting inventory studio ([257284c](https://github.com/nickosh/naizo/commit/257284cad808421ac673b1cc9228a5e992d3e267))
* **export:** rewrite portable script src to dist/naizo.min.js and sync README with site ([f190f31](https://github.com/nickosh/naizo/commit/f190f31bf3c9638735b014d4334a3e1add65d32d))
* replace data-naizo-runtime with naizo-strip / data-naizo-strip (M6.3) ([163f013](https://github.com/nickosh/naizo/commit/163f013cf3cee31c150eb6b0e90fec7e912d9ce7))
* **runtime,examples:** implement M4.5 save shortcut, online mode, notes app, and cleanup ([a740ef1](https://github.com/nickosh/naizo/commit/a740ef1898a78a58494b409819fa0618dbc54da8))
* **runtime:** add richer bindings, list polish, and full Naizo API ([bea3a98](https://github.com/nickosh/naizo/commit/bea3a98a643b54901b18092bf949d9b22036c66c))
* **runtime:** implement in-memory store, sync boot, and O(1) capture ([ea7d0d9](https://github.com/nickosh/naizo/commit/ea7d0d9d1d21b2e08ac9fcea3c337966eb51c3ad))
* **runtime:** implement M4 core runtime re-architecture and hardening ([b380e0d](https://github.com/nickosh/naizo/commit/b380e0de918f91ed4dc97694dd5495a351d8392a))
* **runtime:** implement surgical disk sync, live watch, and key merge ([daa7049](https://github.com/nickosh/naizo/commit/daa70493d5c687381183377cb298c18a037e1512))
* **site:** add Cloudflare Web Analytics beacon with naizo-strip in site/index.html (M6.4) ([5314481](https://github.com/nickosh/naizo/commit/53144811627e7dafb6817df0f69b32d773197d5b))
* **site:** add M6.2 AI-agent discovery endpoints, CNAME, and Pages staging ([8acff38](https://github.com/nickosh/naizo/commit/8acff385fadeb4e602dd432a64bc836b095e57a4))
* **site:** build M6.1 documentation and interactive demo website ([21ac739](https://github.com/nickosh/naizo/commit/21ac739bdd64f5a9e507129f896c5cbdb87fe004))


### Bug Fixes

* **ci:** ignore Release Please CHANGELOG.md in Oxfmt check ([8e93436](https://github.com/nickosh/naizo/commit/8e93436a22ad8423a899679e59a86eea6e12d2df))
* **docs,skill:** fix CLI regex $1 replacement bug and align M5 docs with runtime ([33dcb40](https://github.com/nickosh/naizo/commit/33dcb40b7c5973919bc760da47e86541eede4740))
* **examples:** allow drag-safe backdrop dismissal on inventory form modals ([1ca2493](https://github.com/nickosh/naizo/commit/1ca2493a88f0b87655cdfc9bae9f663c7363e20f))
* **examples:** harden inventory modal state, custom keys, and filter matching ([de4363e](https://github.com/nickosh/naizo/commit/de4363ee534536389854ebac443c1c1b95980746))
* **examples:** persist category_filter in examples/notes.html ([ee8632e](https://github.com/nickosh/naizo/commit/ee8632e40ca49438e07138ee8380562a964c031b))
* **examples:** preserve modal drafts and disable form backdrop dismissal in inventory.html ([250be1a](https://github.com/nickosh/naizo/commit/250be1a4ecc9d35948ae38759aa93d291cba5836))
* **runtime,examples:** preserve naizo-ignore in auto-templates and polish inventory studio ([2c5bbf1](https://github.com/nickosh/naizo/commit/2c5bbf16452f4f3b457e55af2a650d0608112991))
* **runtime:** harden M4.5 keyboard save, cross-tab merge, reset, and notes example ([7496d4a](https://github.com/nickosh/naizo/commit/7496d4adcf7a1d4cfc8e7ef56bbcaac79359ba65))
* **runtime:** preserve leading ignored children in writeCleanTextContent and drop redundant naizo-ignore ([c784f83](https://github.com/nickosh/naizo/commit/c784f8324fb4c96b2d764d2b9f6037df8b28a8ef))
* **runtime:** resolve post-M4 audit bugs and deduplicate boot/sync ([eea0032](https://github.com/nickosh/naizo/commit/eea00323182eba55835845e48b536593421e859b))
* **runtime:** support cold-reload per-key hash merge, repair, and delete ([1421789](https://github.com/nickosh/naizo/commit/142178941c58f2eabad5f64079a6994f380e1674))

## 0.1.0

### Features

- Self-persisting HTML state with `#naizodb`, form bindings, and custom widget APIs.
- Declarative list repeaters with both short and `data-*` attribute syntax.
- Browser storage, linked-file persistence, and clean HTML export.
- Zero-dependency browser bundles (readable and minified), ESM, and TypeScript declarations.
