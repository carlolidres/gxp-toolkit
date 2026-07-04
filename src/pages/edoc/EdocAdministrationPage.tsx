import { EdocPage } from '../../components/edoc/EdocComponents'

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
      <section className="panel">
        <div className="adapter-grid">
          {adminAreas.map((area) => (
            <article key={area}>
              <span>→</span>
              <div>
                <strong>{area}</strong>
                <p>Protected configuration area. Writes must use RLS/RPC or Edge Functions.</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </EdocPage>
  )
}

