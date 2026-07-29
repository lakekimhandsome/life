import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BackLink } from '../components/ui/BackLink'

export function SettingsPage() {
  return (
    <div className="module-page settings-page">
      <div className="module-header">
        <BackLink to="/">홈</BackLink>
        <div className="module-heading">
          <h1>설정</h1>
        </div>
      </div>

      <nav className="settings-menu" aria-label="설정 메뉴">
        <Link to="/settings/cards" className="settings-menu-item">
          <span className="settings-menu-copy">
            <strong>카드 편집</strong>
            <span>홈 화면 카드 순서·표시를 바꿉니다</span>
          </span>
          <ChevronRight
            className="settings-menu-chevron"
            size={18}
            strokeWidth={2}
            aria-hidden="true"
          />
        </Link>
      </nav>
    </div>
  )
}
