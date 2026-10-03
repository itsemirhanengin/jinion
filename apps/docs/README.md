# @jinion/docs

Jinion's documentation, built with [Fumadocs](https://fumadocs.dev) on Next.js and served at
[docs.jinion.co](https://docs.jinion.co).

```bash
pnpm dev:docs        # from the repo root, or `pnpm dev` here
```

Open http://localhost:3000. The docs sit at the site root, not under `/docs`.

## Writing pages

Pages are MDX files in `content/docs`, one per page, with a `title` and a one-line `description` in the frontmatter.
The description shows under the title and in `llms.txt`.

- **Order and sections** come from `meta.json`; `---Name---` starts a section. `meta.tr.json` is the same list with the
  section names in Turkish, so a page added to one goes in the other too.
- **Turkish** goes next to the English page as `memory.tr.mdx`, at `/tr/memory`. A page without one shows the English
  page, so only add the file once the page is translated: an empty one would hide the English.
- **Screens of Jinion** go in a `terminal` code block, written as the screen shows, with spans marked by the TUI
  theme's names (`lib/terminal.ts`). Unknown names stay visible on the page. The Markdown version of the page gets the
  screen without the marks.

  ````md
  ```terminal title="~/code/api"
  {border|+-} {accent,bold|jinion} {muted|v0.1.0} {border|-----+}
   {muted|Ask jinion anything · / commands · $ skills · @ files}
  ```
  ````

## Layout

| Path                                 | What it is                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `content/docs`                       | The pages, as MDX, and their order in `meta.json`.                                       |
| `app/[lang]`                         | Everything served per language: the docs layout and pages, Markdown, OG images.          |
| `app/api/search`                     | The search route handler, for both languages.                                            |
| `proxy.ts`                           | Puts English at the root and Turkish under `/tr`; serves `.md` URLs.                     |
| `lib/i18n.ts`, `lib/translations.ts` | The languages, and Fumadocs' interface text in Turkish.                                  |
| `lib/source.ts`, `source.config.ts`  | The content source (Fumadocs MDX's Macro API) and its MDX plugins.                       |
| `components/terminal.tsx`            | Draws a `terminal` block; `lib/remark-terminal.ts` makes one, `lib/terminal.ts` reads its marks. |
| `app/global.css`                     | Jinion's colors and fonts, and the TUI theme's colors for screens.                       |
