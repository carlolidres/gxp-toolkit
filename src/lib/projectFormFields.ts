/** Adapted from reference/src/lib/projectFormFields.ts (Project Tracker). */

export type ProjectTab = 'AM/BM/PL' | 'PP' | 'TSD' | 'VAL' | 'QC'

export const PROJECT_TABS: ProjectTab[] = ['AM/BM/PL', 'PP', 'TSD', 'VAL', 'QC']

export function projectTabKey(tab: ProjectTab): string {
  if (tab === 'AM/BM/PL') return 'am'
  return tab.toLowerCase()
}

export function tabFromHash(hash: string): ProjectTab | null {
  const normalized = hash.replace('#', '')
  const map: Record<string, ProjectTab> = {
    'tab-am': 'AM/BM/PL',
    'tab-pp': 'PP',
    'tab-tsd': 'TSD',
    'tab-val': 'VAL',
    'tab-qc': 'QC',
  }
  return map[normalized] ?? null
}

export const TAB_SAMPLE_FIELDS: Record<ProjectTab, Array<{ key: string; label: string }>> = {
  'AM/BM/PL': [
    { key: 'unique_batch', label: 'Unique Batch' },
    { key: 'mo_control_no', label: 'MO Control No.' },
  ],
  PP: [
    { key: 'pp_plan_date', label: 'PP Plan Date' },
    { key: 'pp_status', label: 'PP Status' },
    { key: 'pp_remarks', label: 'PP Remarks' },
  ],
  TSD: [
    { key: 'tsd_target', label: 'TSD Target Date' },
    { key: 'tsd_owner', label: 'TSD Owner' },
  ],
  VAL: [
    { key: 'val_protocol', label: 'Validation Protocol' },
    { key: 'val_status', label: 'Validation Status' },
  ],
  QC: [
    { key: 'qc_sample_plan', label: 'QC Sample Plan' },
    { key: 'qc_release', label: 'QC Release Status' },
  ],
}
