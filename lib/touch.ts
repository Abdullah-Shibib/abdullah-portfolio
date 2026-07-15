/** Coarse-pointer (phone/tablet) detection — client-only bundle, safe to read. */
export const IS_TOUCH =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 1 || window.innerWidth < 700);
