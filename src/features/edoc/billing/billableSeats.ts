/**
 * C7: billable seats are opted-in members, not every assignee inserted for RLS.
 */
export type SeatMember = {
  status: string
  countsTowardSeat: boolean | number
}

export function countsAsBillableSeat(member: SeatMember): boolean {
  if (member.status !== 'active') return false
  return member.countsTowardSeat === true || member.countsTowardSeat === 1
}

export function billableSeatCount(members: SeatMember[]): number {
  return members.filter(countsAsBillableSeat).length
}
