import type { ResourceRow } from '@/types/db'

const KIND_LABEL: Record<ResourceRow['kind'], string> = {
  web: 'Web',
  youtube: 'YouTube',
  manual: 'Manual',
}

/**
 * Compact, deterministic list of a node's sources rendered straight from the
 * resource rows — every link here is a real, stored URL (no AI hallucination).
 * Used as the citation footer under the merged Details and in the Sources tab.
 */
export function SourceList({ resources }: { resources: ResourceRow[] }) {
  if (resources.length === 0) return null

  return (
    <ol className="flex list-none flex-col gap-1.5 pl-0">
      {resources.map((r, i) => {
        const label = r.title ?? r.url ?? 'Untitled'
        return (
          <li key={r.id} className="flex items-baseline gap-2 text-sm">
            <span className="text-muted tabular-nums">{i + 1}.</span>
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-muted">
              {KIND_LABEL[r.kind]}
            </span>
            {r.url ? (
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate text-accent hover:underline"
                title={r.url}
              >
                {label}
              </a>
            ) : (
              <span className="min-w-0 truncate text-text" title={label}>
                {label}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
