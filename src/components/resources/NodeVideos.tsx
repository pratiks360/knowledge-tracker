import { useState } from 'react'
import {
  useResources,
  useDeleteResource,
  useAddYoutubeVideo,
  youtubeVideoId,
} from '@/lib/queries/resources'
import { YouTubeEmbed } from '@/components/resources/YouTubeEmbed'

export function NodeVideos({ nodeId }: { nodeId: string }) {
  const { data: resources } = useResources(nodeId)
  const addVideo = useAddYoutubeVideo(nodeId)
  const deleteResource = useDeleteResource(nodeId)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Any youtube resource with a resolvable video id is watchable here.
  const videos = (resources ?? [])
    .filter((r) => r.kind === 'youtube' && r.url)
    .map((r) => ({ resource: r, videoId: youtubeVideoId(r.url!) }))
    .filter((v): v is { resource: (typeof v)['resource']; videoId: string } => !!v.videoId)

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    setError(null)
    addVideo.mutate(trimmed, {
      onSuccess: () => setUrl(''),
      onError: (err) => setError(err instanceof Error ? err.message : 'Could not add video.'),
    })
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Videos</h2>
      </div>

      <form onSubmit={handleAdd} className="mb-3 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube link to watch it here…"
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!url.trim() || addVideo.isPending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
        >
          {addVideo.isPending ? 'Adding…' : 'Add'}
        </button>
      </form>

      {error && <p className="mb-2 text-sm text-error">{error}</p>}

      {videos.length === 0 ? (
        <p className="text-sm text-muted">
          No videos yet. Paste a YouTube link above to embed and watch it here (fullscreen supported).
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {videos.map(({ resource, videoId }) => (
            <div key={resource.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <a
                  href={resource.url!}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm text-text hover:text-accent"
                  title={resource.title ?? resource.url!}
                >
                  {resource.title ?? 'YouTube video'}
                </a>
                <button
                  onClick={() => {
                    if (window.confirm('Remove this video?')) deleteResource.mutate(resource.id)
                  }}
                  className="shrink-0 rounded px-2 py-0.5 text-xs text-muted hover:bg-surface-hover hover:text-error"
                >
                  Remove
                </button>
              </div>
              <YouTubeEmbed videoId={videoId} title={resource.title ?? undefined} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
