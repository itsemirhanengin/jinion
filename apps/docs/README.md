# @jinion/docs

Jinion's documentation, built with [Fumadocs](https://fumadocs.dev) on Next.js and served at
[docs.jinion.co](https://docs.jinion.co).

```bash
pnpm dev:docs        # from the repo root, or `pnpm dev` here
```

Open http://localhost:3000. The docs sit at the site root, not under `/docs`.

## How the pages are arranged

`content/docs` has three tabs, picked at the top of the sidebar, and each tab has groups under headings:

```text
content/docs/
|-- (guides)/          Guides, at the root: /memory, /conversations/rewind
|   |-- (get-started)/
|   |-- (concepts)/
|   '-- ...
|-- how-to/            How to: /how-to/use-tmux
'-- reference/         Reference: /reference/commands
```

- A tab's `meta.json` has `"root": true`, a title, a description and an icon (a [Lucide](https://lucide.dev/icons)
  name), shown in the picker. Its `pages` list the groups: `---Concepts---` is a heading, and `...(concepts)` brings that
  folder's pages up under it.
- A folder whose name is in parentheses groups pages without adding to their URL; its `meta.json` orders them. A folder
  without parentheses, such as `conversations/`, adds to the URL and shows as a folder that opens and closes.
- `meta.tr.json` is the same file with the titles in Turkish, so a page added to one goes in the other too.

## Writing pages

A page is an MDX file with a `title` and a one-line `description` in the frontmatter. The description shows under the
title and in `llms.txt`.

- **Turkish** goes next to the English page as `memory.tr.mdx`, at `/tr/memory`. A page without one shows the English
  page, so only add the file once the page is translated: an empty one would hide the English.
- **Commands to type in a shell** go in `sh` code blocks, titled Terminal on their own. Prompts to the agent go in
  `text` blocks.
- **Cards** link to pages: `<Cards>` with a `<Card title href description />` each. **Callouts** are `<Callout>`, or
  `<Callout type="warn">` for a warning. Both are Fumadocs' own.
- **Screens of Jinion** go in a `terminal` code block, written as the screen shows, with spans marked by the TUI
  theme's names (`lib/terminal.ts`). Inside a mark, write `}` as `\}` and `\` as `\\`. Unknown names stay visible on
  the page. The Markdown version of the page gets the screen without the marks.

  ````md
  ```terminal title="~/code/api"
  {border|+-} {accent,bold|jinion} {muted|v0.1.0} {border|-----+}
   {muted|Ask jinion anything · / commands · $ skills · @ files}
  ```
  ````

## Layout

| Path                                 | What it is                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `content/docs`                       | The pages, as MDX, with a `meta.json` per folder.                                  |
| `app/[lang]`                         | Everything served per language: the docs layout and pages, Markdown, OG images.    |
| `app/api/search`                     | The search route handler, for both languages.                                      |
| `components/layout/wordmark.tsx`     | The `>_` mark and the name at the top of the sidebar.                              |
| `components/terminal.tsx`            | Draws a `terminal` block; `lib/remark-terminal.ts` makes one, `lib/terminal.ts` reads its marks. |
| `app/global.css`                     | The colors and fonts; `app/styles/terminal.css` styles the screens.                |
| `proxy.ts`                           | Puts English at the root and Turkish under `/tr`; serves `.md` URLs.               |
| `lib/i18n.ts`, `lib/translations.ts` | The languages, and Fumadocs' interface text in Turkish.                            |
| `lib/source.ts`, `source.config.ts`  | The content source (Fumadocs MDX's Macro API) and its MDX plugins.                 |
