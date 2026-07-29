import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AssetHistoryPage } from './pages/AssetHistoryPage'
import { AssetsPage } from './pages/AssetsPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { CardEditPage } from './pages/CardEditPage'
import { CreatePage } from './pages/CreatePage'
import { EditPage } from './pages/EditPage'
import { HomePage } from './pages/HomePage'
import { ModulePage } from './pages/ModulePage'
import { ObjectDetailPage } from './pages/ObjectDetailPage'
import { SettingsPage } from './pages/SettingsPage'
import { StudyPage } from './pages/StudyPage'
import { AuthProvider } from './state/AuthContext'
import { LifeProvider } from './state/LifeContext'
import { PrefsProvider } from './state/PrefsContext'

export default function App() {
  return (
    <AuthProvider>
      <LifeProvider>
        <PrefsProvider>
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
                <Route path="assets/history" element={<AssetHistoryPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="settings/cards" element={<CardEditPage />} />
                <Route path="create/:type" element={<CreatePage />} />
                <Route path="object/:id/edit" element={<EditPage />} />
                <Route path="object/:id" element={<ObjectDetailPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </PrefsProvider>
      </LifeProvider>
    </AuthProvider>
  )
}
