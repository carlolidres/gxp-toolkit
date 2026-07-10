import { EdocPage } from '../../components/edoc/EdocComponents'
import { Card, Tag } from 'antd'
import { Settings2 } from 'lucide-react'

const adminAreas = [
  'Role and permission matrix',
  'Departments and business units',
  'Document types and categories',
  'Routing templates',
  'Reminder and escalation settings',
  'Signature settings',
  'Retention settings',
  'Notification settings',
  'Email templates',
  'Audit and report access',
]

export function EdocAdministrationPage() {
  return (
    <EdocPage title="Administration" description="Organization-scoped eDoc controls for administrators.">
      <Card className="panel">
        <div className="adapter-grid">
          {adminAreas.map((area) => (
            <Card key={area} size="small">
              <Settings2 size={18} aria-hidden="true" />
              <div>
                <strong>{area}</strong>
                <p>Protected configuration area. Writes must use RLS/RPC or Edge Functions.</p>
                <Tag color="gold">Authorized admins</Tag>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </EdocPage>
  )
}

