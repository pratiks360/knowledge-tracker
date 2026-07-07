import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { FullscreenSpinner } from '@/components/FullscreenSpinner'
import { OwnerGate } from '@/components/OwnerGate'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, isOwner } = useAuth()
  const location = useLocation()

  if (loading) return <FullscreenSpinner label="Loading" />

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isOwner) return <OwnerGate />

  return <>{children}</>
}
