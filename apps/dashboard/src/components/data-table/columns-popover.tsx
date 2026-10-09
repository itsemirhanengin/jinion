'use client';

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowUpDown, ChevronsUpDown, Columns3, Eye, EyeOff, GripVertical } from 'lucide-react';
import { touchTarget } from '@/components/page';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SortState } from '@/lib/data-table';

type Labeled = { key: string; label: string };

function ColumnRow({ id, label, shown, onToggle }: { id: string; label: string; shown: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative flex items-center gap-1 rounded-md bg-white py-0.5 pr-0.5 text-sm/5 ${isDragging ? 'z-10 shadow-md ring-1 ring-neutral-950/10' : ''}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Move the ${label} column`}
        className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-neutral-400 hover:bg-neutral-950/5 hover:text-neutral-700 active:cursor-grabbing"
      >
        <GripVertical className="size-4 shrink-0" />
      </button>
      <span className={`min-w-0 flex-1 truncate ${shown ? '' : 'text-neutral-500'}`}>{label}</span>
      <button
        type="button"
        onClick={onToggle}
        aria-label={shown ? `Hide the ${label} column` : `Show the ${label} column`}
        className="relative grid size-7 place-items-center rounded-md text-neutral-500 hover:bg-neutral-950/5 hover:text-neutral-950"
      >
        {shown ? <Eye className="size-4 shrink-0" /> : <EyeOff className="size-4 shrink-0" />}
        {touchTarget}
      </button>
    </li>
  );
}

export function ColumnsPopover({
  columns,
  sortFields,
  order,
  visible,
  sort,
  onOrderChange,
  onToggle,
  onSortChange,
}: {
  columns: Labeled[];
  sortFields: (Labeled & { kind: 'date' | 'number' })[];
  order: string[];
  visible: string[];
  sort: SortState;
  onOrderChange: (order: string[]) => void;
  onToggle: (key: string) => void;
  onSortChange: (sort: SortState) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortField = sortFields.find((f) => f.key === sort.key)!;

  const dirLabels =
    sortField.kind === 'date'
      ? { desc: 'Newest first', asc: 'Oldest first' }
      : { desc: 'Most first', asc: 'Fewest first' };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;

    onOrderChange(arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))));
  }

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Columns and sorting"
        className="relative grid size-7 shrink-0 place-items-center rounded-md text-neutral-700 hover:bg-neutral-950/5 hover:text-neutral-950 data-popup-open:bg-neutral-950/5"
      >
        <Columns3 className="size-4 shrink-0" />
        {touchTarget}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-0 p-0">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-950/5 p-2 pl-3">
          <p className="flex items-center gap-2 text-sm/5">
            <ArrowUpDown className="size-4 shrink-0" />
            Sort
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 rounded-md bg-neutral-950/5 py-1 pr-1.5 pl-2 text-sm/5 hover:bg-neutral-950/10">
              {sortField.label}
              <ChevronsUpDown className="size-4 shrink-0 stroke-neutral-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuRadioGroup value={sort.key} onValueChange={(key) => onSortChange({ ...sort, key: String(key) })}>
                {sortFields.map((f) => (
                  <DropdownMenuRadioItem key={f.key} value={f.key}>
                    {f.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={sort.dir}
                onValueChange={(dir) => onSortChange({ ...sort, dir: dir as SortState['dir'] })}
              >
                <DropdownMenuRadioItem value="desc">{dirLabels.desc}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="asc">{dirLabels.asc}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-1 p-2">
          <p className="px-1 text-xs/5 text-neutral-500">Columns</p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={handleDragEnd}
            accessibility={{
              screenReaderInstructions: {
                draggable: 'Press space to pick it up, move it with the arrow keys, and press space again to drop it.',
              },
            }}
          >
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <ul role="list" className="relative flex flex-col">
                {order.map((key) => (
                  <ColumnRow
                    key={key}
                    id={key}
                    label={columns.find((c) => c.key === key)!.label}
                    shown={visible.includes(key)}
                    onToggle={() => onToggle(key)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      </PopoverContent>
    </Popover>
  );
}
