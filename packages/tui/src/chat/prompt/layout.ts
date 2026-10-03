import stringWidth from 'string-width';

export interface Row {
  start: number;
  end: number;
}

export function layout(value: string, width: number): Row[] {
  const rows: Row[] = [];
  let start = 0;
  let column = 0;
  for (let index = 0; index < value.length; ) {
    const char = String.fromCodePoint(value.codePointAt(index)!);
    if (char === '\n') {
      rows.push({ start, end: index });
      start = index + 1;
      column = 0;
      index += 1;
      continue;
    }
    const charWidth = stringWidth(char);
    if (column + charWidth > width && index > start) {
      rows.push({ start, end: index });
      start = index;
      column = 0;
    }
    column += charWidth;
    index += char.length;
  }
  rows.push({ start, end: value.length });
  return rows;
}

/** At a wrap, the cursor goes to the start of the next row. */
export function rowOf(rows: Row[], position: number) {
  const index = rows.findIndex(
    (row, at) => position < row.end || (position === row.end && rows[at + 1]?.start !== row.end),
  );
  return index === -1 ? rows.length - 1 : index;
}

export function offsetAt(value: string, row: Row, column: number) {
  let width = 0;
  for (let index = row.start; index < row.end; ) {
    const char = String.fromCodePoint(value.codePointAt(index)!);
    const charWidth = stringWidth(char);
    if (width + charWidth > column) return index;
    width += charWidth;
    index += char.length;
  }
  return row.end;
}
