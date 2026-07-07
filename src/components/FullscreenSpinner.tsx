export function FullscreenSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg">
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        className="animate-spin text-accent"
        aria-hidden="true"
      >
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="80"
          strokeDashoffset="60"
          opacity="0.9"
        />
      </svg>
      {label && <p className="text-sm text-muted">{label}</p>}
    </div>
  )
}
