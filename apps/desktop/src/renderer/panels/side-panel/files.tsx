import { classNames, CodeView } from '@jinion/ui';
import { useAtomValue } from 'jotai';
import { ChevronRight, FileText, Folder } from 'lucide-react';
import { useState } from 'react';
import { useJinion } from '../../state/session.js';

export interface FilesProps {
  /** The files the agent changed, marked in the tree. */
  touched: string[];
  selected?: string;
  onSelect: (path: string) => void;
}

interface Node {
  name: string;
  path: string;
  children?: Node[];
}

/** The project's tree, and the picked file read-only. */
export function Files({ touched, selected, onSelect }: FilesProps) {
  const jinion = useJinion();
  const files = useAtomValue(jinion.filesAtom);

  const tree = treeOf(Object.keys(files));
  const content = selected ? files[selected] : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className={classNames('overflow-y-auto py-1', content !== undefined ? 'max-h-[40%] shrink-0 border-b border-line' : 'flex-1')}>
        {tree.map((node) => (
          <TreeNode key={node.path} node={node} depth={0} touched={touched} selected={selected} onSelect={onSelect} />
        ))}
      </div>
      {content !== undefined && selected && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-8 shrink-0 items-center px-3 font-mono text-code text-muted">{selected}</div>
          <div className="min-h-0 flex-1 overflow-auto">
            <CodeView key={selected} code={content} path={selected} />
          </div>
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, depth, touched, selected, onSelect }: { node: Node; depth: number } & FilesProps) {
  const [open, setOpen] = useState(depth === 0 && node.name === 'src');

  const indent = { paddingLeft: 12 + depth * 14 };

  if (!node.children) {
    return (
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        style={indent}
        className={classNames('flex h-7 w-full cursor-default items-center gap-1.5 pr-3 text-left', node.path === selected ? 'bg-hover' : 'hover:bg-hover/50')}
      >
        <span className="w-3.5 shrink-0" />
        <FileText className="size-3.5 shrink-0 text-faint" />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {touched.includes(node.path) && <span className="size-1.5 shrink-0 rounded-full bg-waiting" title="Changed by the agent" />}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={indent}
        className="flex h-7 w-full cursor-default items-center gap-1.5 pr-3 text-left hover:bg-hover/50"
      >
        <ChevronRight className={classNames('size-3.5 shrink-0 text-faint transition-transform', open && 'rotate-90')} />
        <Folder className="size-3.5 shrink-0 text-faint" />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {!open && touched.some((path) => path.startsWith(`${node.path}/`)) && <span className="size-1.5 shrink-0 rounded-full bg-waiting" />}
      </button>
      {open &&
        node.children.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} touched={touched} selected={selected} onSelect={onSelect} />
        ))}
    </>
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
