import { Link } from 'react-router-dom'

export function AssetsPage() {
  return (
    <div className="module-page">
      <div className="module-header">
        <Link to="/" className="back-link">
          ← 홈
        </Link>
        <div className="module-heading">
          <span className="module-icon" aria-hidden="true">
            💰
          </span>
          <h1>자산</h1>
        </div>
      </div>

      <div className="empty-panel">
        <h3>자산 현황</h3>
        <p>아직 자산 기록이 없습니다.</p>
      </div>
    </div>
  )
}
