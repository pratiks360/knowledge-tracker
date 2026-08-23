import { useMemo } from 'react'
import { useUserSettings, useSaveUserSettings } from '@/lib/queries/settings'
import { useNodes } from '@/lib/queries/nodes'

const STATUS_LABEL: Record<string, string> = {
  ok: 'completed',
  rate_limited: 'stopped (all providers rate-limited)',
  error: 'error',
}

export function AutofillSettings() {
  const { data: settings } = useUserSettings()
  const save = useSaveUserSettings()
  const { data: nodes } = useNodes()

  const emptyCount = useMemo(
    () => (nodes ?? []).filter((n) => !n.details_md?.trim()).length,
    [nodes]
  )

  const enabled = settings?.autofill_enabled ?? false
  const hour = settings?.autofill_hour ?? 2
  const max = settings?.autofill_max_per_run ?? 20

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Nightly auto-fill
        </h2>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => save.mutate({ autofill_enabled: e.target.checked })}
          />
          Enabled
        </label>
      </div>

      <p className="mb-3 text-sm text-muted">
        Once a night, spend leftover <span className="text-text">free</span> AI credits generating
        details for topics that don&apos;t have any. It rotates across every provider you&apos;ve set
        up (OpenRouter → NVIDIA → Cloudflare) — when one hits its free limit, it moves to the next.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs text-muted">
          <span className="mb-1 block">Run at (UTC hour)</span>
          <select
            value={hour}
            disabled={!enabled}
            onChange={(e) => save.mutate({ autofill_hour: Number(e.target.value) })}
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-accent disabled:opacity-50"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-muted">
          <span className="mb-1 block">Max topics per night</span>
          <input
            type="number"
            min={1}
            max={200}
            value={max}
            disabled={!enabled}
            onChange={(e) => {
              const v = Math.max(1, Math.min(200, Number(e.target.value) || 1))
              save.mutate({ autofill_max_per_run: v })
            }}
            className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-accent disabled:opacity-50"
          />
        </label>
      </div>

      <div className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
        <span className="text-text">{emptyCount}</span> topic{emptyCount === 1 ? '' : 's'} still
        without details.
        {settings?.autofill_last_run && (
          <>
            {' · Last run '}
            {new Date(settings.autofill_last_run).toLocaleString()} — filled{' '}
            <span className="text-text">{settings.autofill_last_count ?? 0}</span>
            {settings.autofill_last_status
              ? `, ${STATUS_LABEL[settings.autofill_last_status] ?? settings.autofill_last_status}`
              : ''}
            .
          </>
        )}
      </div>
    </section>
  )
}
