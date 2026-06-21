export function statusTone(status: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  if (['Approved', 'Effective', 'Signed', 'Completed'].includes(status)) return 'success'
  if (['Rejected', 'Declined', 'Expired', 'Obsolete'].includes(status)) return 'danger'
  if (['For Review', 'For Approval', 'Pending Signature', 'Partially Signed', 'In Progress'].includes(status)) return 'warning'
  if (['Draft', 'Not Started', 'Pending'].includes(status)) return 'neutral'
  return 'info'
}

