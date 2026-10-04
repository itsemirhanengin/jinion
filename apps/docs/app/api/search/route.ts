import { source } from '@/lib/source';
import { turkishTokenizer } from '@/lib/turkish-tokenizer';
import { createFromSource } from 'fumadocs-core/search/server';

// The default tokenizer stems no Turkish, so `bellek` wouldn't find `belleği`. `localeMap` is deprecated, but it is the
// only way to give one language a tokenizer of its own.
export const { GET } = createFromSource(source, {
  localeMap: { tr: { components: { tokenizer: turkishTokenizer } } },
});
