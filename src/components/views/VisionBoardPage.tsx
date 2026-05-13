import { useRef, useState } from 'react';
import clsx from 'clsx';

import { usePlanner } from '../../state/usePlanner';
import { Image, Trash, Upload } from '../icons';

// Cap roughly aligned with localStorage's typical ~5 MB-per-origin budget.
// A base64 data URL inflates the raw bytes by ~4/3, so 4 MB raw ≈ 5.5 MB
// stored.  We warn above that to keep the experience predictable.
const MAX_PDF_BYTES = 4 * 1024 * 1024;

export function VisionBoardPage() {
  const { visionBoardPdf, visionBoardName, setVisionBoard, clearVisionBoard } =
    usePlanner();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setError(null);
    if (file.type !== 'application/pdf') {
      setError('Please choose a PDF file.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setError(
        `That PDF is ${mb} MB — too large for browser storage. Try compressing it to under 4 MB.`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        setError("Couldn't read that file. Try again?");
        return;
      }
      const ok = setVisionBoard(dataUrl, file.name);
      if (!ok) {
        setError(
          "Your browser refused to store this PDF — it's probably too large for available space.",
        );
      }
    };
    reader.onerror = () => setError("Couldn't read that file. Try again?");
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <div className="font-display text-3xl text-ink-900">Vision board</div>
        <div className="text-sm text-ink-500 mt-1">
          Upload a PDF of your vision board and it'll live here. Open it any time
          you need a reminder of where you're headed.
        </div>
      </div>

      {visionBoardPdf ? (
        <div className="space-y-3">
          <div className="card p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-sage-50 grid place-items-center text-sage-500 flex-shrink-0">
                <Image className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-ink-900 truncate">
                  {visionBoardName ?? 'Vision board.pdf'}
                </div>
                <div className="text-xs text-ink-400">
                  Stored locally in your browser
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-soft text-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                Replace
              </button>
              <a
                href={visionBoardPdf}
                download={visionBoardName ?? 'vision-board.pdf'}
                className="btn-soft text-xs"
              >
                Download
              </a>
              <button
                onClick={() => {
                  if (confirm('Remove the vision board PDF?')) {
                    clearVisionBoard();
                  }
                }}
                className="btn-ghost text-xs text-ink-500 hover:text-rose-400"
                title="Remove"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Render the PDF at US Letter aspect (8.5 × 11) so each page
              fills the viewer at full width and the user scrolls one page at
              a time.  The #view=FitH fragment tells the embedded PDF viewer
              to fit pages to width (Chrome/Edge/Firefox all honour this). */}
          <div className="mx-auto w-full max-w-[900px] aspect-[8.5/11] rounded-2xl overflow-hidden border border-sand-200 bg-sand-100">
            <iframe
              src={`${visionBoardPdf}#view=FitH&toolbar=1`}
              title="Vision board"
              className="w-full h-full bg-sand-50"
            />
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={clsx(
            'card p-12 border-2 border-dashed text-center transition-colors',
            dragOver
              ? 'border-sage-400 bg-sage-50/40'
              : 'border-sand-300 hover:border-sage-300',
          )}
        >
          <div className="w-12 h-12 rounded-2xl bg-sand-200 grid place-items-center mx-auto mb-3 text-ink-500">
            <Upload className="w-6 h-6" />
          </div>
          <div className="font-display text-xl text-ink-900">
            Drop a PDF here
          </div>
          <div className="text-sm text-ink-500 mt-1 max-w-md mx-auto">
            Or pick one from your computer. It stays in your browser — nothing
            gets uploaded anywhere.
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary mt-4 mx-auto"
          >
            <Upload className="w-4 h-4" />
            Choose PDF
          </button>
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-400 bg-rose-100/30 border border-rose-300 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // Reset so picking the same file twice in a row still fires onChange.
          e.target.value = '';
        }}
      />
    </div>
  );
}
