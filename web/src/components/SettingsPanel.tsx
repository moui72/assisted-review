import { useTheme } from '../theme.tsx';
import type { PreloadConfig } from '../api.ts';

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="mb-2 font-sans text-[10px] font-semibold tracking-[0.18em] text-faint uppercase">
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[13px] text-fg/85">{label}</span>
      {children}
    </div>
  );
}

function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  format = String,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <span className="flex gap-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => { if (o !== value) onChange(o); }}
          className={`rounded border px-2 py-0.5 font-mono text-[11px] transition ${
            o === value
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-edge-strong text-muted hover:border-fg/40 hover:text-fg'
          }`}
        >
          {format(o)}
        </button>
      ))}
    </span>
  );
}

export function SettingsPanel({
  open,
  onClose,
  preloadConfig,
  onPreloadChange,
}: {
  open: boolean;
  onClose: () => void;
  preloadConfig: PreloadConfig | null;
  onPreloadChange: (cfg: PreloadConfig) => void;
}) {
  const { theme, toggle } = useTheme();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[380px] rounded-xl border border-edge bg-surface p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-wide text-fg">Settings</h2>
          <button
            onClick={onClose}
            className="rounded border border-edge-strong px-1.5 py-0.5 font-mono text-[11px] text-muted transition hover:text-fg"
          >
            esc
          </button>
        </div>

        <SectionTitle>Appearance</SectionTitle>
        <div className="mb-4 divide-y divide-edge/50">
          <Row label="Theme">
            <ChipGroup
              options={['dark', 'light'] as const}
              value={theme}
              onChange={() => toggle()}
            />
          </Row>
        </div>

        <SectionTitle>Preloading</SectionTitle>
        <div className="divide-y divide-edge/50">
          <Row label="Chunks ahead">
            <ChipGroup
              options={[0, 1, 2, 3]}
              value={preloadConfig?.preload_chunks ?? 1}
              onChange={(v) =>
                onPreloadChange({ preload_chunks: v, preload_overview: preloadConfig?.preload_overview ?? true })
              }
            />
          </Row>
          <Row label="Preload overview">
            <ChipGroup
              options={['on', 'off'] as const}
              value={preloadConfig?.preload_overview ?? true ? 'on' : 'off'}
              onChange={(v) =>
                onPreloadChange({ preload_chunks: preloadConfig?.preload_chunks ?? 1, preload_overview: v === 'on' })
              }
            />
          </Row>
        </div>
      </div>
    </div>
  );
}
