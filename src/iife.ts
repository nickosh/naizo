/**
 * naizo.js — Browser IIFE Entrypoint
 * Attaches window.Naizo / window.NaizoDB and auto-initializes unless opted out via data-naizo-manual / naizo-manual.
 * License: MIT
 */

import { initNaizo, Naizo, NaizoDB } from './index';

function hasManualOptOut(): boolean {
  if (typeof document === 'undefined') return true;
  const docEl = document.documentElement;
  const bodyEl = document.body;
  const currentScript = document.currentScript;
  return Boolean(
    docEl?.hasAttribute('data-naizo-manual') ||
    docEl?.hasAttribute('naizo-manual') ||
    bodyEl?.hasAttribute('data-naizo-manual') ||
    bodyEl?.hasAttribute('naizo-manual') ||
    currentScript?.hasAttribute('data-naizo-manual') ||
    currentScript?.hasAttribute('naizo-manual') ||
    document.querySelector('script[data-naizo-manual], script[naizo-manual]'),
  );
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.Naizo = Naizo;
  window.NaizoDB = NaizoDB;

  const start = (): void => {
    if (!hasManualOptOut()) {
      void initNaizo();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}
