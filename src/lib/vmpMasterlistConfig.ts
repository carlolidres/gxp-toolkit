/** Configurable schedule thresholds for VMP masterlist due-date calculations. */
export const vmpMasterlistConfig = {
  dueSoonWarningDays: 90,
} as const

export type VmpMasterlistConfig = typeof vmpMasterlistConfig
