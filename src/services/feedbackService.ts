import { isSupabaseConfigured } from '../lib/supabase'
import { mockFeedbackService } from './mockFeedbackService'
import { supabaseFeedbackService } from './supabaseFeedbackService'
import type { AuthUser } from '../types/auth'
import type {
  FeedbackMessage,
  SubmitFeedbackInput,
  UpdateFeedbackStatusInput,
} from '../types/feedback'

export interface FeedbackService {
  listMessages(user: AuthUser, isAdmin: boolean): Promise<FeedbackMessage[]>
  submitMessage(user: AuthUser, input: SubmitFeedbackInput): Promise<FeedbackMessage>
  acknowledgeUnread(user: AuthUser): Promise<void>
  updateStatus(user: AuthUser, messageId: string, input: UpdateFeedbackStatusInput): Promise<FeedbackMessage>
}

function createFeedbackService(): FeedbackService {
  return isSupabaseConfigured() ? supabaseFeedbackService : mockFeedbackService
}

export const feedbackService: FeedbackService = createFeedbackService()

export function usesLiveFeedback(): boolean {
  return isSupabaseConfigured()
}

export { mockFeedbackService, supabaseFeedbackService }
