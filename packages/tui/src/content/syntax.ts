import { useEffect, useMemo, useState } from 'react';
import type { HighlighterCore } from 'shiki/core';
import { useTheme } from '../runtime/theme.js';
import type { ColorScheme } from '../theme/themes.js';

export interface SyntaxToken {
  text: string;
  color?: string;
}

const THEMES: Record<ColorScheme, string> = { dark: 'one-dark-pro', light: 'one-light' };

// Tokenizing runs on the thread that draws, so code past these limits stays plain rather than stall the screen.
const MAX_CODE_LENGTH = 200_000;
const MAX_LINE_LENGTH = 1_000;

const CACHE_SIZE = 200;

let highlighter: Promise<HighlighterCore> | undefined;
let loadedHighlighter: HighlighterCore | undefined;

const languages = new Map<string, Promise<boolean>>();
const loadedLanguages = new Set<string>();
const cache = new Map<string, SyntaxToken[][]>();

export function useSyntax(code: string, language: string | undefined) {
  const { scheme } = useTheme();

  const [loads, setLoads] = useState(0);

  const name = code.length <= MAX_CODE_LENGTH ? language?.toLowerCase() : undefined;
  const lines = useMemo(() => (name ? tokenize(code, name, scheme) : undefined), [code, name, scheme, loads]);

  useEffect(() => {
    if (lines || !name) return;

    let current = true;

    prepare(name).then((ready) => current && ready && setLoads((count) => count + 1));

    return () => {
      current = false;
    };
  }, [lines, name]);

  return lines;
}

function tokenize(code: string, language: string, scheme: ColorScheme) {
  if (!loadedHighlighter || !loadedLanguages.has(language)) return undefined;

  const key = `${scheme}\n${language}\n${code}`;
  const cached = cache.get(key);

  if (cached) {
    cache.delete(key);
    cache.set(key, cached);

    return cached;
  }

  const lines = loadedHighlighter
    .codeToTokensBase(code, { lang: language, theme: THEMES[scheme], tokenizeMaxLineLength: MAX_LINE_LENGTH })
    .map((line) => line.map(({ content, color }) => ({ text: content, color })));

  cache.set(key, lines);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);

  return lines;
}

function prepare(language: string) {
  let ready = languages.get(language);

  if (!ready) {
    ready = Promise.all([load(), import('shiki/langs')])
      .then(async ([loaded, { bundledLanguages }]) => {
        const grammar = bundledLanguages[language as keyof typeof bundledLanguages];
        if (!grammar) return false;

        await loaded.loadLanguage(grammar);
        loadedLanguages.add(language);

        return true;
      })
      .catch(() => false);

    languages.set(language, ready);
  }

  return ready;
}

// The JavaScript engine needs no WebAssembly; forgiving, a grammar with a pattern it can't run still colors the rest.
function load() {
  highlighter ??= Promise.all([import('shiki/core'), import('shiki/engine/javascript')]).then(async ([{ createHighlighterCore }, engine]) => {
    loadedHighlighter = await createHighlighterCore({
      themes: [import('shiki/themes/one-dark-pro.mjs'), import('shiki/themes/one-light.mjs')],
      langs: [],
      engine: engine.createJavaScriptRegexEngine({ forgiving: true }),
    });

    return loadedHighlighter;
  });

  return highlighter;
}
