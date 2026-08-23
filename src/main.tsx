import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from '@/App'
import { initTheme } from '@/lib/theme'
// Self-hosted so there's no third-party font request at runtime. Variable fonts:
// one file each covers every weight the UI uses.
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import '@/styles/globals.css'
import { registerSW } from 'virtual:pwa-register'

initTheme()
registerSW({ immediate: true })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
