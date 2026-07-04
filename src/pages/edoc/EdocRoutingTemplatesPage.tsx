import { EdocEmpty, EdocPage } from '../../components/edoc/EdocComponents'

export function EdocRoutingTemplatesPage() {
  return (
    <EdocPage title="Routing Templates" description="Reusable controlled routes for document owners and administrators.">
      <EdocEmpty
        title="Template management is schema-ready"
        description="The eDoc database migration adds routing template tables. UI write operations are deferred until admin authorization rules are configured in Supabase."
      />
    </EdocPage>
  )
}

