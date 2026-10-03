/**
 * Whole frames, not only changed lines: where the terminal measures a character differently from Ink (some emoji), a
 * changed-lines redraw leaves stray cells on rows it thinks unchanged, and the screen falls apart.
 */
export const DRAWING = {
  alternateScreen: true,
  exitOnCtrlC: false,
  incrementalRendering: false,
} as const;
