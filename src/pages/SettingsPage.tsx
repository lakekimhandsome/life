import { ChevronRight, Monitor, Moon, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BackLink } from '../components/ui/BackLink'
import { useTheme, type ThemePreference } from '../state/ThemeContext'

const themeOptions: {
  value: ThemePreference
  label: string
  icon: typeof Monitor
}[] = [
  { value: 'system', label: '시스템', icon: Monitor },
  { value: 'light', label: '라이트', icon: Sun },
  { value: 'dark', label: '다크', icon: Moon },
]

export function SettingsPage() {
  const { preference, setPreference } = useTheme()

  return (
    <div className="module-page settings-page">
      <div className="module-header">
        <BackLink to="/" />
        <div className="module-heading">
          <h1>설정</h1>
        </div>
      </div>

      <nav className="settings-menu" aria-label="설정 메뉴">
        <section className="settings-menu-item settings-theme">
          <span className="settings-menu-copy">
            <strong>화면 모드</strong>
            <span>앱의 밝기를 선택합니다</span>
          </span>
          <div className="theme-options" role="group" aria-label="화면 모드">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                className={preference === value ? 'is-active' : undefined}
                aria-pressed={preference === value}
                onClick={() => setPreference(value)}
              >
                <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>

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
