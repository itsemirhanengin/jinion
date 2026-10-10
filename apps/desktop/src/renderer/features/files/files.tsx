import type { FileChange } from '@jinion/core/api/protocol';
import { classNames, CodeView, VirtualList } from '@jinion/ui';
import { activeTab, type Feature, useLayout, useWorkbench, type Workbench } from '@jinion/workbench';
import { atom, useAtomValue } from 'jotai';
import { ChevronRight, FileText, Files } from 'lucide-react';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Core } from '../../core/core.js';
import { changesOf, useCore, useSession } from '../../state/session.js';
import { useGit } from '../git/use-git.js';
import { AskAnywhere, askedAtom, useSelectedLines } from './ask-anywhere.js';

interface Node {
  name: string;
  path: string;
  children?: Node[];
}

/** The project's tree, what the agent touched marked; a file opens read-only in a tab. Both read again after a turn. */
export function files(core: Core): Feature {
  return {
    id: 'files',
    activity: { title: 'Files', icon: <Files />, mode: 'code', Sidebar: Tree },
    tabs: [{ kind: 'file', Title: FileTitle, Mark: () => <FileText className="size-4 shrink-0 text-faint" />, Content: FileTab }],
    commands: [
      {
        id: 'file.ask',
        title: 'Ask about the selection or the file',
        keys: 'mod+l',
        when: (workbench) => activeTab(workbench.getLayout())?.kind === 'file',
        run: (workbench) => core.client.store.set(askedAtom, activeTab(workbench.getLayout())?.id),
      },
    ],
  };
}

interface Range {
  from: number;
  to?: number;
}

/** The lines to mark in a file's tab, such as the ones the agent read, by the tab's id. */
const marksAtom = atom<Record<string, Range | undefined>>({});

/** Opens a file of the thread's folder in a tab; `lines`, as `40-80` or `40-`, are marked and scrolled to. */
export function openFile(core: Core, workbench: Workbench, session: string, path: string, lines?: string) {
  const id = `${session}|${path}`;
  const [from, to] = (lines ?? '').split('-').map(Number);

  core.client.store.set(marksAtom, (all) => ({ ...all, [id]: from ? { from, to: to || undefined } : undefined }));
  workbench.open({ kind: 'file', id }, { preview: true });
}

/** The project's tree, only the rows in view drawn, however many files and folders are open. */
function Tree() {
  const core = useCore();
  const { repos } = useGit();
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const shown = useAtomValue(core.client.shownAtom);
  const snapshot = useSession(core, shown ?? '');
  const files = useAtomValue(core.filesAtom);

  const working = snapshot?.fields.working ?? false;

  // Read again once a turn ends, and while one runs only if there is no list yet, as after the window reloads.
  useEffect(() => {
    if (shown && (!working || files.length === 0)) void core.refreshFiles(shown);
  }, [shown, working]);

  // Folders come named too, ending in `/`; the tree makes its own from the files' paths.
  const tree = useMemo(() => treeOf(files.filter((path) => !path.endsWith('/'))), [files]);
  const touched = snapshot ? changesOf(snapshot).map((file) => file.path) : [];
  const root = `${core.project.path}/`;

  const letters = new Map(
    (repos ?? []).flatMap((repo) => repo.changes.flatMap((change) => (change.absolute.startsWith(root) ? [[change.absolute.slice(root.length), LETTERS[change.kind]] as const] : []))),
  );

  const open = opened.get(core) ?? new Set(tree.filter((node) => node.children && node.name === 'src').map((node) => node.path));

  opened.set(core, open);

  if (!shown) return <p className="px-2 text-pretty text-muted">Open a thread to see its files.</p>;

  const toggle = (path: string) => {
    if (!open.delete(path)) open.add(path);
    redraw();
  };

  return (
    <VirtualList items={rowsOf(tree, open)} keyOf={(row) => row.node.path} estimate={() => ROW} className="h-full">
      {(row) => (
        <TreeRow
          node={row.node}
          depth={row.depth}
          open={open.has(row.node.path)}
          session={shown}
          touched={touched}
          letters={letters}
          onToggle={() => toggle(row.node.path)}
        />
      )}
    </VirtualList>
  );
}

/** Each project's folders open in the tree, kept while the app runs. */
const opened = new WeakMap<Core, Set<string>>();

const ROW = 28;

/** The tree's rows as they show: each node, and the children of the folders open, depth first. */
function rowsOf(nodes: Node[], open: Set<string>, depth = 0): { node: Node; depth: number }[] {
  return nodes.flatMap((node) => [{ node, depth }, ...(node.children && open.has(node.path) ? rowsOf(node.children, open, depth + 1) : [])]);
}

/** Git's letter for each kind of change, in the color of what it does to the file. */
const LETTERS: Record<FileChange['kind'], { letter: string; tone: string }> = {
  modified: { letter: 'M', tone: 'text-accent' },
  added: { letter: 'A', tone: 'text-added' },
  untracked: { letter: 'U', tone: 'text-added' },
  deleted: { letter: 'D', tone: 'text-removed' },
  renamed: { letter: 'R', tone: 'text-accent' },
};

