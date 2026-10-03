/**
 * How Ink draws the app, the same in `run()` and in the test terminal, so tests see what users do.
 *
 * Every frame is drawn whole rather than only its changed lines. Ink lays a frame out by its own measure of each
 * character; where the terminal measures one differently, as with an emoji some terminals draw a column narrower, a
 * changed-lines-only redraw leaves what it misplaced on rows it thinks are unchanged, and the screen keeps falling
 * apart. A whole frame erases every row first, so a stray cell lasts one frame at most. Ink wraps each frame in
 * synchronized output, so terminals that support it show it at once, without flicker.
 */
export const DRAWING = {
  alternateScreen: true,
  exitOnCtrlC: false,
  incrementalRendering: false,
} as const;
