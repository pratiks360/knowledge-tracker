import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUserSettings, useSaveUserSettings, useRunAutofillNow } from '@/lib/queries/settings'
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
  const runNow = useRunAutofillNow()
  const [runError, setRunError] = useState<string | null>(null)

  const emptyCount = useMemo(
    () => (nodes ?? []).filter((n) => !n.details_md?.trim()).length,
    [nodes]
  )

  const enabled = settings?.autofill_enabled ?? false
  const hour = settings?.autofill_hour ?? 2
  const max = settings?.autofill_max_per_run ?? 20

  const existingIds = useMemo(() => new Set((nodes ?? []).map((n) => n.id)), [nodes])
  const lastFilled = settings?.autofill_last_filled ?? []

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Nightly auto-fill
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setRunError(null)
              runNow.mutate(undefined, {
                onError: (e) => setRunError(e instanceof Error ? e.message : 'Run failed.'),
              })
            }}
            disabled={runNow.isPending}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
          >
            {runNow.isPending ? 'Running…' : 'Run now'}
          </button>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => save.mutate({ autofill_enabled: e.target.checked })}
            />
            Enabled
          </label>
        </div>
      </div>

      {runError && <p className="mb-3 text-sm text-error">{runError}</p>}
      {runNow.isSuccess && !runNow.isPending && (
        <p className="mb-3 text-sm text-success">
          Filled {runNow.data.filled} topic{runNow.data.filled === 1 ? '' : 's'}
          {runNow.data.status !== 'ok' ? ` (${runNow.data.status})` : ''}.
        </p>
      )}

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

      {lastFilled.length > 0 && (
        <div className="mt-2 rounded-md border border-border bg-surface px-3 py-2">
          <p className="mb-1.5 text-xs uppercase tracking-wide text-muted">
            Filled last run
          </p>
          <ul className="flex flex-col gap-1">
            {lastFilled.map((f) =>
              existingIds.has(f.id) ? (
                <li key={f.id}>
                  <Link
                    to={`/node/${f.id}`}
                    className="text-xs text-accent-2 hover:underline"
                  >
                    {f.title}
                  </Link>
                </li>
              ) : (
                <li key={f.id} className="text-xs text-muted line-through">
                  {f.title}
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </section>
  )
}
