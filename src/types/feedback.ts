export type FeedbackCategory = 'improvement' | 'bug'

export type FeedbackStatus = 'unread' | 'read' | 'addressed' | 'rejected'

export interface FeedbackMessage {
  id: string
  senderId: string
  senderName: string
  senderEmail: string
  category: FeedbackCategory
  content: string
  status: FeedbackStatus
  submittedAt: string
  statusUpdatedById?: string
  statusUpdatedByName?: string
  statusUpdatedAt?: string
}

export interface SubmitFeedbackInput {
  category: FeedbackCategory
  content: string
}

export interface UpdateFeedbackStatusInput {
  status: 'addressed' | 'rejected'
}
