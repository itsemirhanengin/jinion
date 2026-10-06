import { ImageViewer, Pill } from '@jinion/ui';
import {
  ChangesCard,
  CommandCard,
  type CompletionSource,
  Composer,
  DiffCard,
  Notice,
  PermissionPanel,
  Prose,
  Queued,
  Thinking,
  Todos,
  ToolGroup,
  ToolLine,
  UserMessage,
  Working,
} from '@jinion/ui/chat';
import { useState } from 'react';
import { explored, firstThought, prompt, rateLimitFile, runningTodos, serverFile, summary, todos } from '../fixtures.js';
import { Specimen, Specimens } from '../specimen.js';

const COMMANDS = [
  { name: 'compact', description: 'Summarize the conversation to free up context' },
  { name: 'model', description: 'Pick the model' },
  { name: 'review', description: 'Review the current changes', group: 'Project' },
];

const FILES = ['src/server.ts', 'src/middleware/rate-limit.ts', 'README.md'];

const SAMPLE_COMPLETIONS: CompletionSource[] = [
  (value) => {
    if (!value.startsWith('/') || /\s/.test(value)) return undefined;

    const items = COMMANDS.filter((command) => command.name.startsWith(value.slice(1))).map((command) => ({
      key: command.name,
      label: `/${command.name}`,
      description: command.description,
      group: command.group ?? 'Jinion',
      insert: `/${command.name} `,
    }));

    return { from: 0, to: value.length, items, submit: true };
  },
  (value, cursor) => {
    const typed = /(?:^|\s)@(\S*)$/.exec(value.slice(0, cursor));
    if (!typed) return undefined;

    const items = FILES.filter((path) => path.includes(typed[1]!)).map((path) => ({ key: path, label: path, insert: `@${path} ` }));

    return { from: cursor - typed[1]!.length - 1, to: cursor, items };
  },
];

export function ChatPieces() {
  const [draft, setDraft] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [viewing, setViewing] = useState<string>();

  return (
    <Specimens>
      <Specimen title="User message" note="hover for rewind">
        <UserMessage text={prompt} onRewind={() => {}} />
        <UserMessage text="Run the tests again" />
      </Specimen>
      <Specimen title="Thinking" note="click to open">
        <Thinking text={firstThought} took="6s" />
        <Thinking text={firstThought} />
      </Specimen>
      <Specimen title="Prose">
        <Prose text={summary} />
        <Prose
          text={'A code block:\n\n```ts\nexport const limit = 100;\n```\n\n> Raw HTML stays text: <img src=x onerror="alert(1)">'}
        />
      </Specimen>
      <Specimen title="Tool group" note="click to open">
        <ToolGroup title="Explored" summary="3 files, 1 search" defaultOpen>
          {explored.map((line, index) => (
            <ToolLine key={index} {...line} />
          ))}
        </ToolGroup>
        <ToolGroup title="Checked" summary="1 command">
          <ToolLine label="Ran" detail="pnpm test, 25 passed" />
        </ToolGroup>
      </Specimen>
      <Specimen title="Diff card" note="folds past 12 lines">
        <DiffCard path="src/server.ts" lines={serverFile} onRevert={() => {}} onOpen={() => {}} />
        <DiffCard path="src/middleware/rate-limit.ts" lines={rateLimitFile} />
      </Specimen>
      <Specimen title="Todos" note="click to open">
        <Todos groups={todos} />
        <Todos groups={runningTodos} />
      </Specimen>
      <Specimen title="Command card" note="click to open">
        <CommandCard command="pnpm test" output={[' ✓ src/middleware/rate-limit.test.ts (3)', '', ' Tests  25 passed']} exitCode={0} took="1.6s" />
        <CommandCard command="pnpm vitest run src/middleware" output={['FAIL resets after the window']} exitCode={1} took="1.2s" />
        <CommandCard command="pnpm dev" output={[]} background />
      </Specimen>
      <Specimen title="Changes card">
        <ChangesCard
          files={[
            { path: 'src/middleware/rate-limit.ts', created: true, added: 26, removed: 0 },
            { path: 'src/server.ts', created: false, added: 2, removed: 1 },
          ]}
        />
      </Specimen>
      <Specimen title="Permission">
        <PermissionPanel
          request={{ title: 'Run a command?', command: 'pnpm add express-rate-limit', always: '`pnpm add:*` in this project' }}
          onAnswer={() => {}}
        />
      </Specimen>
      <Specimen title="Working, queued and notices">
        <Working since={Date.now() - 12_000} />
        <Queued messages={['Also add a test for the login route']} onRemove={() => {}} />
        <Notice text="Interrupted. Tell jinion what to do instead." tone="warning" />
      </Specimen>
      <Specimen title="Composer">
        <ImageViewer image={viewing ? { src: viewing, name: 'Pasted image' } : undefined} onClose={() => setViewing(undefined)} />
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={() => {
            setDraft('');
            setImages([]);
          }}
          placeholder="Ask, plan or build. @ for files, / for commands"
          completions={SAMPLE_COMPLETIONS}
          onImages={async (files) => {
            const added = files.map((file) => URL.createObjectURL(file));

            setImages((all) => [...all, ...added]);

            return added.map((_, index) => `[Image #${images.length + index + 1}]`).join(' ');
          }}
          chips={[
            { pattern: /\[Image #\d+\]/, tone: 'gray', whole: true, onClick: (chip) => setViewing(images[Number(/\d+/.exec(chip)![0]) - 1]) },
            { pattern: /(?<=^|\s)@\S+/, tone: 'blue' },
            { pattern: /(?<=^|\s)\$\S+/, tone: 'violet' },
          ]}
          controls={<Pill>Opus 4.6</Pill>}
        />
        <Composer value="" onChange={() => {}} onSubmit={() => {}} placeholder="While a turn runs" busy onStop={() => {}} />
      </Specimen>
    </Specimens>
  );
}
