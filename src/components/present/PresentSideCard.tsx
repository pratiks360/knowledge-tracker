import type { NodeRow } from '@/types/db'
import { useResources } from '@/lib/queries/resources'

export function PresentSideCard({ node, onClose }: { node: NodeRow; onClose: () => void }) {
  const { data: resources } = useResources(node.id)
  const pinned = resources?.filter((r) => r.pinned) ?? []

  return (
    <div className="absolute right-4 top-4 z-10 w-72 rounded-lg border border-border bg-surface/95 p-4 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-text">{node.title}</h3>
        <button onClick={onClose} className="shrink-0 text-xs text-muted hover:text-text">
          ✕
        </button>
      </div>
      {node.present_summary ? (
        <p className="whitespace-pre-wrap text-sm text-text">{node.present_summary}</p>
      ) : (
        <p className="text-sm italic text-muted">No summary added yet.</p>
      )}
      {pinned.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Resources</p>
          <ul className="flex flex-col gap-1">
            {pinned.map((r) => (
              <li key={r.id}>
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-accent hover:underline"
                  >
                    {r.title ?? r.url}
                  </a>
                ) : (
                  <span className="text-sm text-text">{r.title}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
