import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { VrmsPage } from '../components/vrms/VrmsPage'
import { FormField, TextInput } from '../components/forms/FormControls'
import { useToast } from '../components/feedback/ToastProvider'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage } from '../lib/authMessages'
import { splitDisplayName } from '../lib/profileNames'

export function AccountSettingsPage() {
  const { user, updateProfile } = useAuth()
  const { notify } = useToast()
  const initialNames = useMemo(
    () => splitDisplayName(user?.name ?? '', user?.email ?? ''),
    [user?.email, user?.name],
  )
  const [firstName, setFirstName] = useState(initialNames.firstName)
  const [lastName, setLastName] = useState(initialNames.lastName)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    setFirstName(initialNames.firstName)
    setLastName(initialNames.lastName)
  }, [initialNames.firstName, initialNames.lastName, user?.id])

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError(null)

    if (!firstName.trim() || !lastName.trim()) {
      setProfileError('First name and last name are required.')
      return
    }

    setProfileSaving(true)
    try {
      await updateProfile({ firstName, lastName })
      notify('Profile updated')
    } catch (err) {
      setProfileError(getAuthErrorMessage(err, 'Profile update failed.'))
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <VrmsPage
      eyebrow="Account"
      title="Account Settings"
      description="Update your profile name. Password changes are managed by an administrator."
    >
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Profile</h2>
          </div>
          <form className="form-grid" onSubmit={handleProfileSubmit}>
            <FormField label="First name">
              <TextInput value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
            </FormField>
            <FormField label="Last name">
              <TextInput value={lastName} onChange={(event) => setLastName(event.target.value)} required />
            </FormField>
            <FormField label="Email">
              <TextInput value={user?.email ?? ''} readOnly />
            </FormField>
            <FormField label="Role">
              <TextInput value={user?.role ?? ''} readOnly />
            </FormField>
            {profileError ? <p className="form-error span-2">{profileError}</p> : null}
            <div className="span-2">
              <button type="submit" className="button primary" disabled={profileSaving}>
                {profileSaving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </VrmsPage>
  )
}
