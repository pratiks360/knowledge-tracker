import { useCallback, useRef } from 'react'

/**
 * A thin vertical drag handle for resizing a side panel.
 * `side` says which edge of the panel this handle sits on, so we know whether a
 * rightward drag should grow or shrink the panel:
 *  - side="right" (handle on the panel's right edge, e.g. left sidebar): width = base + dx
 *  - side="left"  (handle on the panel's left edge, e.g. right chat panel): width = base - dx
 */
export function ResizeHandle({
  side,
  getWidth,
  onResize,
  ariaLabel,
}: {
  side: 'left' | 'right'
  getWidth: () => number
  onResize: (width: number) => void
  ariaLabel: string
}) {
  const stateRef = useRef({ startX: 0, startW: 0 })

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      stateRef.current = { startX: e.clientX, startW: getWidth() }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [getWidth]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!(e.target as HTMLElement).hasPointerCapture?.(e.pointerId)) return
      const dx = e.clientX - stateRef.current.startX
      const next = side === 'right' ? stateRef.current.startW + dx : stateRef.current.startW - dx
      onResize(next)
    },
    [side, onResize]
  )

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="group relative z-10 w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-accent"
    >
      {/* Widen the hit area without taking layout space. */}
      <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  )
}
