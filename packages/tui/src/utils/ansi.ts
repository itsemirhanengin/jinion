const CSI = String.raw`\[[0-?]*[ -/]*[@-~]`;
const OSC = String.raw`\][^\x07\x1b]*`;
const OSC_END = String.raw`(?:\x07|\x1b\\)`;
const SHORT = String.raw`[@-Z\\-_]`;

/** For outside text, where an OSC cut off before its end takes the rest of the text with it. */
export const TEXT_ESCAPES = new RegExp(String.raw`\x1b(?:${CSI}|${OSC}${OSC_END}?|${SHORT})`, 'g');

/** Also DCS, SOS, PM and APC strings, and `\x1b7`, `\x1b8`, `\x1b=`, `\x1b>`, so reading a frame leaves none as text. */
export const OUTPUT_ESCAPE = new RegExp(
  String.raw`\x1b(?:${CSI}|${OSC}${OSC_END}|[PX^_][^\x1b]*\x1b\\|${SHORT}|[0-9=>])`,
  'y',
);
