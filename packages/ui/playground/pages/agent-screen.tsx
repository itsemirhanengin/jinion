import { Avatar, Button, Pill, Sidebar, SidebarHeader, SidebarItem, SidebarSection, StatusIcon, Tab, Tabs, Window } from '@jinion/ui';
import { Composer, ComposerFooter, Conversation, DiffCard, Prose, Thinking, Todos, ToolGroup, ToolLine, UserMessage } from '@jinion/ui/chat';
import { Brain, ChevronLeft, GitBranch, Laptop, PanelLeft, Shapes, ShieldCheck, SquarePen } from 'lucide-react';
import { useState } from 'react';
import { explored, firstThought, project, prompt, rateLimitFile, serverFile, summary, tabs, threads, todos } from '../fixtures.js';

export function AgentScreen() {
  const [draft, setDraft] = useState('');
  const [active, setActive] = useState(0);

  return (
    <div className="relative h-full min-h-[720px] overflow-hidden rounded-xl border border-line shadow-xl">
      <TrafficLights />
      <Window
        sidebar={
          <Sidebar>
            <SidebarHeader>
              <Button size="icon" aria-label="Hide the sidebar" className="[&_svg]:size-4">
                <PanelLeft />
              </Button>
              <span className="flex-1" />
              <Button size="small" className="[&_svg]:size-3.5">
                <ChevronLeft />
                Projects
              </Button>
            </SidebarHeader>
            <SidebarSection>
              <SidebarItem icon={<SquarePen />} label="New thread" active />
              <SidebarItem icon={<Shapes />} label="Skills" />
              <SidebarItem icon={<Brain />} label="Memory" />
            </SidebarSection>
            <SidebarSection title="Threads">
              {threads.map((thread) => (
                <SidebarItem key={thread.title} icon={<StatusIcon status={thread.status} />} label={thread.title} trailing={thread.age} />
              ))}
            </SidebarSection>
          </Sidebar>
        }
        top={
          <>
            <Pill tone="accent" chevron="up-down">
              {project}
            </Pill>
            <Tabs>
              {tabs.map((tab, index) => (
                <Tab key={index} {...tab} active={index === active} onClick={() => setActive(index)} />
              ))}
            </Tabs>
            <Avatar name="Emirhan" />
          </>
        }
      >
        <Conversation
          footer={
            <>
              <Composer
                value={draft}
                onChange={setDraft}
                onSubmit={() => setDraft('')}
                placeholder="Ask, plan or build. @ for files, / for commands"
                busy={false}
                onAttach={() => {}}
                onDictate={() => {}}
                controls={
                  <>
                    <Pill tone="soft" icon={<ShieldCheck />}>
                      Accept edits
                    </Pill>
                    <Pill>Opus 4.6</Pill>
                  </>
                }
              />
              <ComposerFooter
                start={<Pill icon={<Laptop />}>Local</Pill>}
                end={<Pill icon={<GitBranch />}>main</Pill>}
              />
            </>
          }
        >
          <UserMessage text={prompt} onRewind={() => {}} />
          <Thinking text={firstThought} took="6s" />
          <Prose text="I'll look at how the API is put together first." />
          <ToolGroup title="Explored" summary="3 files, 1 search">
            {explored.map((line, index) => (
              <ToolLine key={index} {...line} />
            ))}
          </ToolGroup>
          <Prose text="Nothing limits requests yet. I'll add a middleware that counts them per key in a one-minute window." />
          <DiffCard path="src/middleware/rate-limit.ts" lines={rateLimitFile} onRevert={() => {}} onOpen={() => {}} />
          <DiffCard path="src/server.ts" lines={serverFile} onRevert={() => {}} onOpen={() => {}} />
          <ToolGroup title="Checked" summary="1 command">
            <ToolLine label="Ran" detail="pnpm test, 25 passed" />
          </ToolGroup>
          <Todos groups={todos} />
          <Prose text={summary} />
        </Conversation>
      </Window>
    </div>
  );
}

/** Where macOS draws the window's buttons in the app; drawn here so the screen reads as it will there. */
function TrafficLights() {
  return (
    <div className="absolute top-[19px] left-[18px] z-10 flex gap-2">
      <span className="size-3 rounded-full bg-[#ff5f57]" />
      <span className="size-3 rounded-full bg-[#febc2e]" />
      <span className="size-3 rounded-full bg-[#28c840]" />
    </div>
  );
}
