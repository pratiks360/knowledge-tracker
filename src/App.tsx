import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth-context'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/routes/AppLayout'
import { LoginPage } from '@/routes/auth/LoginPage'
import { AuthCallback } from '@/routes/auth/AuthCallback'
import { DashboardPage } from '@/routes/DashboardPage'
import { NodePage } from '@/routes/NodePage'
import { PresentPage } from '@/routes/PresentPage'
import { SettingsPage } from '@/routes/SettingsPage'
import { NotFoundPage } from '@/routes/NotFoundPage'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Present mode is full-screen, presentation-grade — no app chrome */}
          <Route
            path="present"
            element={
              <ProtectedRoute>
                <PresentPage />
              </ProtectedRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="node/:id" element={<NodePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
