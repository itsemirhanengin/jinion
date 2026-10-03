export {
  Box,
  Newline,
  Spacer,
  Text,
  Transform,
  useAnimation,
  useApp,
  useInput,
  usePaste,
  useStdout,
  useWindowSize,
} from 'ink';
export type { BoxProps, Instance, Key, TextProps } from 'ink';

export { darkTheme, hoverColor, lightTheme, shade, themes } from './theme/themes.js';
export type { ColorScheme, Theme, Tone } from './theme/themes.js';

export { run } from './runtime/run.js';
export type { RunOptions } from './runtime/run.js';
export { detectBackground, detectColorScheme } from './runtime/detect-scheme.js';
export type { TerminalBackground } from './runtime/detect-scheme.js';
export { Inset, Root, useContentWidth, useMouse, useTerminal, useTheme, useView, ViewItem } from './runtime/context.js';
export { screenRect, useClick } from './runtime/click.js';
export type { ClickOptions, Rect } from './runtime/click.js';
export type { RootProps } from './runtime/context.js';
export type { FocusListener, MouseEvent, MouseListener } from './runtime/input.js';
export { notificationMethod } from './runtime/terminal.js';
export type { NotificationMethod, PointerShape, TerminalControl } from './runtime/terminal.js';
export { Shell, usePanel, usePanels } from './runtime/panels.js';
export type { PanelPlacement, Panels, PanelSpec, ShellProps } from './runtime/panels.js';

export { fuzzyFilter, fuzzyMatch } from './utils/fuzzy.js';
export { printable, TAB_WIDTH } from './utils/printable.js';
export type { FuzzyMatch } from './utils/fuzzy.js';

export { Prose } from './primitives/prose.js';
export { Fill } from './primitives/fill.js';
export type { FillProps } from './primitives/fill.js';
export { Rule } from './primitives/rule.js';
export type { RuleProps } from './primitives/rule.js';
export { FRAME_INSET, Frame, FrameDivider } from './primitives/frame.js';
export type { FrameDividerProps, FrameProps } from './primitives/frame.js';
export { Tree, TreeRow } from './primitives/tree.js';
export type { TreeNode, TreeProps } from './primitives/tree.js';
export { Spinner, StatusMark } from './primitives/spinner.js';
export type { Status } from './primitives/spinner.js';
export { ScrollView, useHoveredItem, useScrollArea } from './primitives/scroll-view.js';
export { Expandable, useHovered } from './primitives/expandable.js';
export type { ExpandableProps } from './primitives/expandable.js';
export type { ScrollViewProps } from './primitives/scroll-view.js';
export { KeyHints, Panel } from './primitives/panel.js';
export type { KeyHint, PanelProps } from './primitives/panel.js';
export { ListRow, SelectList, stepIndex, useListNavigation } from './primitives/select-list.js';
export { NoteLine, OptionRow, optionIndent } from './primitives/option-row.js';
export { ChoiceList, choiceIndent, useChoiceList } from './primitives/choice-list.js';
export type {
  Choice,
  ChoiceListOptions,
  ChoiceListProps,
  ChoiceListState,
  ChoiceMode,
} from './primitives/choice-list.js';
export { Meter } from './primitives/meter.js';
export type { MeterProps } from './primitives/meter.js';
export { StatGrid } from './primitives/stat-grid.js';
export type { Stat, StatGridProps } from './primitives/stat-grid.js';
export { addDays, dayKey, Heatmap, heatLevels, parseDay, useDayCursor } from './charts/heatmap.js';
export type { HeatmapProps } from './charts/heatmap.js';
export { BarList } from './charts/bar-list.js';
export { Waffle, waffleCells } from './charts/waffle.js';
export type { WaffleProps, WafflePart } from './charts/waffle.js';
export type { Bar, BarListProps } from './charts/bar-list.js';
export type { OptionRowProps } from './primitives/option-row.js';
export type { ListNavigationOptions, ListRowProps, SelectListProps } from './primitives/select-list.js';
export { Tabs, useTabs } from './primitives/tabs.js';
export type { TabsOptions } from './primitives/tabs.js';
export { Highlight } from './primitives/highlight.js';
export type { HighlightProps } from './primitives/highlight.js';

export { Markdown } from './content/markdown.js';
export type { MarkdownProps } from './content/markdown.js';
export { countChanges, Diff, parsePatch } from './content/diff.js';
export type { DiffLine, DiffLineKind, DiffProps } from './content/diff.js';
export { ExpandHint, OutputLines } from './content/output.js';
export type { OutputLinesProps } from './content/output.js';
export { ShellCommand, tokenizeShell } from './content/shell.js';

export { Notice, Thinking, UserMessage } from './chat/message.js';
export type { ThinkingProps, UserMessageProps } from './chat/message.js';
export type { NoticeTone } from './chat/message.js';
export { EditBlock, ShellBlock, ToolLine, toneOf } from './chat/tool.js';
export type { EditBlockProps, ShellBlockProps, ToolLineProps } from './chat/tool.js';
export { TodoBlock, TodoPanel } from './chat/todo.js';
export type { TodoGroup, TodoItem, TodoStatus } from './chat/todo.js';
export { AskPanel, AskResult } from './chat/ask.js';
export type { AskPanelProps, AskResultProps, Question, QuestionAnswer, QuestionOption } from './chat/ask.js';
export { ModelPanel } from './chat/model.js';
export type { ModelOption, ModelPanelProps, ModelSelection } from './chat/model.js';
export { PermissionPanel } from './chat/permission.js';
export { PlanPanel } from './chat/plan.js';
export type { PlanOption, PlanPanelDecision, PlanPanelProps } from './chat/plan.js';
export type { PermissionDecision, PermissionPanelProps, PermissionRequest } from './chat/permission.js';
export { PromptInput } from './chat/prompt-input.js';
export type { HiddenRows, PromptInputProps } from './chat/prompt-input.js';
export { PASTED_TEXT, PastedTexts } from './chat/pasted-texts.js';
export { PASTED_IMAGE, PastedImages } from './chat/pasted-images.js';
export type { ImageData } from './chat/pasted-images.js';
export { anyOf, MENTION, mention, namedMention } from './chat/mentions.js';
export { Composer } from './chat/composer.js';
export type { Completion, CompletionItem, CompletionSource, ComposerProps } from './chat/composer.js';
export { StatusBar, Tag } from './chat/status-bar.js';
export type { StatusBarProps } from './chat/status-bar.js';
export { Working } from './chat/working.js';
export type { WorkingProps } from './chat/working.js';
