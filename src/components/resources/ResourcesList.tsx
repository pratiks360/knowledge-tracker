import { useResources } from '@/lib/queries/resources'
import { AddResourceForm } from '@/components/resources/AddResourceForm'
import { ResourceCard } from '@/components/resources/ResourceCard'

export function ResourcesList({ nodeId }: { nodeId: string }) {
  const { data: resources, isLoading } = useResources(nodeId)

  return (
    <div className="flex flex-col gap-3">
      <AddResourceForm nodeId={nodeId} />
      {isLoading && <p className="text-sm text-muted">Loading resources…</p>}
      {!isLoading && resources?.length === 0 && (
        <p className="text-sm text-muted">
          No resources yet — add a web page or YouTube video above.
        </p>
      )}
      {resources?.map((r) => (
        <ResourceCard key={r.id} resource={r} nodeId={nodeId} />
      ))}
    </div>
  )
}