interface TreeRowProps {
  node: Node;
  depth: number;
  open: boolean;
  session: string;
  touched: string[];
  letters: Map<string, { letter: string; tone: string }>;
  onToggle: () => void;
}

function TreeRow({ node, depth, open, session, touched, letters, onToggle }: TreeRowProps) {
  const workbench = useWorkbench();
  const active = useLayout((layout) => layout.groups[layout.focused]?.active === `file:${session}|${node.path}`);

  const indent = { paddingLeft: 8 + depth * 14 };
  const changed = node.children ? !open && touched.some((path) => path.startsWith(`${node.path}/`)) : touched.includes(node.path);
  const git = !node.children && letters.get(node.path);

  const click = () => {
    if (node.children) onToggle();
    else workbench.open({ kind: 'file', id: `${session}|${node.path}` }, { preview: true });
  };

  return (
    <button
      type="button"
      onClick={click}
      onDoubleClick={() => !node.children && workbench.open({ kind: 'file', id: `${session}|${node.path}` })}
      style={indent}
      className={classNames(
        'flex h-7 w-full cursor-default items-center gap-1.5 rounded-lg pr-2 text-left',
        active ? 'bg-background shadow-xs ring-1 ring-edge' : 'hover:bg-shade',
      )}
    >
      {node.children ? <ChevronRight className={classNames('size-4 shrink-0 text-faint', open && 'rotate-90')} /> : <span className="w-4 shrink-0" />}
      <span className={classNames('min-w-0 flex-1 truncate', !node.children && !git && 'text-ink/80')}>{node.name}</span>
      {changed && <span className="size-1.5 shrink-0 rounded-full bg-primary" title="Changed by the agent" />}
      {git && <span className={classNames('w-3 shrink-0 text-center text-[11px] font-semibold', git.tone)}>{git.letter}</span>}
    </button>
  );
}

/** Code's empty editor: where files come from. */
export function NoFile() {
  return (
    <p className="flex h-full items-center justify-center px-8 text-center text-pretty text-muted">Open a file from the sidebar, or find one with ⌘K.</p>
  );
}

function FileTitle({ id }: { id: string }) {
  const path = id.slice(id.indexOf('|') + 1);

  return path.slice(path.lastIndexOf('/') + 1);
}

function FileTab({ id }: { id: string }) {
  const core = useCore();
  const session = id.slice(0, id.indexOf('|'));
  const path = id.slice(id.indexOf('|') + 1);
  const snapshot = useSession(core, session);
  const mark = useAtomValue(marksAtom)[id];
  const [content, setContent] = useState<{ text?: string; problem?: string }>();
  const scroller = useRef<HTMLDivElement>(null);
  const lines = useSelectedLines(scroller);

  const working = snapshot?.fields.working ?? false;
  const total = content?.text?.split('\n').length ?? 0;
  const marked = mark ? Array.from({ length: Math.max(0, Math.min(mark.to ?? total, total) - mark.from + 1) }, (_, index) => mark.from + index) : [];

  // Read again once a turn ends, and while one runs only if the tab has nothing yet, as after switching to Code.
  useEffect(() => {
    if (working && content) return;

    core.read(session, path).then(
      (text) => setContent({ text }),
      (error: Error) => setContent({ problem: error.message }),
    );
  }, [session, path, working]);

  // Moves only this tab's own scroll, a few lines above the mark, so the lines before it give it context.
  useEffect(() => {
    const line = mark && scroller.current?.querySelector<HTMLElement>(`[data-line="${mark.from}"]`);

    if (line && scroller.current) scroller.current.scrollTop = Math.max(0, line.offsetTop - 80);
  }, [mark, content?.text]);

  return (
    <div className="relative flex h-full flex-col">
      <p className="shrink-0 truncate px-6 pt-1 pb-2 text-muted" title={path}>
        {path}
        {mark && (
          <span className="text-faint">
            {' '}
            lines {mark.from}–{mark.to ?? total}
          </span>
        )}
      </p>
      {/* Room at the end for the bar or the composer under the last lines, and for the hint over them. */}
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto pb-24">
        {content?.text !== undefined && <CodeView key={path} code={content.text} path={path} marked={marked} />}
        {content?.problem && <p className="px-6 text-muted">{content.problem}</p>}
      </div>
      {content?.text !== undefined && <AskAnywhere id={id} session={session} path={path} code={content.text} lines={lines} scroller={scroller} />}
    </div>
  );
}

/** Folders first, then files, each by name. */
function treeOf(paths: string[]): Node[] {
  const root: Node = { name: '', path: '', children: [] };

  for (const path of paths) {
    let parent = root;
    const parts = path.split('/');

    parts.forEach((name, index) => {
      const at = parts.slice(0, index + 1).join('/');
      const leaf = index === parts.length - 1;
      let node = parent.children!.find((child) => child.name === name);

      if (!node) {
        node = leaf ? { name, path: at } : { name, path: at, children: [] };
        parent.children!.push(node);
      }

      parent = node;
    });
  }

  const sort = (nodes: Node[]): Node[] =>
    nodes
      .map((node) => (node.children ? { ...node, children: sort(node.children) } : node))
      .sort((a, b) => Number(!a.children) - Number(!b.children) || a.name.localeCompare(b.name));

  return sort(root.children!);
}
