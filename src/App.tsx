import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AssetsPage } from './pages/AssetsPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { CreatePage } from './pages/CreatePage'
import { EditPage } from './pages/EditPage'
import { HomePage } from './pages/HomePage'
import { ModulePage } from './pages/ModulePage'
import { ObjectDetailPage } from './pages/ObjectDetailPage'
import { StudyPage } from './pages/StudyPage'
import { AuthProvider } from './state/AuthContext'
import { LifeProvider } from './state/LifeContext'

export default function App() {
  return (
    <AuthProvider>
      <LifeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="auth/callback" element={<AuthCallbackPage />} />
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="study" element={<StudyPage />} />
              <Route path="workout" element={<ModulePage />} />
              <Route path="journal" element={<ModulePage />} />
              <Route path="goals" element={<ModulePage />} />
              <Route path="projects" element={<ModulePage />} />
              <Route path="assets" element={<AssetsPage />} />
              <Route path="create/:type" element={<CreatePage />} />
              <Route path="object/:id/edit" element={<EditPage />} />
              <Route path="object/:id" element={<ObjectDetailPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LifeProvider>
    </AuthProvider>
  )
}
