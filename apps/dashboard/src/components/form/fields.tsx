'use client';

import { useId } from 'react';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { ChevronsUpDown } from 'lucide-react';
import { SelectContent, SelectItem } from '@/components/ui/select';

export const input =
  'w-full rounded-lg bg-white px-3 py-1.5 text-base/6 ring-1 ring-neutral-950/10 placeholder:text-neutral-400 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 disabled:bg-neutral-50 disabled:text-neutral-500 sm:text-sm/5';

const trigger = `${input} flex items-center justify-between gap-2 text-left data-popup-open:outline-2 data-popup-open:-outline-offset-1 data-popup-open:outline-neutral-950`;

type Option = { value: string; label: string };

type TextProps = { label: string; description?: React.ReactNode; aside?: React.ReactNode };

/** A labelled control. The label is tied to the control through the id handed to `children`. */
export function Field({
  label,
  description,
  aside,
  children,
}: TextProps & {
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {aside}
      </div>
      {children(id)}
      {description && <div className="text-xs/5 text-neutral-500">{description}</div>}
    </div>
  );
}

export function TextField({ label, description, aside, ...props }: TextProps & Omit<React.ComponentProps<'input'>, 'id'>) {
  return (
    <Field label={label} description={description} aside={aside}>
      {(id) => <input id={id} className={input} {...props} />}
    </Field>
  );
}

export function TextArea({ label, description, aside, ...props }: TextProps & Omit<React.ComponentProps<'textarea'>, 'id'>) {
  return (
    <Field label={label} description={description} aside={aside}>
      {(id) => <textarea id={id} rows={3} className={`${input} resize-y`} {...props} />}
    </Field>
  );
}

export function Select({ id, options, value, label, onChange }: { id?: string; options: Option[]; value: string; label?: string; onChange: (value: string) => void }) {
  return (
    <SelectPrimitive.Root items={options} value={value} onValueChange={(next: string | null) => onChange(next ?? '')}>
      <SelectPrimitive.Trigger id={id} aria-label={label} className={trigger}>
        <SelectPrimitive.Value className="min-w-0 truncate data-placeholder:text-neutral-400" />
        <ChevronsUpDown className="size-4 shrink-0 stroke-neutral-500" />
      </SelectPrimitive.Trigger>
      <SelectContent alignItemWithTrigger={false} align="start" className="min-w-(--anchor-width) p-1">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="py-1.5 text-sm/5 sm:text-[0.8125rem]/5">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectPrimitive.Root>
  );
}

export function SelectField({ label, description, aside, ...props }: TextProps & { options: Option[]; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label} description={description} aside={aside}>
      {(id) => <Select id={id} label={label} {...props} />}
    </Field>
  );
}
