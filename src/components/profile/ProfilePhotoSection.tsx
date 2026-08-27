import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { assertAvatarFile, removeAvatar, uploadAvatar } from '../../lib/avatar'
import {
  customAvatarUrl,
  displayEmail,
  displayName,
  hasCustomAvatar,
  providerAvatarUrl,
  resolveAvatarUrl,
} from '../../lib/userProfile'
import { useAuth } from '../../state/AuthContext'
import { useT } from '../../state/LocaleContext'
import { Avatar } from '../ui/Avatar'
import { AvatarCropModal } from './AvatarCropModal'

export function ProfilePhotoSection() {
  const t = useT()
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [optimisticUrl, setOptimisticUrl] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const savedCustomUrl = customAvatarUrl(user)

  useEffect(() => {
    setOptimisticUrl(undefined)
  }, [savedCustomUrl])

  const name = displayName(user)
  const email = displayEmail(user)
  const avatarSrc =
    optimisticUrl === undefined
      ? resolveAvatarUrl(user)
      : optimisticUrl || providerAvatarUrl(user)
  const canRemove = optimisticUrl === undefined ? hasCustomAvatar(user) : Boolean(optimisticUrl)

  function openPicker() {
    setError(null)
    fileRef.current?.click()
  }

  function handleFileChange(file: File | undefined) {
    if (!file) return
    try {
      assertAvatarFile(file)
      setCropFile(file)
      setError(null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('avatar.inspectFailed'))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleConfirm(blob: Blob) {
    setBusy(true)
    try {
      const url = await uploadAvatar(blob)
      setOptimisticUrl(url)
      setCropFile(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setError(null)
    setBusy(true)
    try {
      await removeAvatar()
      setOptimisticUrl(null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('avatar.deleteFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings-profile">
      <button
        type="button"
        className="settings-profile-photo"
        onClick={openPicker}
        disabled={busy}
        aria-label={t('settings.photoAria')}
      >
        <Avatar src={avatarSrc} name={name} size={96} alt={t('settings.photoAlt', { name })} />
        <span className="settings-profile-badge" aria-hidden="true">
          <Camera size={15} strokeWidth={2} />
        </span>
      </button>

      <div className="settings-profile-copy">
        <strong>{name}</strong>
        {email ? <span>{email}</span> : null}
      </div>

      <div className="settings-profile-actions">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={openPicker}>
          {t('settings.photoChange')}
        </button>
        {canRemove ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={() => void handleRemove()}
          >
            {t('common.delete')}
          </button>
        ) : null}
      </div>

      {error ? <p className="settings-profile-error">{error}</p> : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
        hidden
        onChange={(event) => handleFileChange(event.target.files?.[0])}
      />

      {cropFile ? (
        <AvatarCropModal
          file={cropFile}
          busy={busy}
          onCancel={() => setCropFile(null)}
          onConfirm={handleConfirm}
        />
      ) : null}
    </section>
  )
}
