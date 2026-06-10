interface Binding {
  keys: string[];
  label: string;
}

function Row({ keys, label }: Binding) {
  return (
    <div className="flex items-center justify-between gap-6 py-1">
      <span className="text-[13px] text-fg/85">{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="rounded border border-edge-strong bg-bg px-1.5 py-0.5 font-mono text-[11px] text-muted"
          >
            {k}
          </kbd>
        ))}
      </span>
    </div>
  );
}

export function HelpOverlay({
  open,
  onClose,
  isMac,
}: {
  open: boolean;
  onClose: () => void;
  isMac: boolean;
}) {
  if (!open) return null;
  const mod = isMac ? '⌘' : 'Ctrl';

  const nav: Binding[] = [
    { keys: ['←', '→'], label: 'Previous / next chunk' },
    { keys: [`${mod}←`, `${mod}→`], label: 'Previous / next unread (skip viewed)' },
    { keys: ['j', 'k'], label: 'Next / previous (alt)' },
  ];
  const actions: Binding[] = [
    { keys: ['↵'], label: 'Mark viewed & advance' },
    { keys: ['esc'], label: 'Mark unread' },
    { keys: ['f'], label: 'Flag chunk' },
    { keys: ['c'], label: 'Focus comment box' },
    { keys: [`${mod}↵`], label: 'Save comment (in box)' },
    { keys: ['?'], label: 'Toggle this help' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[460px] rounded-xl border border-edge bg-surface p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-wide text-fg">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="rounded border border-edge-strong px-1.5 py-0.5 font-mono text-[11px] text-muted transition hover:text-fg"
          >
            esc
          </button>
        </div>
        <Section title="Navigate" rows={nav} />
        <div className="mt-3">
          <Section title="Review" rows={actions} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: Binding[] }) {
  return (
    <div>
      <div className="mb-1 font-sans text-[10px] font-semibold tracking-[0.18em] text-faint uppercase">
        {title}
      </div>
      <div className="divide-y divide-edge/50">
        {rows.map((r, i) => (
          <Row key={i} {...r} />
        ))}
      </div>
    </div>
  );
}
