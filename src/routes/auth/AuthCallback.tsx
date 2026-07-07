import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { FullscreenSpinner } from '@/components/FullscreenSpinner'

/**
 * Handles the OAuth redirect from Supabase/Google. PKCE flow: exchange the
 * `code` query param for a session explicitly, then redirect home.
 */
export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    async function handleCallback() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const errorParam = params.get('error')

      if (errorParam) {
        if (active) navigate('/login?error=auth_failed', { replace: true })
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!active) return
        if (error) {
          navigate('/login?error=auth_failed', { replace: true })
          return
        }
        navigate('/', { replace: true })
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!active) return
      navigate(session ? '/' : '/login', { replace: true })
    }

    handleCallback()
    return () => {
      active = false
    }
  }, [navigate])

  return <FullscreenSpinner label="Signing you in…" />
}
