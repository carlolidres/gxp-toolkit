import { useState } from 'react'
import { Button, Card, Switch } from 'antd'
import { Save, Settings2 } from 'lucide-react'

import { useToast } from '../components/feedback/ToastProvider'
import { FormField, SelectInput, TextInput } from '../components/forms/FormControls'
import { useAuth } from '../hooks/useAuth'
import { VrmsPage } from '../components/vrms/VrmsPage'
import { iconSize, iconStroke } from '../theme/iconSizes'

export function SettingsPage() {
  const [compact, setCompact] = useState(false)
  const { user } = useAuth()
  const { notify } = useToast()

  return (
    <VrmsPage
      eyebrow="Template configuration"
      title="Settings"
      description="Example preferences and adapter guidance for projects built from this starter."
      actions={
        <Button
          type="primary"
          icon={<Save size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
          onClick={() => notify('Settings saved locally')}
        >
          Save settings
        </Button>
      }
    >
      <div className="settings-grid">
        <Card className="panel" title="Profile">
          <div className="form-grid">
            <FormField label="Display name">
              <TextInput defaultValue={user?.name} />
            </FormField>
            <FormField label="Email">
              <TextInput defaultValue={user?.email} />
            </FormField>
            <FormField label="Role">
              <SelectInput defaultValue={user?.role}>
                <option>Admin</option>
                <option>Manager</option>
                <option>Editor</option>
                <option>Viewer</option>
              </SelectInput>
            </FormField>
            <FormField label="Timezone">
              <SelectInput>
                <option>Asia/Taipei</option>
                <option>UTC</option>
                <option>America/New_York</option>
              </SelectInput>
            </FormField>
          </div>
        </Card>

        <Card
          className="panel"
          title={
            <span className="inline-flex items-center gap-2">
              <Settings2 size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
              Interface
            </span>
          }
        >
          <label className="setting-row">
            <div>
              <strong>Compact tables</strong>
              <p>Reduce row height for dense operational data.</p>
            </div>
            <Switch checked={compact} onChange={setCompact} />
          </label>
          <label className="setting-row">
            <div>
              <strong>Email notifications</strong>
              <p>Example preference for a future notification adapter.</p>
            </div>
            <Switch defaultChecked />
          </label>
          <label className="setting-row">
            <div>
              <strong>Statistical alert digest</strong>
              <p>Summarize CPV signals once per day.</p>
            </div>
            <Switch defaultChecked />
          </label>
        </Card>

        <Card className="panel span-2" title="Backend adapter checklist">
          <div className="adapter-grid">
            {[
              ['Supabase', 'Replace mock services with typed Supabase repositories and enforce RLS.'],
              ['REST API', 'Implement the existing service interfaces with fetch and schema validation.'],
              ['Local JSON', 'Import fixtures into data modules or serve JSON from the public folder.'],
              ['E-signature provider', 'Map request, recipient, webhook, certificate, and download endpoints.'],
            ].map(([title, text]) => (
              <article key={title}>
                <span>→</span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </Card>
      </div>
    </VrmsPage>
  )
}
