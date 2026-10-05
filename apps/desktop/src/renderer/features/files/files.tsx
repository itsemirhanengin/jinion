import { classNames, CodeView } from '@jinion/ui';
import { type Feature, useLayout, useWorkbench } from '@jinion/workbench';
import { useAtomValue } from 'jotai';
import { ChevronRight, FileText, Folder } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { changesOf, useCore, useSession } from '../../state/session.js';

interface Node {
  name: string;
  path: string;
  children?: Node[];
}

/** The project's tree, what the agent touched marked; a file opens read-only in a tab. Both read again after a turn. */
export function files(): Feature {
  return {
    id: 'files',
    activity: { title: 'Files', icon: <Folder />, Sidebar: Tree },
    tabs: [{ kind: 'file', Title: FileTitle, Mark: () => <FileText className="size-4 shrink-0 text-faint" />, Content: FileTab }],
  };
}

function Tree() {
  const core = useCore();
  const shown = useAtomValue(core.client.shownAtom);
  const snapshot = useSession(core, shown ?? '');
  const files = useAtomValue(core.filesAtom);

  const working = snapshot?.fields.working ?? false;

  useEffect(() => {
    if (shown && !working) void core.refreshFiles(shown);
  }, [shown, working]);

  // Folders come named too, ending in `/`; the tree makes its own from the files' paths.
  const tree = useMemo(() => treeOf(files.filter((path) => !path.endsWith('/'))), [files]);
  const touched = snapshot ? changesOf(snapshot).map((file) => file.path) : [];

  if (!shown) return <p className="px-2 text-pretty text-muted">Open a thread to see its files.</p>;

  return (
    <div className="flex flex-col">
      {tree.map((node) => (
        <TreeNode key={node.path} node={node} depth={0} session={shown} touched={touched} />
      ))}
    </div>
  );
}

function TreeNode({ node, depth, session, touched }: { node: Node; depth: number; session: string; touched: string[] }) {
  const workbench = useWorkbench();
  const [open, setOpen] = useState(depth === 0 && node.name === 'src');
  const active = useLayout((layout) => layout.groups[layout.focused]?.active === `file:${session}|${node.path}`);

  const indent = { paddingLeft: 8 + depth * 14 };
  const changed = node.children ? !open && touched.some((path) => path.startsWith(`${node.path}/`)) : touched.includes(node.path);

  const click = () => {
    if (node.children) setOpen(!open);
    else workbench.open({ kind: 'file', id: `${session}|${node.path}` }, { preview: true });
  };

  return (
    <>
      <button
        type="button"
        onClick={click}
        onDoubleClick={() => !node.children && workbench.open({ kind: 'file', id: `${session}|${node.path}` })}
        style={indent}
        className={classNames('flex h-7 w-full cursor-default items-center gap-1.5 rounded-lg pr-2 text-left', active ? 'bg-selected' : 'hover:bg-shade')}
      >
        {node.children ? (
          <ChevronRight className={classNames('size-4 shrink-0 text-faint', open && 'rotate-90')} />
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className={classNames('min-w-0 flex-1 truncate', !node.children && 'text-ink/80')}>{node.name}</span>
        {changed && <span className="size-1.5 shrink-0 rounded-full bg-primary" title="Changed by the agent" />}
      </button>
      {open && node.children?.map((child) => <TreeNode key={child.path} node={child} depth={depth + 1} session={session} touched={touched} />)}
    </>
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
  const [content, setContent] = useState<{ text?: string; problem?: string }>();

  const working = snapshot?.fields.working ?? false;

  useEffect(() => {
    if (working) return;

    core.read(session, path).then(
      (text) => setContent({ text }),
      (error: Error) => setContent({ problem: error.message }),
    );
  }, [session, path, working]);

  return (
    <div className="flex h-full flex-col">
      <p className="shrink-0 truncate px-6 pt-1 pb-2 text-muted" title={path}>
        {path}
      </p>
      <div className="min-h-0 flex-1 overflow-auto">
        {content?.text !== undefined && <CodeView key={path} code={content.text} path={path} />}
        {content?.problem && <p className="px-6 text-muted">{content.problem}</p>}
      </div>
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
