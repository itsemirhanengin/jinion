# @jinion/tui

Terminal UI framework for Jinion, built on [Ink](https://github.com/vadimdemedes/ink) and React.

Everything is drawn with plain ASCII: frames use `+`, `-` and `|`, trees use `|--` and `'--`. No Unicode box-drawing characters.

```
+--- ~ Edit: ts src/server.ts [+2/-1] -----------------------------+
|   2|import { cors, errorHandler, requestId } from './index.js';  |
| + 3|import { rateLimit } from './middleware/rate-limit.js';      |
| - 7|app.use(requestId(), cors());                                |
| + 8|app.use(requestId(), cors(), rateLimit());                   |
+------------------------------------------------------------------+

[x] Grep: rateLimit|throttle 2 matches - 2 files - in src
|-- src/routes/auth.ts
|   '-- 41|// TODO: throttle repeated logins
'-- src/http/errors.ts
    '-- 18|export class TooManyRequests extends HttpError {
```

## Model

Apps run full screen in the alternate screen buffer. The root is a column exactly as tall as the terminal, and `Shell` lays it out: `content` (usually a `ScrollView`) takes the remaining height, while `aside`, `prompt` and `status` stay pinned to the bottom.

- `run(<App />)` detects a light or dark background, enters the alternate screen, turns on mouse and focus reporting and returns Ink's instance.
- `ScrollView` follows the newest line. The mouse wheel or PageUp scrolls it; once scrolled, the view holds still while content grows below it, and a `Jump to bottom (click)` row brings it back.
- Mouse reports are filtered out of stdin before Ink sees them, so key handlers never receive them. `useMouse()` subscribes to wheel and click events. While reporting is on, terminals select text with Shift held (Option in iTerm2).
- `useTerminal()` tells whether the window has focus (`focused()`, from the terminal's focus reports, which are filtered out like mouse reports) and shows desktop notifications (`notify(title, body)`) with the sequence the terminal understands: OSC 777, 9 or 99, or the bell (`method`).
- `useView()` exposes the global `expanded` flag that collapsible output reads; `ctrl+o` in the CLI toggles it.
- `useTheme()` returns the active `Theme`. `useContentWidth()` returns the columns available at the current depth; `Frame` and other containers reduce it for their children with `Inset`.

```tsx
import { useState } from 'react';
import { Composer, ScrollView, Shell, UserMessage, run } from '@jinion/tui';

function App() {
  const [messages, setMessages] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  return (
    <Shell
      content={
        <ScrollView>
          {messages.map((text, index) => (
            <UserMessage key={index} text={text} />
          ))}
        </ScrollView>
      }
      prompt={
        <Composer value={draft} onChange={setDraft} onSubmit={(text) => { setMessages([...messages, text]); setDraft(''); }} />
      }
    />
  );
}

await run(<App />);
```

## Panels

Anything that is not the conversation or the prompt is a panel: questions, help, session pickers, and later settings. A panel is a component opened with a placement:

| Placement | Takes | Keeps visible |
| --- | --- | --- |
| `bottom` | the prompt's place | conversation, aside, status line |
| `fullscreen` | the whole screen | nothing |

```tsx
const panels = usePanels();
panels.open({ id: 'help', placement: 'bottom', element: <HelpPanel /> });
```

Panels form a stack; opening an id that is open replaces it, and closing returns to whatever was below. Inside a panel, `usePanel().close()` closes it. Panels own their keys, including Esc, and use the `Panel` chrome so they all look alike: an accent `+- Title` frame, an optional header (tabs, a search field, a question), the body, and `KeyHints` at the bottom. `grow` makes the body fill the height, which full screen panels want.

Lists inside panels use `SelectList` (windowed, with `… n more` markers), `ListRow` (`> label   description   aside`), `useListNavigation` and `useTabs`. `fuzzyFilter` and `Highlight` cover search.

### Choices

Every panel where the user picks something is built on `useChoiceList` and `ChoiceList`, so they look and behave the same:

```
single                                   multiple
> 1. Opus 5.5             current        > 1. [x] Typecheck
     For complex work                         pnpm typecheck
  2. Sonnet 5.5                            2. [ ] Lint
```

| Key | `single` | `multiple` |
| --- | --- | --- |
| up/down, 1-9 | move the focus | move the focus |
| space | | checks or unchecks the focused option, which stays where it is |
| enter | picks the focused option | submits the checked options |
| esc | cancels | cancels |

Options are keyed, so focus and checks stay with an option when the list reorders or loads late. `onToggle` can take over space for an option, e.g. to ask for text first, and shift with up/down is left to the panel, e.g. for moving options. Panels add their own keys next to these: `n` for a note, left/right for an effort or a style.

## Completions

`Composer` is the prompt between dashed rules. Its `completions` are functions from the prompt text and cursor to a `Completion`: the range to replace and the items to offer. The first source with items wins, and the list appears under the prompt (up/down move, Tab inserts, Enter accepts, Esc dismisses). Slash commands are one source, `@` file mentions and `$` skills others. Items with a `group` show under its header, indented, and the first item in view repeats its header when the list scrolls.

```ts
const slash: CompletionSource = (value) =>
  value.startsWith('/') && !/\s/.test(value)
    ? { from: 0, to: value.length, submit: true, items: [{ key: 'help', label: '/help', insert: '/help ' }] }
    : undefined;
```

## Testing

`@jinion/tui/testing` mounts a component the way `run()` does, in an emulated terminal (xterm's headless one) instead of the real one. Input goes through the same mouse filter as in an app, and Ink stays interactive in CI too.

```tsx
import { KEYS, renderTerminal } from '@jinion/tui/testing';

const terminal = renderTerminal(<App />, { columns: 80, rows: 24 });
await terminal.type('$de');
await terminal.press(KEYS.tab, KEYS.enter);
const screen = await terminal.waitFor('Done');  // fails with the screen when it never shows up
expect(await terminal.colorOf('$design')).toBe(darkTheme.code);
terminal.unmount();
```

`type` sends one character at a time, as a person would. `focus(false)` reports the window losing focus, and `notifications()` lists what was notified, as `title: body`. `colorOf(text, at)` reads the color `at` characters into a match, e.g. one square of a heatmap row. Colors need `FORCE_COLOR=3` in the test environment, since tests don't run in a TTY. The entry is only exported under the `development` condition, so it never ships in the build.

## Components

Primitives

| Component | Renders |
| --- | --- |
| `Shell` | the screen layout that hosts panels |
| `ScrollView` | the scrolling message area with `Jump to bottom` |
| `Panel`, `KeyHints` | the shared panel chrome and its `Enter select · Esc close` footer |
| `SelectList`, `ListRow` | windowed lists and the standard row |
| `OptionRow`, `NoteLine` | a numbered option with its description, a `[x]` box when several can be picked, a muted `aside` such as `current`, and a note |
| `useChoiceList`, `ChoiceList` | the single and multiple choice lists every picking panel is built on |
| `Meter` | `[======----]`, colored by how full it is |
| `StatGrid` | figures as `label  value` pairs in columns, each column's labels lined up |
| `Tabs`, `useTabs` | a tab bar with the active tab as a filled chip; `useTabs` switches with tab and shift+tab, and left/right unless `arrows` is off for content that takes them |
| `Highlight` | text with matched characters emphasized |
| `Frame`, `FrameDivider` | `+--- title ---+` boxes with sections, an optional tinted `tone`, `borderColor` and title `lead`; `fit` makes the box as wide as its content |
| `Rule` | full-width `------`, optionally titled |
| `Fill` | a character repeated across the remaining width |
| `Tree`, `TreeRow` | `\|--` / `'--` trees |
| `Spinner`, `StatusMark` | `[ ]`, `[/]` (animated), `[x]`, `[!]`, `[-]` |
| `Prose` | text that wraps without leaving a space at the start of continuation lines |

Charts

| Component | Renders |
| --- | --- |
| `Heatmap` | a calendar of days as GitHub's contribution graph: a column per week, a square per day shaded by the quartile it falls in, months over the weeks they start in, as many weeks as fit, and `selected` marks a day in the accent color |
| `useDayCursor` | a day picked in a `Heatmap` with the arrows, left/right a week and up/down a day |
| `dayKey`, `parseDay`, `addDays`, `heatLevels` | local `2026-09-21` day keys and the quartile levels the heatmap shades by |
| `BarList` | rows of `label [=====-----] text` lined up, for shares of a whole |

The heatmap's `■` is the one character beyond ASCII: a day needs a square. Its shades come from the theme's `heat`.

Content

| Component | Renders |
| --- | --- |
| `Markdown` | headings, lists, code blocks, quotes and ASCII tables |
| `Diff` | a unified diff with a line number gutter and intra-line highlights |
| `OutputLines` | command output collapsed to its tail until expanded |
| `ShellCommand` | a highlighted `$ command` line |

Chat

| Component | Renders |
| --- | --- |
| `UserMessage`, `Thinking`, `Notice` | conversation text |
| `ToolLine` | compact tool calls with an optional result tree |
| `ShellBlock`, `EditBlock` | command and edit frames |
| `TodoBlock`, `TodoPanel` | the todo list as a frame and as the pinned panel above the prompt |
| `AskPanel` | questions that take the prompt's place, as a single choice or, with `multiple`, any number of answers; `n` adds a note, "Other" takes free text |
| `PlanPanel` | approves a plan shown above it, offering ways to carry on, or sends it back with a note |
| `PermissionPanel` | asks before the agent runs something: yes, yes and don't ask again, no with a note |
| `ModelPanel` | the agent's models with their effort levels: up/down for the model, left/right for the effort |
| `AskResult` | the answered questions as they stay in the conversation |
| `Composer` | the prompt between dashed rules, with completions; the rules show lines scrolled out of view, `footer` goes on the lower rule, `pastes` turns long pastes into placeholders, `mentions` highlights more than `@path`, e.g. skills, `onPaste` can turn a paste into something else first, and `onPasteKey` inserts what ctrl+v brings, e.g. an image placeholder |
| `PastedImages`, `PASTED_IMAGE` | images in the prompt as `[Image #1]` placeholders, which act as one character like pastes, and the images a text refers to |
| `PromptInput` | the bare multiline editor with history and readline shortcuts, also used inside panels; wraps to the width it gets, scrolls past `maxRows` (20), treats `atoms` as single characters, and colors `highlight` spans |
| `MENTION`, `mention` | the `@path` pattern prompts and user messages highlight, and how a path is written as one |
| `namedMention`, `anyOf` | a pattern for known names after a sigil, such as `$design`, so `$HOME` stays plain; and one pattern out of several |
| `PastedTexts` | keeps long pastes as `[Pasted text #1 +42 lines]` and expands them when the prompt is sent |
| `Working`, `StatusBar`, `Tag` | activity indicator and the status line, with items on the left and the right |

Ink's `Box`, `Text`, `useInput`, `useApp` and friends are re-exported, so apps depend on this package alone.
