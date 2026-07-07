import { Link } from 'react-router-dom'
import type { NodeRow } from '@/types/db'

export function Breadcrumbs({ ancestors, current }: { ancestors: NodeRow[]; current: NodeRow }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-muted">
      <Link to="/" className="hover:text-text">
        Dashboard
      </Link>
      {ancestors.map((a) => (
        <span key={a.id} className="flex items-center gap-1">
          <span className="text-muted">/</span>
          <Link to={`/node/${a.id}`} className="hover:text-text">
            {a.title}
          </Link>
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="text-muted">/</span>
        <span className="text-text">{current.title}</span>
      </span>
    </nav>
  )
}
