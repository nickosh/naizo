# Changelog

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
