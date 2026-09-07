import { ChevronRight, Monitor, Moon, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProfilePhotoSection } from '../components/profile/ProfilePhotoSection'
import { BackLink } from '../components/ui/BackLink'
import { useLocale, type LocalePreference } from '../state/LocaleContext'
import { useTheme } from '../state/ThemeContext'

export function SettingsPage() {
  const { preference, setPreference } = useTheme()
  const { preference: localePreference, setPreference: setLocalePreference, t } =
    useLocale()
  const themeOptions = [
    { value: 'system' as const, label: t('settings.theme.system'), icon: Monitor },
    { value: 'light' as const, label: t('settings.theme.light'), icon: Sun },
    { value: 'dark' as const, label: t('settings.theme.dark'), icon: Moon },
  ]
  const languageOptions: { value: LocalePreference; label: string }[] = [
    { value: 'system', label: t('settings.language.system') },
    { value: 'ko', label: t('settings.language.ko') },
    { value: 'en', label: t('settings.language.en') },
  ]

  return (
    <div className="module-page settings-page">
      <div className="module-header">
        <BackLink to="/" />
        <div className="module-heading">
          <h1>{t('settings.title')}</h1>
        </div>
      </div>

      <ProfilePhotoSection />

      <nav className="settings-menu" aria-label={t('settings.menu')}>
        <section className="settings-menu-item settings-theme">
          <span className="settings-menu-copy">
            <strong>{t('settings.theme')}</strong>
            <span>{t('settings.themeHint')}</span>
          </span>
          <div className="theme-options" role="group" aria-label={t('settings.theme')}>
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

        <section className="settings-menu-item settings-theme">
          <span className="settings-menu-copy">
            <strong>{t('settings.language')}</strong>
            <span>{t('settings.languageHint')}</span>
          </span>
          <div className="theme-options" role="group" aria-label={t('settings.language')}>
            {languageOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={localePreference === value ? 'is-active' : undefined}
                aria-pressed={localePreference === value}
                onClick={() => setLocalePreference(value)}
              >
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>

        <Link to="/settings/cards" className="settings-menu-item">
          <span className="settings-menu-copy">
            <strong>{t('settings.cards')}</strong>
            <span>{t('settings.cardsHint')}</span>
          </span>
          <ChevronRight
            className="settings-menu-chevron"
            size={18}
            strokeWidth={2}
            aria-hidden="true"
          />
        </Link>
      </nav>

      <footer className="settings-commit" title={`Commit ${__COMMIT_HASH__}`}>
        {__COMMIT_HASH__}
      </footer>
    </div>
  )
}
