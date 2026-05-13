import clsx from 'clsx';

import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type ViewCategory,
} from '../../state/useViewFilter';

interface Props {
  active: Set<ViewCategory>;
  toggle: (c: ViewCategory) => void;
  setAll: () => void;
  setOnly: (c: ViewCategory) => void;
  allOn: boolean;
}

export function ViewFilterToggle({
  active,
  toggle,
  setAll,
  setOnly,
  allOn,
}: Props) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mr-1">
        Show
      </span>
      <button
        onClick={setAll}
        className={clsx(
          'text-xs px-3 py-1.5 rounded-full border font-medium transition-colors',
          allOn
            ? 'bg-ink-900 text-sand-50 border-ink-900'
            : 'bg-sand-100 text-ink-700 border-sand-200 hover:bg-sand-200',
        )}
      >
        All
      </button>
      {ALL_CATEGORIES.map((c) => {
        const on = active.has(c);
        return (
          <button
            key={c}
            onClick={() => toggle(c)}
            onDoubleClick={() => setOnly(c)}
            title="Click to toggle · Double-click to show only this"
            className={clsx(
              'text-xs px-3 py-1.5 rounded-full border font-medium transition-colors',
              on
                ? 'bg-sage-100 text-sage-700 border-sage-300'
                : 'bg-sand-100 text-ink-400 border-sand-200 hover:bg-sand-200',
            )}
          >
            {CATEGORY_LABELS[c]}
          </button>
        );
      })}
    </div>
  );
}
