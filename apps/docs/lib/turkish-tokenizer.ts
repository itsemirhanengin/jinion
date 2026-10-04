import { stemmer } from '@zbsearch/stemmers/turkish';
import type { Tokenizer } from 'zbsearch';

// zbsearch's own Turkish tokenizer folds ğ, ı and ş away before stemming, which hides most suffixes from the stemmer.
// This one stems first and folds after, so a search typed without Turkish letters finds the same words.
export const turkishTokenizer: Tokenizer = {
  language: 'turkish',
  normalizationCache: new Map(),
  tokenize: (raw) => {
    // `İ` alone becomes `i`; `I` stays an English `i`, as in API and CLI, rather than `ı`.
    const words = raw.replace(/İ/g, 'i').toLowerCase().split(/[^a-z0-9çğıöşüâîû]+/).filter(Boolean);

    // The word itself goes in beside its stem, since the stemmer cuts some too far: `izin` to `iz`, while `izinler`
    // becomes `izin`.
    return [...new Set(words.flatMap((word) => [fold(word), fold(stemmer(word))]))];
  },
};

const fold = (word: string) =>
  word
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
