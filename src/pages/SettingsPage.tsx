import { Link } from 'react-router-dom'

export function SettingsPage() {
  return (
    <div className="module-page settings-page">
      <div className="module-header">
        <Link to="/" className="back-link">
          ← 홈
        </Link>
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
          <span className="settings-menu-chevron" aria-hidden="true">
            →
          </span>
        </Link>
      </nav>
    </div>
  )
}
