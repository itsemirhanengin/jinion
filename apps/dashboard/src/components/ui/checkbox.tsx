"use client";

import { useEffect, useRef } from "react";

type CheckboxProps = Omit<React.ComponentProps<"input">, "type"> & { indeterminate?: boolean };

export function Checkbox({ indeterminate = false, className = "", ...props }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className={`group inline-grid size-5 grid-cols-1 sm:size-4 ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        className="col-start-1 row-start-1 appearance-none rounded-[0.25rem] border border-neutral-400 bg-white checked:border-neutral-950 checked:bg-neutral-950 indeterminate:border-neutral-950 indeterminate:bg-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:border-neutral-300 disabled:bg-neutral-100 disabled:checked:bg-neutral-100 forced-colors:appearance-auto"
        {...props}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 14 14"
        fill="none"
        className="pointer-events-none col-start-1 row-start-1 size-7/8 self-center justify-self-center stroke-white group-has-disabled:stroke-neutral-950/25"
      >
        <path d="M3 8L6 11L11 3.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-not-has-checked:opacity-0" />
        <path d="M3 7H11" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-not-has-indeterminate:opacity-0" />
      </svg>
    </span>
  );
}
