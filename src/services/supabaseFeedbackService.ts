import { getSupabaseClient } from '../lib/supabase'
import { requireSupabaseSession } from '../lib/supabaseAuth'
import type { AuthUser } from '../types/auth'
import type {
  FeedbackMessage,
  FeedbackStatus,
  SubmitFeedbackInput,
  UpdateFeedbackStatusInput,
} from '../types/feedback'

interface FeedbackRow {
  id: string
  sender_profile_id: string
  sender_name: string
  sender_email: string
  category: FeedbackMessage['category']
  content: string
  status: FeedbackStatus
  submitted_at: string
  status_updated_by_profile_id: string | null
  status_updated_by_name: string | null
  status_updated_at: string | null
}

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase is not configured.')
  return client
}

async function requireAuthenticatedClient() {
  return requireSupabaseSession(requireClient())
}

async function resolveProfileId(user: AuthUser): Promise<string> {
  if (user.profileId) return user.profileId

  const client = await requireAuthenticatedClient()
  const { data: profileId, error: rpcError } = await client.rpc('current_profile_id')
  if (!rpcError && profileId) return profileId as string

  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.id) throw new Error('Profile not found.')
  return data.id
}

function mapRow(row: FeedbackRow): FeedbackMessage {
  return {
    id: row.id,
    senderId: row.sender_profile_id,
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    category: row.category,
    content: row.content,
    status: row.status,
    submittedAt: row.submitted_at,
    statusUpdatedById: row.status_updated_by_profile_id ?? undefined,
    statusUpdatedByName: row.status_updated_by_name ?? undefined,
    statusUpdatedAt: row.status_updated_at ?? undefined,
  }
}

async function purgeExpired() {
  const client = await requireAuthenticatedClient()
  const { error } = await client.rpc('purge_expired_feedback_messages')
  if (error) throw new Error(error.message)
}

export const supabaseFeedbackService = {
  async listMessages(user: AuthUser, isAdmin: boolean): Promise<FeedbackMessage[]> {
    await purgeExpired()
    const client = await requireAuthenticatedClient()
    let query = client
      .from('app_feedback_messages')
      .select(
        'id, sender_profile_id, sender_name, sender_email, category, content, status, submitted_at, status_updated_by_profile_id, status_updated_by_name, status_updated_at',
      )
      .order('submitted_at', { ascending: false })

    if (!isAdmin) {
      const profileId = await resolveProfileId(user)
      query = query.eq('sender_profile_id', profileId)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data as FeedbackRow[]).map(mapRow)
  },

  async submitMessage(user: AuthUser, input: SubmitFeedbackInput): Promise<FeedbackMessage> {
    const content = input.content.trim()
    if (!content) throw new Error('Message content is required.')

    const client = await requireAuthenticatedClient()
    const profileId = await resolveProfileId(user)
    const { data, error } = await client
      .from('app_feedback_messages')
      .insert({
        sender_profile_id: profileId,
        sender_name: user.name,
        sender_email: user.email,
        category: input.category,
        content,
        status: 'unread',
      })
      .select(
        'id, sender_profile_id, sender_name, sender_email, category, content, status, submitted_at, status_updated_by_profile_id, status_updated_by_name, status_updated_at',
      )
      .single()

    if (error) throw new Error(error.message)
    return mapRow(data as FeedbackRow)
  },

  async acknowledgeUnread(user: AuthUser): Promise<void> {
    const client = await requireAuthenticatedClient()
    const profileId = await resolveProfileId(user)
    const now = new Date().toISOString()
    const { error } = await client
      .from('app_feedback_messages')
      .update({
        status: 'read',
        status_updated_by_profile_id: profileId,
        status_updated_by_name: user.name,
        status_updated_at: now,
      })
      .eq('status', 'unread')

    if (error) throw new Error(error.message)
  },

  async updateStatus(
    user: AuthUser,
    messageId: string,
    input: UpdateFeedbackStatusInput,
  ): Promise<FeedbackMessage> {
    const client = await requireAuthenticatedClient()
    const profileId = await resolveProfileId(user)
    const now = new Date().toISOString()
    const { data, error } = await client
      .from('app_feedback_messages')
      .update({
        status: input.status,
        status_updated_by_profile_id: profileId,
        status_updated_by_name: user.name,
        status_updated_at: now,
      })
      .eq('id', messageId)
      .select(
        'id, sender_profile_id, sender_name, sender_email, category, content, status, submitted_at, status_updated_by_profile_id, status_updated_by_name, status_updated_at',
      )
      .single()

    if (error) throw new Error(error.message)
    return mapRow(data as FeedbackRow)
  },
}
