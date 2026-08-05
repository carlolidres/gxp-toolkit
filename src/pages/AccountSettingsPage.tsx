import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Alert, Button, Card } from 'antd'
import {
  Briefcase,
  Building2,
  Camera,
  ImageIcon,
  Mail,
  Save,
  Shield,
  Trash2,
  Upload as UploadIcon,
  UserRound,
} from 'lucide-react'

import { EditableCombobox } from '../components/forms/EditableCombobox'
import { VrmsPage } from '../components/vrms/VrmsPage'
import { useToast } from '../components/feedback/ToastProvider'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage } from '../lib/authMessages'
import { splitDisplayName } from '../lib/profileNames'
import {
  normalizeOrganizationValue,
  validateOrganizationValue,
} from '../lib/profileOrganization'
import {
  PROFILE_AVATAR_MAX_BYTES,
  readAvatarAsDataUrl,
  validateAvatarImage,
} from '../lib/profileAvatar'
import {
  PROFILE_SIGNATURE_MAX_BYTES,
  prepareSignaturePngDataUrl,
  validateSignaturePng,
} from '../lib/profileSignature'
import { getSignatoryProfileCompleteness } from '../lib/signatoryProfileCompleteness'
import { organizationOptionsService } from '../services/organizationOptionsService'
import { iconSize, iconStroke } from '../theme/iconSizes'
import './account-settings-page.css'

