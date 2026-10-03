import { defineConfig } from 'fumadocs-mdx/config';
import { remarkTerminal } from './lib/remark-terminal';

// Collections are defined in lib/source.ts with the Macro API; this holds the MDX options they share.
export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkTerminal],
  },
});
