import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert, Button, Card } from 'antd'
import { Save, UserRound } from 'lucide-react'

import { VrmsPage } from '../components/vrms/VrmsPage'
import { FormField, TextInput } from '../components/forms/FormControls'
import { useToast } from '../components/feedback/ToastProvider'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage } from '../lib/authMessages'
import { splitDisplayName } from '../lib/profileNames'
import { iconSize, iconStroke } from '../theme/iconSizes'

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
        <Card
          className="panel"
          title={
            <span className="inline-flex items-center gap-2">
              <UserRound size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
              Profile
            </span>
          }
        >
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
            {profileError ? (
              <Alert className="span-2" type="error" showIcon message={profileError} />
            ) : null}
            <div className="span-2">
              <Button
                type="primary"
                htmlType="submit"
                loading={profileSaving}
                icon={!profileSaving ? <Save size={iconSize.sm} strokeWidth={iconStroke} aria-hidden /> : undefined}
              >
                {profileSaving ? 'Saving…' : 'Save profile'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </VrmsPage>
  )
}
