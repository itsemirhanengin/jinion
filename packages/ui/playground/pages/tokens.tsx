import { Frame } from '@jinion/ui';
import type { ReactNode } from 'react';

const neutrals = ['background', 'raised', 'floating', 'line', 'frame', 'muted', 'ink'];
const surfaces = ['surface-neutral', 'surface-user', 'surface-pending', 'surface-success', 'surface-error'];
const meanings = ['accent', 'code', 'success', 'warning', 'error', 'heading', 'variable', 'string'];

const files = [
  { path: 'apps/desktop/package.json', added: 14, removed: 6, created: true },
  { path: 'apps/desktop/src/main/shell-path.ts', added: 22, removed: 0, created: true },
  { path: 'apps/desktop/src/main/main.ts', added: 4, removed: 0 },
  { path: 'pnpm-workspace.yaml', added: 1, removed: 1 },
];

export function Tokens() {
  return (
    <div className="grid grid-cols-2">
      <Scheme scheme="light" />
      <Scheme scheme="dark" />
    </div>
  );
}

function Scheme({ scheme }: { scheme: 'light' | 'dark' }) {
  return (
    <div className={`${scheme} flex min-w-0 flex-col gap-10 bg-background p-8 text-ink`}>
      <Section title="Type">
        <p className="text-title font-semibold">Projects</p>
        <p>The app's text, and the agent's prose: SF Pro at 13 on 20.</p>
        <p className="text-small text-muted">Small, for what sits beside: 4m ago · 3 threads</p>
        <p className="font-mono text-mono">
          <span className="text-code">apps/desktop/src/main.ts</span> <span className="text-added">+14</span>{' '}
          <span className="text-removed">-6</span> <span className="text-muted">JetBrains Mono at 12 on 20</span>
        </p>
      </Section>

      <Section title="Colors">
        <Swatches names={neutrals} />
        <Swatches names={surfaces} />
        <Swatches names={meanings} text />
      </Section>

      <Section title="Controls">
        <div className="flex items-center gap-2">
          <button type="button" className="h-7 rounded-full bg-ink px-3.5 font-medium text-background">
            Open folder
          </button>
          <button type="button" className="hover-shade h-7 rounded-full border border-line px-3.5">
            Cancel
          </button>
          <button type="button" className="hover-shade h-7 rounded-full px-3 text-muted">
            Opus 5.5
          </button>
        </div>
        <div className="w-64 rounded-surface border border-line bg-floating p-1 shadow-floating">
          {['New thread', 'Open folder…', 'Settings'].map((item) => (
            <div key={item} className="hover-shade flex h-7 items-center rounded-inner px-2">
              {item}
            </div>
          ))}
        </div>
        <div className="w-64 rounded-surface bg-raised p-1">
          {['Rate limiting for the API', 'Upgrade to Express 5', 'Explain the job queue'].map((item, index) => (
            <div key={item} className="hover-shade flex h-7 items-center justify-between rounded-inner px-2">
              <span className="truncate">{item}</span>
              <span className="text-small text-muted">{['25s', '4m', '1h'][index]}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The agent's answer">
        <div className="rounded-surface bg-surface-user px-4 py-2">Release the desktop app and check the assets.</div>

        <Frame tone="success">
          <p className="break-all">
            <span className="text-muted">$</span> <span className="text-warning">gh</span> release view{' '}
            <span className="text-string">@jinion/desktop@0.0.1</span> <span className="text-code">--json</span> assets{' '}
            <span className="text-accent">&&</span> <span className="text-warning">git</span> status <span className="text-code">-sb</span>
          </p>
          <p className="text-muted">… +2 lines</p>
          <p className="text-muted">[Wall: 1.04s | Timeout: 120s]</p>
        </Frame>

        <div className="flex flex-col gap-2">
          <p>
            <strong>Jinion Desktop 0.0.1</strong> is out. The release has the <code className="font-mono text-mono text-code">.dmg</code> for
            Apple silicon, and <a href="#tokens" className="text-accent underline underline-offset-2">its notes</a> say how to open it the first time.
          </p>
          <p>The packaged app started from the Finder, found the shell's PATH, and left no core running when it quit.</p>
        </div>

        <Frame
          title={
            <span>
              <strong>4 files changed</strong> <span className="text-added">+41</span> <span className="text-removed">-7</span>
            </span>
          }
        >
          <div className="grid w-fit grid-cols-[auto_3ch_auto] gap-x-[2ch]">
            {files.map((file) => (
              <Row key={file.path}>
                <span className="text-code">{file.path}</span>
                <span className="text-muted">{file.created ? 'new' : ''}</span>
                <span>
                  <span className="text-added">+{file.added}</span>
                  {file.removed > 0 && <span className="text-removed"> -{file.removed}</span>}
                </span>
              </Row>
            ))}
          </div>
          <p className="text-muted">… +2 more files</p>
        </Frame>

        <Frame tone="pending" title="Todo 3 tasks">
          <p>
            <span className="text-success">[x]</span> The tokens
          </p>
          <p>
            <span className="text-accent">[~]</span> The workbench
          </p>
          <p className="text-muted">[ ] The chat kit</p>
        </Frame>

        <Frame tone="error" title={<span className="text-error">pnpm typecheck</span>}>
          <p>
            <span className="text-code">src/app/app.tsx:48:7</span> <span className="text-error">error</span> TS2322: Type 'string' is not
            assignable to type 'View'.
          </p>
        </Frame>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-small text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Swatches({ names, text }: { names: string[]; text?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {names.map((name) => (
        <span key={name} className="flex items-center gap-2 font-mono text-small">
          <span className="size-4 border border-line" style={{ background: `var(--${name})` }} />
          <span style={text ? { color: `var(--${name})` } : undefined}>{name}</span>
        </span>
      ))}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="col-span-3 grid grid-cols-subgrid">{children}</div>;
}
