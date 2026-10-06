import { Dialog } from '@base-ui/react/dialog';

export interface ImageViewerProps {
  /** The image to show; none keeps it closed. */
  image?: { src: string; name: string };
  onClose: () => void;
}

/** An image over the window, as large as fits, its name under it; Escape or a click beside it closes it. */
export function ImageViewer({ image, onClose }: ImageViewerProps) {
  return (
    <Dialog.Root open={image !== undefined} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          aria-label={image?.name}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-12 outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-97 data-ending-style:opacity-0 data-starting-style:scale-97 data-starting-style:opacity-0"
          onClick={(event) => event.target === event.currentTarget && onClose()}
        >
          {image && (
            <>
              <img src={image.src} alt={image.name} className="float max-h-[80vh] max-w-full rounded-[10px] object-contain" />
              <Dialog.Title className="max-w-full truncate text-small text-white/80">{image.name}</Dialog.Title>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
