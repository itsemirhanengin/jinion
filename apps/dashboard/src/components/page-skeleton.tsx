const bar = "rounded-md bg-neutral-950/6";
const card = "rounded-xl ring-1 ring-neutral-950/6";

/**
 * Holds the page's shape while it renders, so a navigation never shows an empty screen between pages. Each variant
 * copies the layout it stands in for: "list" a DataTable page, "detail" a DetailBody or profile form (main column and
 * a 17rem aside), "form" a stepped form (12rem steps, main column, 17rem aside).
 */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "detail" | "form" }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="flex min-h-0 flex-1 animate-in flex-col duration-300 fade-in-0">
      {variant === "list" ? <ListHeader /> : <DetailHeader />}
      <div className="min-h-0 flex-1 animate-pulse overflow-hidden px-4 sm:px-6 lg:px-8">
        {variant === "list" && <ListBody />}
        {variant === "detail" && <DetailBody />}
        {variant === "form" && <FormBody />}
      </div>
    </div>
  );
}

function ListHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-neutral-950/5 px-4 py-3.5 sm:px-6 lg:px-8">
      <span className={`${bar} h-5 w-32`} />
      <span className={`${bar} ml-auto h-7 w-24`} />
      <span className={`${bar} h-7 w-28`} />
    </div>
  );
}

// Back button and section name on the left; position, actions menu and previous/next on the right.
function DetailHeader() {
  return (
    <div className="flex items-center gap-2 border-b border-neutral-950/5 px-4 py-3 sm:px-6 lg:px-8">
      <span className="size-7 rounded-full bg-neutral-950/6" />
      <span className={`${bar} h-5 w-24`} />
      <span className={`${bar} ml-auto h-7 w-32`} />
      <span className={`${bar} h-7 w-14`} />
    </div>
  );
}

function ListBody() {
  return (
    <div className="flex flex-col gap-3 pt-4">
      <div className="flex gap-1">
        {[16, 28, 24].map((w, i) => (
          <span key={i} className={`${bar} h-7`} style={{ width: `${w * 0.25}rem` }} />
        ))}
      </div>
      <span className={`${bar} h-9 w-full rounded-lg`} />
      <div>
        <span className={`${bar} block h-8 w-full rounded-lg`} />
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-neutral-950/6 px-2 py-2.5">
            <span className="size-4 rounded bg-neutral-950/6" />
            <span className={`${bar} h-4`} style={{ width: `${10 + ((i * 3) % 5)}rem` }} />
            <span className={`${bar} ml-auto h-4 w-16`} />
            <span className={`${bar} h-4 w-12 max-sm:hidden`} />
            <span className={`${bar} h-4 w-20 max-sm:hidden`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Aside() {
  return (
    <div className="flex flex-col gap-5">
      {[3, 2, 4, 2].map((rows, i) => (
        <div key={i} className="flex flex-col gap-2.5 border-neutral-950/6 not-first:border-t not-first:pt-5">
          <span className={`${bar} h-4 w-24`} />
          {Array.from({ length: rows }, (_, j) => (
            <div key={j} className="flex justify-between gap-3">
              <span className={`${bar} h-3.5 w-20`} />
              <span className={`${bar} h-3.5 w-16`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DetailBody() {
  return (
    <div className="mx-auto grid max-w-5xl gap-x-10 gap-y-8 pt-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className={`${bar} h-7 w-56`} />
            <span className={`${bar} h-4 w-40`} />
          </div>
          <span className={`${card} h-16`} />
        </div>
        {[40, 56].map((h, i) => (
          <div key={i} className="flex flex-col gap-2">
            <span className={`${bar} h-5 w-28`} />
            <span className={card} style={{ height: `${h * 0.25}rem` }} />
          </div>
        ))}
      </div>
      <Aside />
    </div>
  );
}

function FormBody() {
  return (
    <div className="mx-auto grid max-w-7xl gap-x-10 gap-y-6 pt-6 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[12rem_minmax(0,1fr)_17rem]">
      <div className="flex gap-1 max-xl:hidden xl:flex-col">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`${bar} h-7`} style={{ width: `${8 + (i % 3) * 1.5}rem` }} />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        {[3, 2, 3].map((fields, i) => (
          <div key={i} className={`${card} flex flex-col gap-4 p-4`}>
            <span className={`${bar} h-5 w-32`} />
            {Array.from({ length: fields }, (_, j) => (
              <div key={j} className="flex flex-col gap-1.5">
                <span className={`${bar} h-3.5 w-24`} />
                <span className={`${bar} h-9 w-full rounded-lg`} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <Aside />
    </div>
  );
}
