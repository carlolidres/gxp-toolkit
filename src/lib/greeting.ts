function getLocalHour(date: Date, timeZone?: string): number {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const hourPart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: zone,
  })
    .formatToParts(date)
    .find((part) => part.type === 'hour')?.value
  // ponytail: Intl may return "24" at midnight in some locales; normalize to 0–23.
  return hourPart != null ? Number(hourPart) % 24 : date.getHours()
}

export function getTimeOfDayGreeting(date = new Date(), timeZone?: string): string {
  const hour = getLocalHour(date, timeZone)
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function formatDashboardGreeting(
  displayName: string,
  date = new Date(),
  timeZone?: string,
): string {
  const name = displayName.trim() || 'there'
  return `${getTimeOfDayGreeting(date, timeZone)}, ${name}`
}
