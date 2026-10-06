const COPIED = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'tabSize',
  'textTransform',
  'wordSpacing',
] as const;

/**
 * Where the line with the caret ends, from the top of the textarea's box. A textarea doesn't tell, so a hidden copy of
 * it lays out the text up to the caret.
 */
export function caretLineBottom(textarea: HTMLTextAreaElement) {
  const style = getComputedStyle(textarea);
  const copy = document.createElement('div');
  const marker = document.createElement('span');

  for (const property of COPIED) copy.style[property] = style[property];
  Object.assign(copy.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', top: '0', left: '-9999px' });

  copy.textContent = textarea.value.slice(0, textarea.selectionStart);
  marker.textContent = '​';
  copy.append(marker);
  document.body.append(copy);

  const bottom = marker.offsetTop + marker.offsetHeight - textarea.scrollTop;

  copy.remove();

  return bottom;
}

/** The top of what would cut off something drawn above the element: the nearest ancestor that clips, or the window. */
export function clipTop(element: HTMLElement) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (getComputedStyle(parent).overflowY !== 'visible') return parent.getBoundingClientRect().top;
  }

  return 0;
}
