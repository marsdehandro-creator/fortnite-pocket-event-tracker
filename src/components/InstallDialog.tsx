import { useEffect, useRef } from "react";
import { markInstalled } from "../pwa/install";
import { CloseIcon, DownloadIcon } from "./Icons";

interface InstallDialogProps {
  open: boolean;
  onClose: () => void;
}

/** iPhone/iPad have no install button API — walk the visitor through Share → Add to Home Screen. */
export function InstallDialog({ open, onClose }: InstallDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  const done = () => {
    markInstalled();
    dialogRef.current?.close();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="search-dialog alerts-dialog install-dialog"
      aria-labelledby="install-title"
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
    >
      <div className="search-dialog__box">
        <div className="alerts__head">
          <DownloadIcon className="alerts__head-icon" />
          <h2 id="install-title" className="alerts__title">
            Install Pocket Tracker
          </h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="alerts__body">
          <p className="alerts__status-text">Add the tracker to your Home Screen to open it like an app, full screen, with alerts.</p>
          <ol className="install-steps">
            <li>
              Tap the <strong>Share</strong> button <ShareGlyph /> in the browser toolbar.
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong>, then open <strong>Pocket Tracker</strong> from your Home Screen.
            </li>
          </ol>
          <p className="alerts__hint">Needs iOS 16.4 or later for alerts. Works from Safari, and from Chrome or Edge on recent iOS versions.</p>
          <div className="alerts__actions">
            <button type="button" className="outline-button" onClick={done}>
              I've added it
            </button>
            <button type="button" className="text-button" onClick={onClose}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

/** The iOS share symbol (square with an up arrow), inline so the steps match what's on screen. */
function ShareGlyph() {
  return (
    <svg className="install-steps__glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share icon" role="img">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}
