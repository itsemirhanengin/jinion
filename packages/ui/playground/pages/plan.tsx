import { Button, FadeText, MarkdownEditor, Waiting } from '@jinion/ui';
import { ChevronDown, ClipboardList } from 'lucide-react';
import { useState } from 'react';

const PLAN = `# Rate limiting for the API

Requests are limited per API key, **60 a minute**, counted in Redis so every instance of the server shares the count. A request over the limit gets a \`429\` with a \`Retry-After\` header.

## How a request goes

\`\`\`mermaid
flowchart LR
  request[Request] --> limits["limits(apiKey)"]
  limits -->|under 60| handler[handler]
  limits -->|over| refused[429 Retry-After]
\`\`\`

## Steps

1. Add \`apps/api/src/limits.ts\`: a middleware that counts each key's requests in a sliding window.
2. Use it in \`server.ts\`, before \`express.json()\`, so a refused request isn't read.
3. Tests for a key under the limit, over it, and after its minute has passed.

## Files

- [ ] \`apps/api/src/limits.ts\`, new
- [ ] \`apps/api/src/server.ts\`, one line
- [ ] \`apps/api/tests/limits.test.ts\`, new

\`\`\`ts
app.use(limits({ perMinute: 60, key: apiKey }));
app.use(express.json());
\`\`\`

## Risks

Without Redis the limit falls back to each instance's memory, so a key gets 60 a minute on every instance.
`;

/** A plan's tab as picked: where it stands and the answer in a bar over the page, the plan edited in place under it. */
export function Plan() {
  const [edited, setEdited] = useState<string>();

  return (
    <div className="flex h-[calc(100dvh-2rem)] min-h-160 flex-col overflow-hidden rounded-xl bg-chrome ring-1 ring-black/10">
      <div className="m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-xs ring-1 ring-black/5">
        <Tabs />
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-5">
          <Waiting />
          <span className="text-ink">Waiting for you</span>
          <span className="text-faint">Turn 2 of Rate limiting for the API</span>
          {edited !== undefined && <span className="rounded-[4px] bg-(--tint-blue) px-1.5 text-small/5 text-(--tint-blue-ink)">Edited</span>}
          <div className="flex-1" />
          <Button size="small">Keep planning</Button>
          <span className="inline-flex">
            <Button variant="primary" size="small" className="rounded-r-none">
              Build in Auto
            </Button>
            <Button variant="primary" size="icon" className="w-6 rounded-l-none border-l border-on-primary/20" aria-label="Pick the mode">
              <ChevronDown />
            </Button>
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-176 px-8 pt-6 pb-16">
            <MarkdownEditor markdown={PLAN} onChange={setEdited} placeholder="The plan" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Tabs() {
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 px-3">
      <div className="flex h-7 w-44 items-center gap-2 rounded-lg px-2.5 text-muted">
        <Waiting />
        <FadeText>Rate limiting for the API</FadeText>
      </div>
      <div className="flex h-7 w-44 items-center gap-2 rounded-lg bg-shade px-2.5 text-ink">
        <ClipboardList className="size-4 shrink-0 text-faint" />
        <FadeText>Plan: Rate limiting</FadeText>
      </div>
    </div>
  );
}
