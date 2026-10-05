import { useEffect, useState } from 'react';
import type { HighlighterCore } from 'shiki/core';

/** A run of text in one color; `style` carries the light color and the dark one as `--shiki-dark`. */
export interface Token {
  content: string;
  style?: Record<string, string>;
}

const extensions: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'tsx',
  json: 'json',
  md: 'markdown',
  mdx: 'markdown',
  css: 'css',
  html: 'html',
  sh: 'shellscript',
  yml: 'yaml',
  yaml: 'yaml',
};

export function languageOf(path: string) {
  return extensions[path.slice(path.lastIndexOf('.') + 1).toLowerCase()];
}

let highlighter: Promise<HighlighterCore> | undefined;

// Loaded on first use, with the JavaScript engine rather than WebAssembly, so the app's content policy needs nothing more.
function load() {
  highlighter ??= Promise.all([import('shiki/core'), import('shiki/engine/javascript')]).then(([{ createHighlighterCore }, engine]) =>
    createHighlighterCore({
      themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
      langs: [
        import('shiki/langs/typescript.mjs'),
        import('shiki/langs/tsx.mjs'),
        import('shiki/langs/javascript.mjs'),
        import('shiki/langs/json.mjs'),
        import('shiki/langs/markdown.mjs'),
        import('shiki/langs/css.mjs'),
        import('shiki/langs/html.mjs'),
        import('shiki/langs/shellscript.mjs'),
        import('shiki/langs/yaml.mjs'),
      ],
      engine: engine.createJavaScriptRegexEngine(),
    }),
  );

  return highlighter;
}

export async function tokenize(code: string, language: string): Promise<Token[][]> {
  const { codeToTokens } = await load();
  const { tokens } = codeToTokens(code, { lang: language, themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: 'light' });

  return tokens.map((line) => line.map(({ content, htmlStyle }) => ({ content, style: htmlStyle })));
}

/** The code's lines in color once the highlighter is loaded; `undefined` until then, or for a language it doesn't know. */
export function useTokens(code: string, language: string | undefined) {
  const [tokens, setTokens] = useState<Token[][]>();

  useEffect(() => {
    if (!language) return setTokens(undefined);

    let current = true;

    tokenize(code, language).then((lines) => current && setTokens(lines));

    return () => {
      current = false;
    };
  }, [code, language]);

  return tokens;
}
