import type { AstNode, Group } from './ast.js';

export type Spacing = 'blank' | 'none' | 'any';

export interface Decision {
  spacing: Spacing;
  reason: string;
}

const ANY: Decision = { spacing: 'any', reason: '' };

const JUMPS = new Set(['ReturnStatement', 'ThrowStatement']);
const EXITS = new Set(['ReturnStatement', 'ThrowStatement', 'ContinueStatement', 'BreakStatement']);
const IMPORTS = new Set(['ImportDeclaration', 'TSImportEqualsDeclaration']);
const STANDALONE = new Set(['FunctionDeclaration', 'ClassDeclaration', 'TSDeclareFunction']);

export class Rules {
  constructor(private readonly lineOf: (offset: number) => number) {}

  decide(group: Group, prev: AstNode, next: AstNode): Decision {
    switch (group.kind) {
      case 'top':
        return this.top(prev, next);
      case 'statements':
        return this.statements(prev, next);
      case 'class':
        return this.multiline(prev) || this.multiline(next) ? blank('between class members that span lines') : ANY;
      case 'cases':
        return this.cases(group, prev);
    }
  }

  private top(prev: AstNode, next: AstNode): Decision {
    if (IMPORTS.has(prev.type)) return IMPORTS.has(next.type) ? ANY : blank('after the imports');

    const standalone = STANDALONE.has(unwrap(prev).type) || STANDALONE.has(unwrap(next).type);

    return this.multiline(prev) || this.multiline(next) || standalone ? blank('between top-level declarations that span lines') : ANY;
  }

  private statements(prev: AstNode, next: AstNode): Decision {
    if (JUMPS.has(next.type)) return blank(`before ${next.type === 'ReturnStatement' ? 'return' : 'throw'}`);

    if (isDeclaration(prev) && isDeclaration(next)) {
      return this.multiline(prev) || this.multiline(next) ? blank('around a declaration that spans lines') : ANY;
    }

    // A one-line guard reads with the value it checks.
    if (isDeclaration(prev)) return this.isGuard(next) ? ANY : blank('after the declarations');

    if (this.isGuard(prev)) return this.isGuard(next) ? ANY : blank('after an early exit');

    return this.multiline(prev) || this.multiline(next) ? blank('around a statement that spans lines') : ANY;
  }

  /** Every case of a switch is spaced alike: apart once one of them spans lines, together otherwise. */
  private cases(group: Group, prev: AstNode): Decision {
    if ((prev.consequent as AstNode[]).length === 0) return { spacing: 'none', reason: 'between cases that fall through' };

    return group.items.some((item) => this.bodySpans(item)) ? blank('between cases when one spans lines') : { spacing: 'none', reason: 'between one-line cases' };
  }

  private bodySpans(node: AstNode) {
    const body = node.consequent as AstNode[];

    return body.length > 0 && this.lineOf(body[0]!.start) !== this.lineOf(body.at(-1)!.end - 1);
  }

  private multiline(node: AstNode) {
    return this.lineOf(node.start) !== this.lineOf(node.end - 1);
  }

  /** `if (!value) return;` on one line. */
  private isGuard(node: AstNode) {
    if (node.type !== 'IfStatement' || node.alternate || this.multiline(node)) return false;

    const then = node.consequent as AstNode;
    const exit = then.type === 'BlockStatement' ? (then.body as AstNode[])[0] : then;

    return exit !== undefined && EXITS.has(exit.type);
  }
}

function unwrap(node: AstNode) {
  const exported = node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration';

  return exported && node.declaration ? (node.declaration as AstNode) : node;
}

const isDeclaration = (node: AstNode) => unwrap(node).type === 'VariableDeclaration';

const blank = (reason: string): Decision => ({ spacing: 'blank', reason });
