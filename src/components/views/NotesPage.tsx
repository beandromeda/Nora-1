import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

import { usePlanner } from '../../state/usePlanner';
import type { Note, NoteColor } from '../../types';
import { Plus, Trash } from '../icons';

// Sticky-note palette.  Each is "tinted background + brighter accent" so the
// cards read clearly on the dark surface.
const STICKY_COLORS: Record<
  NoteColor,
  { card: string; accent: string; chip: string; label: string }
> = {
  lavender: {
    card: 'bg-lavender-200/40 border-lavender-300',
    accent: 'text-lavender-500',
    chip: 'bg-lavender-500',
    label: 'Lavender',
  },
  sage: {
    card: 'bg-sage-200/40 border-sage-300',
    accent: 'text-sage-500',
    chip: 'bg-sage-500',
    label: 'Pink',
  },
  sky: {
    card: 'bg-sky-200/40 border-sky-300',
    accent: 'text-sky-500',
    chip: 'bg-sky-500',
    label: 'Sky',
  },
  rose: {
    card: 'bg-rose-200/40 border-rose-300',
    accent: 'text-rose-400',
    chip: 'bg-rose-400',
    label: 'Coral',
  },
  clay: {
    card: 'bg-clay-200/40 border-clay-300',
    accent: 'text-clay-400',
    chip: 'bg-clay-400',
    label: 'Berry',
  },
};

const COLOR_ORDER: NoteColor[] = ['lavender', 'sage', 'sky', 'rose', 'clay'];

export function NotesPage() {
  const { notes, addNote, updateNote, deleteNote } = usePlanner();

  const handleNew = () => {
    const id = addNote();
    // Defer focus to after the new card renders.
    requestAnimationFrame(() => {
      const el = document.getElementById(`note-text-${id}`);
      if (el instanceof HTMLTextAreaElement) el.focus();
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-display text-3xl text-ink-900">Notes</div>
          <div className="text-sm text-ink-500 mt-1">
            Quick sticky notes for anything you want to remember. They save as
            you type.
          </div>
        </div>
        <button onClick={handleNew} className="btn-primary">
          <Plus className="w-4 h-4" />
          New note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="font-display text-xl text-ink-900">
            Your notes will live here
          </div>
          <div className="text-sm text-ink-500 mt-1 max-w-md mx-auto">
            Click "New note" to add one — anything from a recipe to a
            half-formed idea. Each note saves automatically.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onContent={(content) => updateNote(note.id, { content })}
              onColor={(color) => updateNote(note.id, { color })}
              onDelete={() => deleteNote(note.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  onContent,
  onColor,
  onDelete,
}: {
  note: Note;
  onContent: (text: string) => void;
  onColor: (color: NoteColor) => void;
  onDelete: () => void;
}) {
  const color = note.color ?? 'lavender';
  const styles = STICKY_COLORS[color];
  const [draft, setDraft] = useState(note.content);
  const saveTimer = useRef<number | null>(null);

  // If the note changes from outside (rare but possible), reset the draft.
  useEffect(() => {
    setDraft(note.content);
  }, [note.content]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const handleChange = (value: string) => {
    setDraft(value);
    // Debounced auto-save so each keystroke doesn't hammer state.
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (value !== note.content) onContent(value);
    }, 350);
  };

  const handleBlur = () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (draft !== note.content) onContent(draft);
  };

  const updated = new Date(note.updatedAt);

  return (
    <div
      className={clsx(
        'rounded-2xl border p-3 shadow-soft flex flex-col gap-2 transition-all',
        styles.card,
      )}
    >
      <textarea
        id={`note-text-${note.id}`}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        rows={5}
        placeholder="Write something…"
        className={clsx(
          'w-full bg-transparent border-0 outline-none resize-none text-sm text-ink-900 placeholder:text-ink-400 leading-relaxed min-h-[8rem]',
        )}
      />
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-sand-200/30">
        <div className="flex items-center gap-1">
          {COLOR_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => onColor(c)}
              title={STICKY_COLORS[c].label}
              className={clsx(
                'w-4 h-4 rounded-full transition-all',
                STICKY_COLORS[c].chip,
                color === c
                  ? 'ring-2 ring-offset-2 ring-offset-sand-50 ring-ink-700 scale-110'
                  : 'opacity-60 hover:opacity-100',
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-ink-400">
            {updated.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <button
            onClick={() => {
              if (confirm('Delete this note?')) onDelete();
            }}
            className={clsx(
              'p-1 rounded-md text-ink-400 hover:bg-sand-200/40',
              'hover:text-rose-400',
            )}
            title="Delete note"
          >
            <Trash className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
