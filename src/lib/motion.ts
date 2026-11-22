/**
 * Shared framer-motion easing: a cubic-bezier "ease-out-quint".
 * framer-motion 14 types a bezier as a 4-tuple, so keep the tuple type explicit;
 * a plain array literal stored in a variable widens to number[] and fails to typecheck.
 * Mirrors the `--ease-out` CSS token in src/styles/tokens.css.
 */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
