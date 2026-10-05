import { Pill } from '@jinion/ui';
import { Composer, DiffCard, Prose, Thinking, Todos, ToolGroup, ToolLine, UserMessage } from '@jinion/ui/chat';
import { useState } from 'react';
import { explored, firstThought, prompt, rateLimitFile, serverFile, summary, todos } from '../fixtures.js';
import { Specimen, Specimens } from '../specimen.js';

export function ChatPieces() {
  const [draft, setDraft] = useState('');

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
        <Todos items={todos} />
        <Todos
          items={todos.map((todo, index) => ({ ...todo, status: index < 2 ? 'completed' : index === 2 ? 'in_progress' : 'pending' }))}
        />
      </Specimen>
      <Specimen title="Composer">
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={() => setDraft('')}
          placeholder="Ask, plan or build. @ for files, / for commands"
          onAttach={() => {}}
          controls={<Pill>Opus 4.6</Pill>}
        />
        <Composer value="" onChange={() => {}} onSubmit={() => {}} placeholder="While a turn runs" busy onStop={() => {}} />
      </Specimen>
    </Specimens>
  );
}
