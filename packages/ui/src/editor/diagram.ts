type Mermaid = typeof import('mermaid').default;

let mermaid: Promise<Mermaid> | undefined;

let drawn = 0;

// Mermaid keeps what it parses in state of its own, so two diagrams drawn at once mix their edges; one at a time.
let queue: Promise<unknown> = Promise.resolve();

// Mermaid derives its shades from plain colors, so the window's tokens, some of them translucent, are spelled out here.
const LIGHT = {
  primaryColor: '#ffffff',
  primaryBorderColor: '#d4d4d8',
  primaryTextColor: '#09090b',
  lineColor: '#a1a1aa',
  secondaryColor: '#f4f4f5',
  tertiaryColor: '#ffffff',
  edgeLabelBackground: '#fcfcfc',
};

const DARK = {
  primaryColor: '#18181b',
  primaryBorderColor: '#3f3f46',
  primaryTextColor: '#fafafa',
  lineColor: '#71717a',
  secondaryColor: '#27272a',
  tertiaryColor: '#0f0f11',
  edgeLabelBackground: '#121214',
};

/**
 * A diagram's text drawn as SVG in the window's type and colors. Mermaid is large, so it loads with the first diagram;
 * its strict mode cleans what it draws, so a diagram the agent wrote can't run anything.
 */
export function drawDiagram(text: string) {
  const turn = queue.then(() => draw(text));

  queue = turn.catch(() => {});

  return turn;
}

async function draw(text: string) {
  mermaid ??= import('mermaid').then((module) => module.default);

  const library = await mermaid;
  const dark = document.documentElement.classList.contains('dark');

  library.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-sans'),
    themeVariables: { ...(dark ? DARK : LIGHT), fontSize: '12px' },
    // The window's surfaces: rounded, and no shadow, which it keeps for what floats. Mermaid sets its own shadows in
    // its styles, which only this outweighs; the rule stays inside this diagram's SVG.
    themeCSS: '* { filter: none !important; } .node rect { rx: 8px; ry: 8px; }',
  });

  const { svg } = await library.render(`diagram-${++drawn}`, text);

  return svg;
}
