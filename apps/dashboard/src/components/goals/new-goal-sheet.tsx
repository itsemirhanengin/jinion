'use client';

import { useState } from 'react';
import { primaryButton, secondaryButton } from '@/components/data-table/buttons';
import { SelectField, TextArea, TextField } from '@/components/form/fields';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { NOW } from '@/lib/clock';
import type { Goal, MetricId } from '@/lib/data';
import { DAY } from '@/lib/days';
import { formatMetric, METRICS, metricOf } from '@/lib/metric-defs';

const DEADLINES = [
  { value: '7', label: 'In a week' },
  { value: '14', label: 'In two weeks' },
  { value: '30', label: 'In a month' },
  { value: '60', label: 'In two months' },
];

/** Sets a goal on one of the metrics: the target, the deadline, and what to do once it is met or missed. */
export function NewGoalSheet({ open, onClose, onCreate, now }: { open: boolean; onClose: () => void; onCreate: (goal: Goal) => void; now: Record<MetricId, number> }) {
  const [name, setName] = useState('');
  const [metricId, setMetricId] = useState<MetricId>('retained');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('14');
  const [ifMet, setIfMet] = useState('');
  const [ifMissed, setIfMissed] = useState('');

  const metric = metricOf(metricId);
  const ready = name.trim() && Number(target) > 0 && ifMet.trim() && ifMissed.trim();

  function close() {
    onClose();
    setName('');
    setMetricId('retained');
    setTarget('');
    setDeadline('14');
    setIfMet('');
    setIfMissed('');
  }

  function create() {
    onCreate({
      id: `new-${Date.now()}`,
      name: name.trim(),
      metric: metricId,
      target: Number(target),
      startsAt: NOW,
      deadline: new Date(Date.parse(NOW) + Number(deadline) * DAY).toISOString(),
      ifMet: ifMet.trim(),
      ifMissed: ifMissed.trim(),
    });

    close();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent className="w-full gap-0 text-sm/5 sm:max-w-md sm:text-[0.8125rem]/5">
        <SheetHeader className="border-b border-neutral-950/8">
          <SheetTitle>New goal</SheetTitle>
          <SheetDescription>A number to reach by a date, and what you will do whether it is reached or not. Decide that now, before the data is in.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          <TextField label="Name" placeholder="Still using it after two weeks" value={name} onChange={(event) => setName(event.target.value)} />
          <SelectField
            label="Metric"
            description={`${metric.description} Now: ${formatMetric(now[metricId], metric.unit)}.`}
            options={METRICS.map((option) => ({ value: option.id, label: option.label }))}
            value={metricId}
            onChange={(value) => setMetricId(value as MetricId)}
          />
          <TextField
            label={metric.lowerIsBetter ? 'Target, at most' : 'Target, at least'}
            inputMode="decimal"
            placeholder={metric.unit === 'percent' ? '80' : '4'}
            value={target}
            onChange={(event) => setTarget(event.target.value.replace(',', '.'))}
            aside={<span className="text-neutral-500">{UNITS[metric.unit]}</span>}
          />
          <SelectField label="Deadline" options={DEADLINES} value={deadline} onChange={setDeadline} />
          <TextArea label="If it's met" placeholder="Open a second round to people I don't know." value={ifMet} onChange={(event) => setIfMet(event.target.value)} />
          <TextArea label="If it's missed" placeholder="Talk to everyone who stopped first." value={ifMissed} onChange={(event) => setIfMissed(event.target.value)} />
        </div>
        <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-neutral-950/8">
          <button type="button" onClick={close} className={`px-2.5 py-1 ${secondaryButton}`}>
            Cancel
          </button>
          <button type="button" disabled={!ready} onClick={create} className={`px-2.5 py-1 ${primaryButton}`}>
            Set the goal
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const UNITS = { users: 'people', percent: 'percent', days: 'days', turns: 'turns' };
