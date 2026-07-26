import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { CreatePage } from './pages/CreatePage'
import { HomePage } from './pages/HomePage'
import { ObjectDetailPage } from './pages/ObjectDetailPage'
import { LifeProvider } from './state/LifeContext'

export default function App() {
  return (
    <LifeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="create/:type" element={<CreatePage />} />
            <Route path="object/:id" element={<ObjectDetailPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LifeProvider>
  )
}
