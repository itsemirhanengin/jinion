import { plain } from './terminal';

interface Node {
  type: string;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  children?: Node[];
  [key: string]: unknown;
}

/**
 * Turns a ```terminal code block into `<Terminal>`. A code block keeps every space of the screen, where MDX would
 * re-indent a template literal. The Markdown versions of the page show the screen as text, without its marks.
 *
 *     ```terminal title="~/code/api"
 *     {accent,bold|jinion} {muted|v0.1.0}
 *     ```
 */
export function remarkTerminal() {
  return (tree: Node) => {
    walk(tree);
  };
}

const shells = new Set(['sh', 'bash', 'shell', 'zsh']);

function walk(parent: Node) {
  parent.children?.forEach((node, index) => {
    if (node.type === 'code' && node.lang === 'terminal') {
      parent.children![index] = toElement(node);
    } else if (node.type === 'code' && shells.has(node.lang ?? '') && !/title=/.test(node.meta ?? '')) {
      // Commands to type in a shell are titled as such, apart from prompts to the agent.
      node.meta = `title="Terminal"${node.meta ? ` ${node.meta}` : ''}`;
    } else {
      walk(node);
    }
  });
}

function toElement(code: Node): Node {
  const screen = code.value ?? '';
  const title = /title="([^"]*)"/.exec(code.meta ?? '')?.[1];
  const attributes = [{ type: 'mdxJsxAttribute', name: 'screen', value: screen }];

  if (title) attributes.unshift({ type: 'mdxJsxAttribute', name: 'title', value: title });

  return {
    type: 'mdxJsxFlowElement',
    name: 'Terminal',
    attributes,
    children: [],
    data: {
      // How Fumadocs writes the node in the page's Markdown (`/memory.md`, llms.txt). A `{ node }` here would be
      // ignored: Fumadocs writes only the children of a component it doesn't know, and this one has none.
      _stringify: { text: codeBlock(plain(screen), code.meta) },
    },
  };
}

function codeBlock(text: string, meta?: string | null): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));

  return `${fence}text${meta ? ` ${meta}` : ''}\n${text}\n${fence}`;
}
