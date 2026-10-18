/**
 * naka.js v0.1.0 — Browser IIFE Entrypoint
 * Attaches window.Naka / window.NakaDB and auto-initializes unless opted out via data-naka-manual / naka-manual.
 * License: MIT
 */

import { initNaka, Naka, NakaDB } from './index';

function hasManualOptOut(): boolean {
  if (typeof document === 'undefined') return true;
  const docEl = document.documentElement;
  const bodyEl = document.body;
  const currentScript = document.currentScript;
  return Boolean(
    docEl?.hasAttribute('data-naka-manual') ||
    docEl?.hasAttribute('naka-manual') ||
    bodyEl?.hasAttribute('data-naka-manual') ||
    bodyEl?.hasAttribute('naka-manual') ||
    currentScript?.hasAttribute('data-naka-manual') ||
    currentScript?.hasAttribute('naka-manual') ||
    document.querySelector('script[data-naka-manual], script[naka-manual]'),
  );
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.Naka = Naka;
  window.NakaDB = NakaDB;

  const start = (): void => {
    if (!hasManualOptOut()) {
      void initNaka();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}