function FieldShell({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="m-0 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  )
}

const fieldInputClass =
  'min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-medium text-[var(--navy)] outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--teal)_35%,var(--border))] focus:border-[var(--teal)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--teal)_18%,transparent)] read-only:cursor-default read-only:bg-[color-mix(in_srgb,var(--surface-muted,#f4f7fa)_65%,var(--surface))] read-only:text-[var(--muted)] read-only:hover:border-[var(--border)] read-only:focus:border-[var(--border)] read-only:focus:shadow-none'

export function AccountSettingsPage() {
  const { user, updateProfile, hasRole } = useAuth()
  const { notify } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const canManageOptions = hasRole(['Admin'])
  const initialNames = useMemo(
    () => splitDisplayName(user?.name ?? '', user?.email ?? ''),
    [user?.email, user?.name],
  )
  const [firstName, setFirstName] = useState(initialNames.firstName)
  const [lastName, setLastName] = useState(initialNames.lastName)
  const [organization, setOrganization] = useState(user?.organization ?? '')
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '')
  const [organizationOptions, setOrganizationOptions] = useState<string[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [organizationError, setOrganizationError] = useState<string | null>(null)
  const [jobTitleError, setJobTitleError] = useState<string | null>(null)
  const [signaturePreview, setSignaturePreview] = useState<string | null>(user?.signatureDataUrl ?? null)
  const [signatureDirty, setSignatureDirty] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarDataUrl ?? null)
  const [avatarDirty, setAvatarDirty] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const signatoryProfile = useMemo(
    () =>
      getSignatoryProfileCompleteness({
        name: `${firstName} ${lastName}`.trim(),
        email: user?.email ?? '',
        jobTitle,
        signatureDataUrl: signaturePreview,
      }),
    [firstName, lastName, jobTitle, signaturePreview, user?.email],
  )

  useEffect(() => {
    setFirstName(initialNames.firstName)
    setLastName(initialNames.lastName)
  }, [initialNames.firstName, initialNames.lastName, user?.id])

  useEffect(() => {
    setOrganization(user?.organization ?? '')
  }, [user?.organization, user?.id])

  useEffect(() => {
    setJobTitle(user?.jobTitle ?? '')
  }, [user?.jobTitle, user?.id])

  useEffect(() => {
    if (!signatureDirty) {
      setSignaturePreview(user?.signatureDataUrl ?? null)
    }
  }, [signatureDirty, user?.signatureDataUrl, user?.id])

  useEffect(() => {
    if (!avatarDirty) {
      setAvatarPreview(user?.avatarDataUrl ?? null)
    }
  }, [avatarDirty, user?.avatarDataUrl, user?.id])

  useEffect(() => {
    let cancelled = false
    setOptionsLoading(true)
    void organizationOptionsService
      .list()
      .then((options) => {
        if (!cancelled) setOrganizationOptions(options)
      })
      .catch((err) => {
        if (!cancelled) {
          setProfileError(getAuthErrorMessage(err, 'Could not load organization options.'))
        }
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleRememberOrganization(value: string) {
    const normalized = normalizeOrganizationValue(value)
    const validationError = validateOrganizationValue(normalized)
    setOrganizationError(validationError)
    if (validationError || !normalized) return
    try {
      const options = await organizationOptionsService.remember(normalized)
      setOrganizationOptions(options)
      setOrganization(findCanonicalOrganization(normalized, options))
    } catch (err) {
      setProfileError(getAuthErrorMessage(err, 'Could not save the organization option.'))
    }
  }

  async function handleRemoveOrganizationOption(value: string) {
    if (!canManageOptions) return
    try {
      const options = await organizationOptionsService.remove(value)
      setOrganizationOptions(options)
      if (normalizeOrganizationValue(organization).toLowerCase() === normalizeOrganizationValue(value).toLowerCase()) {
        setOrganization('')
      }
      notify('Organization option removed')
    } catch (err) {
      setProfileError(getAuthErrorMessage(err, 'Could not remove the organization option.'))
    }
  }

  async function handleSignatureFile(file: File | null) {
    setProfileError(null)
    if (!file) return

    const validationError = validateSignaturePng(file)
    if (validationError) {
      setProfileError(validationError)
      return
    }

    try {
      const dataUrl = await prepareSignaturePngDataUrl(file)
      setSignaturePreview(dataUrl)
      setSignatureDirty(true)
    } catch (err) {
      setProfileError(getAuthErrorMessage(err, 'Could not read the PNG signature.'))
    }
  }

  function clearSignature() {
    setSignaturePreview(null)
    setSignatureDirty(true)
    setProfileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleAvatarFile(file: File | null) {
    setProfileError(null)
    if (!file) return

    const validationError = validateAvatarImage(file)
    if (validationError) {
      setProfileError(validationError)
      return
    }

    try {
      const dataUrl = await readAvatarAsDataUrl(file)
      setAvatarPreview(dataUrl)
      setAvatarDirty(true)
    } catch (err) {
      setProfileError(getAuthErrorMessage(err, 'Could not read the profile picture.'))
    }
  }

  function clearAvatar() {
    setAvatarPreview(null)
    setAvatarDirty(true)
    setProfileError(null)
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError(null)

    if (!firstName.trim() || !lastName.trim()) {
      setProfileError('First name and last name are required.')
      return
    }

    const organizationNormalized = normalizeOrganizationValue(organization)
    const orgValidation = validateOrganizationValue(organizationNormalized)
    if (orgValidation) {
      setOrganizationError(orgValidation)
      setProfileError(orgValidation)
      return
    }
    setOrganizationError(null)

    const jobTitleNormalized = normalizeOrganizationValue(jobTitle)
    if (jobTitleNormalized.length > 120) {
      const message = 'Position/Title must be 120 characters or fewer.'
      setJobTitleError(message)
      setProfileError(message)
      return
    }
    setJobTitleError(null)

    setProfileSaving(true)
    try {
      await updateProfile({
        firstName,
        lastName,
        jobTitle: jobTitleNormalized || null,
        organization: organizationNormalized || null,
        ...(signatureDirty ? { signatureDataUrl: signaturePreview } : {}),
        ...(avatarDirty ? { avatarDataUrl: avatarPreview } : {}),
      })
      setSignatureDirty(false)
      setAvatarDirty(false)
      setJobTitle(jobTitleNormalized)
      if (organizationNormalized) {
        const options = await organizationOptionsService.list()
        setOrganizationOptions(options)
        setOrganization(findCanonicalOrganization(organizationNormalized, options))
      } else {
        setOrganization('')
      }
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
      description="Update your profile picture, name, position, organization, and PNG signature used for eDoc signatory fields. Password changes are managed by an administrator."
    >
      <div className="account-settings-page settings-grid max-w-3xl">
        <Card
          className="panel overflow-hidden"
          title={
            <span className="inline-flex items-center gap-2 text-[var(--navy)]">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--teal)_12%,var(--surface))] text-[var(--teal)]">
                <UserRound size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
              </span>
              Profile
            </span>
          }
        >
          <form className="flex flex-col gap-5" onSubmit={handleProfileSubmit} noValidate>
            <section
              className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-muted,#f4f7fa)_45%,var(--surface))] p-4 sm:flex-row sm:items-center"
              aria-labelledby="account-avatar-heading"
            >
              <div
                className={`profile-avatar-preview${avatarPreview ? '' : ' is-empty'}`}
                aria-live="polite"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile picture preview" />
                ) : (
                  <span className="profile-avatar-initials" aria-hidden>
                    {user?.initials ?? '—'}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="account-avatar-heading"
                  className="m-0 inline-flex items-center gap-2 text-sm font-semibold text-[var(--navy)]"
                >
                  <Camera size={iconSize.sm} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />
                  Profile picture
                </h3>
                <p className="mt-1 mb-3 text-xs leading-relaxed text-[var(--muted)]">
                  Shown in the top bar and sidebar. JPG, PNG, or WebP · max{' '}
                  {Math.round(PROFILE_AVATAR_MAX_BYTES / 1024)} KB
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    className="sr-only"
                    aria-label="Upload profile picture"
                    onChange={(event) => {
                      void handleAvatarFile(event.target.files?.[0] ?? null)
                    }}
                  />
                  <Button
                    type="default"
                    icon={<UploadIcon size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    Upload photo
                  </Button>
                  {avatarPreview ? (
                    <Button
                      type="default"
                      danger
                      icon={<Trash2 size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                      onClick={clearAvatar}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>

            {signatoryProfile.complete ? (
              <Alert
                type="success"
                showIcon
                message="Ready for eDoc signatory fields"
                description="First name, last name, position/title, and saved signature will fill Name, Position/Title, and Signature fields when you sign."
              />
            ) : (
              <Alert
                type="warning"
                showIcon
                message="Complete your signatory profile"
                description={`eDoc Name, Position/Title, and Signature fields use your profile. Still needed: ${signatoryProfile.missingLabels.join(', ')}.`}
              />
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldShell label="First name" htmlFor="account-first-name">
                <input
                  id="account-first-name"
                  className={fieldInputClass}
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  autoComplete="given-name"
                  required
                />
              </FieldShell>
              <FieldShell label="Last name" htmlFor="account-last-name">
                <input
                  id="account-last-name"
                  className={fieldInputClass}
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  autoComplete="family-name"
                  required
                />
              </FieldShell>

              <FieldShell label="Email" htmlFor="account-email" hint="Managed by your sign-in account">
                <div className="relative">
                  <Mail
                    size={iconSize.xs}
                    strokeWidth={iconStroke}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]"
                    aria-hidden
                  />
                  <input
                    id="account-email"
                    className={`${fieldInputClass} pl-9`}
                    value={user?.email ?? ''}
                    readOnly
                  />
                </div>
              </FieldShell>

              <FieldShell label="Role" htmlFor="account-role" hint="Assigned by an administrator">
                <div className="relative">
                  <Shield
                    size={iconSize.xs}
                    strokeWidth={iconStroke}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]"
                    aria-hidden
                  />
                  <input
                    id="account-role"
                    className={`${fieldInputClass} pl-9`}
                    value={user?.role ?? ''}
                    readOnly
                  />
                </div>
              </FieldShell>

              <div className="sm:col-span-2">
                <FieldShell label="Position/Title" htmlFor="account-job-title">
                  <div className="relative">
                    <Briefcase
                      size={iconSize.xs}
                      strokeWidth={iconStroke}
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]"
                      aria-hidden
                    />
                    <input
                      id="account-job-title"
                      className={`${fieldInputClass} pl-9${jobTitleError ? ' border-[color-mix(in_srgb,var(--danger)_55%,var(--border))]' : ''}`}
                      value={jobTitle}
                      onChange={(event) => {
                        const next = event.target.value
                        setJobTitle(next)
                        const normalized = normalizeOrganizationValue(next)
                        setJobTitleError(
                          normalized.length > 120
                            ? 'Position/Title must be 120 characters or fewer.'
                            : null,
                        )
                      }}
                      autoComplete="organization-title"
                      placeholder="e.g. QA Manager"
                      aria-invalid={Boolean(jobTitleError)}
                      aria-describedby={jobTitleError ? 'account-job-title-error' : undefined}
                    />
                  </div>
                  {jobTitleError ? (
                    <p id="account-job-title-error" className="m-0 text-xs text-[var(--danger)]" role="alert">
                      {jobTitleError}
                    </p>
                  ) : null}
                </FieldShell>
              </div>

              <div className="sm:col-span-2">
                <EditableCombobox
                  id="account-organization"
                  label="Organization"
                  value={organization}
                  options={organizationOptions}
                  loading={optionsLoading}
                  canRemoveOptions={canManageOptions}
                  leadingIcon={Building2}
                  placeholder="Search or type an organization…"
                  hint={
                    canManageOptions
                      ? 'Saved options are shared. Admins can remove outdated entries.'
                      : 'Type to search saved options or add a new organization.'
                  }
                  error={organizationError}
                  onChange={(next) => {
                    setOrganization(next)
                    setOrganizationError(validateOrganizationValue(next))
                  }}
                  onCommit={(next) => {
                    void handleRememberOrganization(next)
                  }}
                  onRemoveOption={(next) => {
                    void handleRemoveOrganizationOption(next)
                  }}
                />
              </div>
            </div>

            <section
              className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-muted,#f4f7fa)_45%,var(--surface))] p-4"
              aria-labelledby="account-signature-heading"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3
                    id="account-signature-heading"
                    className="m-0 inline-flex items-center gap-2 text-sm font-semibold text-[var(--navy)]"
                  >
                    <ImageIcon size={iconSize.sm} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />
                    Signature (PNG)
                  </h3>
                  <p className="mt-1 mb-0 text-xs text-[var(--muted)]">
                    PNG only · white/paper backgrounds are removed on upload · max{' '}
                    {Math.round(PROFILE_SIGNATURE_MAX_BYTES / 1024)} KB
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,.png"
                    className="sr-only"
                    aria-label="Upload signature PNG"
                    onChange={(event) => {
                      void handleSignatureFile(event.target.files?.[0] ?? null)
                    }}
                  />
                  <Button
                    type="default"
                    icon={<UploadIcon size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload PNG
                  </Button>
                  {signaturePreview ? (
                    <Button
                      type="default"
                      danger
                      icon={<Trash2 size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                      onClick={clearSignature}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
              <div
                className={`profile-signature-preview${signaturePreview ? '' : ' is-empty'}`}
                aria-live="polite"
              >
                {signaturePreview ? (
                  <img src={signaturePreview} alt="Uploaded signature preview" />
                ) : (
                  <span className="text-xs font-medium text-[var(--muted)]">No signature uploaded</span>
                )}
              </div>
            </section>

            {profileError ? (
              <Alert type="error" showIcon message={profileError} />
            ) : null}

            <div className="border-t border-[var(--border)] pt-4">
              <div className="flex justify-end">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={profileSaving}
                  icon={!profileSaving ? <Save size={iconSize.sm} strokeWidth={iconStroke} aria-hidden /> : undefined}
                >
                  {profileSaving ? 'Saving…' : 'Save profile'}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </VrmsPage>
  )
}

function findCanonicalOrganization(value: string, options: readonly string[]): string {
  const key = normalizeOrganizationValue(value).toLowerCase()
  return options.find((option) => normalizeOrganizationValue(option).toLowerCase() === key) ?? normalizeOrganizationValue(value)
}
