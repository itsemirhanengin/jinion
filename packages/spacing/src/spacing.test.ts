import { describe, expect, it } from 'vitest';
import { checkSpacing } from './spacing.js';

const fix = (source: string) => checkSpacing(source, 'file.tsx').fixed;
const messages = (source: string) => checkSpacing(source, 'file.tsx').issues.map((issue) => `${issue.line}: ${issue.message}`);

describe('checkSpacing', () => {
  it('puts a blank line before return', () => {
    expect(fix('function f() {\n  const a = 1;\n  return a;\n}\n')).toBe('function f() {\n  const a = 1;\n\n  return a;\n}\n');
    expect(fix('function f() {\n  useKeys();\n  return 1;\n}\n')).toBe('function f() {\n  useKeys();\n\n  return 1;\n}\n');
  });

  it('leaves a return that is alone in its block', () => {
    expect(messages('function f() {\n  return 1;\n}\n\nconst g = () => {\n  if (x) return;\n};\n')).toEqual([]);
  });

  it('separates the declarations from what uses them', () => {
    expect(fix('function f() {\n  const a = 1;\n  const b = 2;\n  run(a, b);\n}\n')).toBe(
      'function f() {\n  const a = 1;\n  const b = 2;\n\n  run(a, b);\n}\n',
    );
  });

  it('keeps a one-line guard next to the value it checks', () => {
    expect(fix('function f() {\n  const a = get();\n  if (!a) return;\n  run(a);\n}\n')).toBe('function f() {\n  const a = get();\n  if (!a) return;\n\n  run(a);\n}\n');
  });

  it('separates an early exit from what follows it, and keeps exits together', () => {
    const source = 'function f(a) {\n  if (!a) return;\n  if (a.done) return;\n  const b = a.next;\n  run(b);\n}\n';

    expect(fix(source)).toBe('function f(a) {\n  if (!a) return;\n  if (a.done) return;\n\n  const b = a.next;\n\n  run(b);\n}\n');
  });

  it('treats a one-line if that does something else as a statement', () => {
    expect(fix('function f() {\n  const a = get();\n  if (a) run(a);\n}\n')).toBe('function f() {\n  const a = get();\n\n  if (a) run(a);\n}\n');
  });

  it('separates statements that span lines', () => {
    const source = 'function f() {\n  start();\n  if (x) {\n    run();\n  }\n  end();\n}\n';

    expect(fix(source)).toBe('function f() {\n  start();\n\n  if (x) {\n    run();\n  }\n\n  end();\n}\n');
  });

  it('separates a declaration that spans lines from the ones around it', () => {
    const source = 'function f() {\n  const a = 1;\n  const b = [\n    a,\n  ];\n  const c = 3;\n  run(b, c);\n}\n';

    expect(fix(source)).toBe('function f() {\n  const a = 1;\n\n  const b = [\n    a,\n  ];\n\n  const c = 3;\n\n  run(b, c);\n}\n');
  });

  it('puts the blank line before the comments that lead a statement', () => {
    const source = 'function f() {\n  const a = 1; // why\n  // because\n  return a;\n}\n';

    expect(fix(source)).toBe('function f() {\n  const a = 1; // why\n\n  // because\n  return a;\n}\n');
  });

  it('removes blank lines at the start and end of a block', () => {
    expect(fix('function f() {\n\n  run();\n\n}\n')).toBe('function f() {\n  run();\n}\n');
  });

  it('allows one blank line where any spacing will do, not two', () => {
    expect(fix('function f() {\n  a();\n\n\n  b();\n}\n')).toBe('function f() {\n  a();\n\n  b();\n}\n');
    expect(messages('function f() {\n  a();\n\n  b();\n  c();\n}\n')).toEqual([]);
  });

  it('separates the imports and the top-level declarations that span lines', () => {
    const source = "import a from 'a';\nimport b from 'b';\nconst x = 1;\nconst y = 2;\nfunction f() {\n  run();\n}\nexport { f };\n";

    expect(fix(source)).toBe(
      "import a from 'a';\nimport b from 'b';\n\nconst x = 1;\nconst y = 2;\n\nfunction f() {\n  run();\n}\n\nexport { f };\n",
    );
  });

  it('separates class members that span lines and leaves fields together', () => {
    const source = 'class A {\n  a = 1;\n  b = 2;\n  run() {\n    go();\n  }\n  stop() {\n    halt();\n  }\n}\n';

    expect(fix(source)).toBe('class A {\n  a = 1;\n  b = 2;\n\n  run() {\n    go();\n  }\n\n  stop() {\n    halt();\n  }\n}\n');
  });

  it('keeps cases with one-line bodies together', () => {
    const source = "function f() {\n  switch (x) {\n    case 'a':\n      return 1;\n    case 'b':\n      return 2;\n  }\n}\n";

    expect(messages(source)).toEqual([]);
  });

  it('separates cases that span lines and keeps fallthrough together', () => {
    const source = "function f() {\n  switch (x) {\n    case 'a':\n    case 'b':\n      run();\n      break;\n    case 'c':\n      stop();\n  }\n}\n";

    expect(fix(source)).toBe("function f() {\n  switch (x) {\n    case 'a':\n    case 'b':\n      run();\n      break;\n\n    case 'c':\n      stop();\n  }\n}\n");

    const mixed = "function f() {\n  switch (x) {\n    case 'a':\n      return 1;\n    case 'b':\n      run();\n      return 2;\n  }\n}\n";

    expect(fix(mixed)).toBe("function f() {\n  switch (x) {\n    case 'a':\n      return 1;\n\n    case 'b':\n      run();\n\n      return 2;\n  }\n}\n");
  });

  it('says where and why', () => {
    expect(messages('function f() {\n  const a = 1;\n  return a;\n}\n')).toEqual(['3: expected a blank line before return']);
  });

  it('leaves blank lines inside template literals alone', () => {
    const source = 'const text = `a\n\n\nb`;\n';

    expect(fix(source)).toBe(source);
  });

  it('reports a file it cannot parse and leaves it as it is', () => {
    const result = checkSpacing('const = ;', 'file.ts');

    expect(result.error).toBeDefined();
    expect(result.fixed).toBe('const = ;');
  });
});
