import { Avatar, Button, LineCounts, Pill, type Status, StatusIcon } from '@jinion/ui';
import { FolderOpen, GitBranch, Search, ShieldCheck } from 'lucide-react';
import { Specimen, Specimens } from '../specimen.js';

const statuses: Status[] = ['working', 'waiting', 'done', 'idle', 'failed'];

export function Primitives() {
  return (
    <Specimens>
      <Specimen title="Buttons">
        <div className="flex items-center gap-2">
          <Button variant="primary" size="small">
            Open project
          </Button>
          <Button variant="outline">
            <FolderOpen className="size-4" />
            Open folder
          </Button>
          <Button>Cancel</Button>
          <Button variant="outline" size="icon" aria-label="Search" className="[&_svg]:size-3.5">
            <Search />
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </Specimen>
      <Specimen title="Pills">
        <div className="flex items-center gap-2">
          <Pill chevron="up-down">
            acme-api
          </Pill>
          <Pill icon={<ShieldCheck />}>
            Accept edits
          </Pill>
          <Pill>Opus 4.6</Pill>
          <Pill icon={<GitBranch />}>main</Pill>
        </div>
      </Specimen>
      <Specimen title="Status">
        <div className="flex items-center gap-4">
          {statuses.map((status) => (
            <span key={status} className="flex items-center gap-1.5 text-muted">
              <StatusIcon status={status} />
              {status}
            </span>
          ))}
        </div>
      </Specimen>
      <Specimen title="Line counts and avatars">
        <div className="flex items-center gap-4">
          <LineCounts added={24} removed={3} />
          <LineCounts added={12} removed={0} />
          <LineCounts added={0} removed={7} />
          <Avatar name="Emirhan" />
          <Avatar name="Deniz" />
          <Avatar name="Ada" />
        </div>
      </Specimen>
    </Specimens>
  );
}
