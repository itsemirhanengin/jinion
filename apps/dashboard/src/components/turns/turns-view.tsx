'use client';

import { useMemo } from 'react';
import { Workflow } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { type Stat, StatStrip } from '@/components/detail/stat-strip';
import { SignalBadges } from '@/components/turns/turn-table';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Column } from '@/lib/data-table';
import { formatCompact, formatDuration, formatStamp } from '@/lib/format';
import { CATEGORIES, CLIENTS, OUTCOMES } from '@/lib/labels';
import { type TurnRow, turnsList } from '@/lib/lists/turns';

const columns: Column<TurnRow>[] = [
  { key: 'person', label: 'Person', render: (turn) => turn.person },
  { key: 'project', label: 'Project', render: (turn) => turn.project },
  { key: 'outcome', label: 'Outcome', render: (turn) => <StatusBadge tone={OUTCOMES[turn.outcome].tone}>{OUTCOMES[turn.outcome].label}</StatusBadge> },
  { key: 'signals', label: 'Signals', render: (turn) => <SignalBadges signals={turn.signals} /> },
  { key: 'model', label: 'Model', render: (turn) => turn.model },
  { key: 'client', label: 'Client', render: (turn) => CLIENTS[turn.client] },
  { key: 'category', label: 'Kind of work', render: (turn) => CATEGORIES[turn.category] },
  { key: 'took', label: 'Took', align: 'right', render: (turn) => formatDuration(turn.durationMs) },
  { key: 'tools', label: 'Tool calls', align: 'right', render: (turn) => turn.tools },
  { key: 'tokens', label: 'Tokens', align: 'right', render: (turn) => formatCompact(turn.tokens.input + turn.tokens.output) },
];

export function TurnsView({ rows, users, figures }: { rows: TurnRow[]; users: { id: string; name: string }[]; figures: Stat[] }) {
  const list = useMemo(() => turnsList(users), [users]);

  return (
    <DataTable
      title="Turns"
      icon={Workflow}
      unit={['turn', 'turns']}
      rows={rows}
      getRowId={(turn) => turn.id}
      primary={{ label: 'Started', text: (turn) => formatStamp(turn.startedAt), href: (turn) => `/turns/${turn.id}` }}
      columns={columns}
      defaultVisible={['person', 'project', 'outcome', 'signals', 'model', 'took', 'tokens']}
      list={list}
      insights={() => <StatStrip stats={figures} />}
      search={{ label: 'Search turns', placeholder: 'Search by person, project or model' }}
      emptyText="No turn matches these filters."
    />
  );
}
