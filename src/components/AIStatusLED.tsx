import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAIConfig } from '@/lib/queries/settings'
import { useSaveUserSettings } from '@/lib/queries/settings'
import { useAIHealth, useAliveModels } from '@/lib/queries/aiHealth'
import type { UserSettingsRow } from '@/types/db'

export function AIStatusLED() {
  const cfg = useAIConfig()
  const health = useAIHealth()
  const saveSettings = useSaveUserSettings()
  const [open, setOpen] = useState(false)

  const down = !!cfg && health.data?.ok === false
  const alive = useAliveModels(down && open)

  // LED colour by state.
  let color = 'bg-muted' // not configured
  let label = 'AI not configured'
  if (cfg) {
    if (health.isFetching && !health.data) {
      color = 'bg-warning animate-pulse'
      label = 'Checking AI…'
    } else if (health.data?.ok) {
      color = 'bg-success'
      label = 'AI online'
    } else if (health.data && !health.data.ok) {
      color = 'bg-error'
      label = 'AI not responding'
    } else {
      color = 'bg-warning animate-pulse'
      label = 'Checking AI…'
    }
  }

  const modelField: 'selected_model' | 'nvidia_model' =
    cfg?.provider === 'nvidia' ? 'nvidia_model' : 'selected_model'

  const switchTo = (modelId: string) => {
    saveSettings.mutate({ [modelField]: modelId } as Partial<UserSettingsRow>)
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => health.refetch()}
        className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
        title={label}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <span className="hidden text-xs text-muted sm:inline">AI</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-md border border-border bg-surface-2 p-3 text-left shadow-lg">
          <div className="mb-2 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
            <span className="text-xs font-medium text-text">{label}</span>
          </div>

          {!cfg && (
            <p className="text-xs text-muted">
              Add a key in{' '}
              <Link to="/settings" className="text-accent hover:underline">
                Settings
              </Link>
              .
            </p>
          )}

          {cfg && (
            <>
              <p className="mb-2 truncate text-xs text-muted" title={cfg.model}>
                Model: <span className="text-text">{cfg.model}</span>
              </p>

              {health.data && (
                <p className="mb-2 text-[11px] text-muted">
                  Last checked{' '}
                  {new Date(health.data.checkedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · auto every 5 min
                </p>
              )}

              <button
                onClick={() => health.refetch()}
                disabled={health.isFetching}
                className="mb-2 w-full rounded border border-border px-2 py-1 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
              >
                {health.isFetching ? 'Checking…' : 'Re-check now'}
              </button>

              {down && (
                <div className="mt-1 border-t border-border pt-2">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                    Working alternatives
                  </p>
                  {alive.isFetching && <p className="text-xs text-muted">Probing free models…</p>}
                  {!alive.isFetching && alive.data?.length === 0 && (
                    <p className="text-xs text-muted">No responsive free model found right now.</p>
                  )}
                  {alive.data?.map((id) => (
                    <button
                      key={id}
                      onClick={() => switchTo(id)}
                      className="block w-full truncate rounded px-2 py-1 text-left text-xs text-text hover:bg-surface-hover"
                      title={id}
                    >
                      ↔ {id}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
