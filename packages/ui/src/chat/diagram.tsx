import { type ReactNode, useEffect, useState } from 'react';
import { drawDiagram } from '../editor/diagram.js';

/** A Mermaid block in the agent's words, drawn; what doesn't draw stays as its code, `fallback`. */
export function Diagram({ text, fallback }: { text: string; fallback: ReactNode }) {
  const [svg, setSvg] = useState<string | null>();

  useEffect(() => {
    let current = true;

    drawDiagram(text).then(
      (drawn) => current && setSvg(drawn),
      () => current && setSvg(null),
    );

    return () => {
      current = false;
    };
  }, [text]);

  if (svg === null) return fallback;

  return (
    <div
      role="img"
      aria-label="Diagram"
      className="flex min-h-16 justify-center rounded-xl bg-raised/60 px-4 py-4 ring-1 ring-line [&_svg]:h-auto [&_svg]:max-w-full"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid's strict mode cleans the SVG it draws
      dangerouslySetInnerHTML={{ __html: svg ?? '' }}
    />
  );
}
