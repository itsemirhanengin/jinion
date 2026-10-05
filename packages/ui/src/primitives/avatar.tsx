/** A person's initial in a circle, colored by their name so the same person always looks the same. */
export function Avatar({ name }: { name: string }) {
  const hue = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360;

  return (
    <span
      title={name}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-small font-medium text-white"
      style={{ backgroundColor: `oklch(0.68 0.16 ${hue})` }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
