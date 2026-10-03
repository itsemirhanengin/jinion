# @jinion/virtualization

Mounts only what is in view of a long list of items of different heights, so a conversation of thousands of entries costs what a few screens of it do. `@jinion/tui`'s `ScrollView` is built on it.

## The core

`Virtualizer` knows nothing of React or Ink. It keeps the height of every item it was told about and answers two questions:

- `window(keys, { height, top })`: which items to mount for a view `height` rows tall whose first row is `top` (`undefined` follows the newest row at the bottom). It returns the slots to mount, the rows `before` and `after` them to draw as empty space, and the `total`, `first` and `maxTop` rows the scrolling needs. An item never measured stands in at an estimate (`estimate`, 2 rows).
- `measure(window, heights, width)`: takes the heights the renderer laid the slots out at. It says whether any changed, so the window is worked out again, and how far the view has to move to keep still (`shift`): an item above it that turned out taller or shorter moves everything below it. Heights at another width are dropped, since text wraps differently there.

The window holds the view, a screen above it and, while scrolled, a screen below it. Following the newest row, items settle from the bottom up, so they go straight in. While scrolled, an item never measured is marked not `ready`: it is laid out out of sight first and stands in as empty space of its estimate, so putting it in place doesn't move what is in view.

## The Ink hook

`useVirtual(children, { viewport, top, onShift })` does the rendering part for an Ink box that scrolls. Each child is an item with a stable `key`.

```tsx
const virtual = useVirtual(children, {
  viewport: viewportRef,
  top,
  onShift: (rows) => setTop((current) => (current === undefined ? current : current + rows)),
});

<Box ref={viewportRef} flexGrow={1} overflow="hidden" justifyContent={top === undefined ? 'flex-end' : 'flex-start'}>
  <Box ref={virtual.contentRef} flexDirection="column" flexShrink={0} marginTop={top === undefined ? 0 : -virtual.first}>
    {virtual.content}
  </Box>
  {virtual.offscreen}
</Box>
```

After Ink lays a frame out, the hook measures the mounted items and hands their heights to the core; a change starts another render, and a `shift` goes to `onShift`. `offscreen` is a box positioned below the view, where the viewport cuts it off: items not `ready` are laid out there at the items' width and never drawn. An item that draws again on its own, such as a section expanded, shows up as a new content height and is measured again.

State inside an item is lost when it scrolls far out of view, so keep it outside the item.
