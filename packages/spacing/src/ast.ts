export interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

export interface Comment {
  start: number;
  end: number;
}

export interface Group {
  kind: 'top' | 'statements' | 'class' | 'cases';
  items: AstNode[];
  open?: number;
  close?: number;
}

const BLOCKS = new Set(['BlockStatement', 'StaticBlock', 'TSModuleBlock']);

export function groups(program: AstNode, source: string): Group[] {
  const found: Group[] = [{ kind: 'top', items: program.body as AstNode[] }];

  const visit = (node: AstNode) => {
    if (BLOCKS.has(node.type)) {
      found.push({ kind: node.type === 'TSModuleBlock' ? 'top' : 'statements', items: node.body as AstNode[], open: node.start, close: node.end - 1 });
    }

    if (node.type === 'ClassBody') found.push({ kind: 'class', items: node.body as AstNode[], open: node.start, close: node.end - 1 });

    if (node.type === 'SwitchStatement') {
      const discriminant = node.discriminant as AstNode;

      found.push({ kind: 'cases', items: node.cases as AstNode[], open: source.indexOf('{', discriminant.end), close: node.end - 1 });
    }

    if (node.type === 'SwitchCase') found.push({ kind: 'statements', items: node.consequent as AstNode[] });

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.filter(isNode).forEach(visit);
      else if (isNode(value)) visit(value);
    }
  };

  visit(program);

  return found;
}

export const isNode = (value: unknown): value is AstNode =>
  typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string';
