/** Shared sentinel for configurable dropdowns — keep free of vmpMasterlist imports to avoid cycles. */
export const VMP_OTHER_OPTION = 'Others' as const

/** Single source for VMP cascading dropdown rules — not duplicated in form components. */

export const facilitiesSubCategoryOptions = [
  'Structure and Finish',
  'Construction and Layout',
  'Lighting, Electrical and Safety',
  'Area Thermal Mapping',
] as const

export const equipmentDepartmentOptions = [
  'LIQUIDS PRODUCTS MANUFACTURING',
  'LIQUIDS PRODUCTS PACKAGING',
  'DRY PRODUCTS MANUFACTURING',
  'DRY PRODUCTS PACKAGING',
  'CREAMS AND OINTMENT',
  'COSMETICS',
  'TOPICAL SOLUTION',
  'SOFTGEL',
  'STEROIDS',
  'CEPHALOSPHORIN',
  'QC Plant 1',
  'QC Plant 2',
  'Equipment Thermal Mapping',
  VMP_OTHER_OPTION,
] as const

/** Legacy equipment groups retained for departments not covered by new mappings (section F). */
export const legacyEquipmentGroupByDepartment: Record<string, readonly string[]> = {
  'LIQUIDS PRODUCTS MANUFACTURING': [
    'Steam-Jacketed Tank (SJT)',
    'Stainless Steel Mixing Tanks (SSMT) and Movable Tanks',
    'Mixers and Homogenizer',
    'Transfer Pumps',
    'Filters',
  ],
}

export interface FacilityDepartmentRule {
  id: string
  sites: readonly string[]
  groups: readonly string[]
  departments: readonly string[]
}

export const facilityDepartmentRules: FacilityDepartmentRule[] = [
  {
    id: 'fac-dept-plant1-thermal',
    sites: ['Plant 1'],
    groups: ['Area Thermal Mapping'],
    departments: [
      'Warehouse',
      'Creams and Ointments',
      'Liquid Products Manufacturing',
      'Dry Products Manufacturing',
      'Dry Products Packaging',
      'Chemical Dispensing',
      'Soft Gel',
      'Steroids',
      'Stability / Retention Room',
      'Topical Solutions',
      'Cosmetics',
      'Quality Control',
      VMP_OTHER_OPTION,
    ],
  },
  {
    id: 'fac-dept-plant2-thermal',
    sites: ['Plant 2'],
    groups: ['Area Thermal Mapping'],
    departments: ['Cephalosporin', 'Stability / Retention Room', VMP_OTHER_OPTION],
  },
  {
    id: 'fac-dept-qualification-elements',
    sites: ['Plant 1', 'Plant 2'],
    groups: [
      'Structure and Finish',
      'Construction and Layout',
      'Lighting, Electrical and Safety',
      'Lighting, Electrical, and Safety',
    ],
    departments: [
      'Warehouse',
      'Creams and Ointments',
      'Liquid Products',
      'Dry Products',
      'Chemical Dispensing',
      'Soft Gel',
      'Steroids',
      'Stability / Retention Room',
      'Topical Solutions',
      'Cosmetics',
      'Quality Control',
      VMP_OTHER_OPTION,
    ],
  },
]

export interface EquipmentGroupRule {
  id: string
  departments: readonly string[]
  groups: readonly string[]
}

export const equipmentGroupRules: EquipmentGroupRule[] = [
  {
    id: 'eq-group-liquids-packaging',
    departments: ['LIQUIDS PRODUCTS PACKAGING'],
    groups: [
      'Mixers',
      'Bottle Blowers',
      'Filling Machine',
      'Capping Machine',
      'Filling and Capping Machine',
      'Labelling Machine',
      'Cartoning Machine',
      'Printing / Coding Equipment',
      'Inspection / Vision System',
      'IPC Instrument',
      VMP_OTHER_OPTION,
    ],
  },
  {
    id: 'eq-group-dry-mfg',
    departments: ['DRY PRODUCTS MANUFACTURING'],
    groups: [
      'Drying Equipment',
      'Mixing / Blending Equipment',
      'Granulator Equipment',
      'Roll Compaction Equipment',
      'Milling / Sizing Equipment',
      'Encapsulation Machine',
      'Tablet Compression Machine',
      'Slugging Machine',
      'Coating Equipment',
      'Coating Solution Preparation Equipment',
      'IPC Instrument',
      VMP_OTHER_OPTION,
    ],
  },
  {
    id: 'eq-group-dry-packaging',
    departments: ['DRY PRODUCTS PACKAGING'],
    groups: [
      'Blister Packaging Equipment',
      'Strip Packaging Equipment',
      'Sachet / Horizontal Form-Fill-Seal Equipment',
      'Bottle / Container Filling Equipment',
      'Capping Machine',
      'IPC Instrument',
      VMP_OTHER_OPTION,
    ],
  },
  {
    id: 'eq-group-creams-cosmetics',
    departments: ['CREAMS AND OINTMENT', 'COSMETICS'],
    groups: [
      'Mixing / Homogenization Equipment',
      'Size Reduction Equipment',
      'Phase Vessels',
      'Transfer Pump Equipment',
      'Bottle / Tube Filling Equipment',
      'Sachet Filling Equipment',
      'Specialized Dosage Form Equipment',
      'Supporting Utilities',
      VMP_OTHER_OPTION,
    ],
  },
  {
    id: 'eq-group-topical',
    departments: ['TOPICAL SOLUTION'],
    groups: [
      'Bulk Manufacturing / Mixing Equipment',
      'Bulk Storage Equipment',
      'Filling / Packaging / Capping Machine',
      'Sealing Equipment',
      VMP_OTHER_OPTION,
    ],
  },
  {
    id: 'eq-group-softgel',
    departments: ['SOFTGEL'],
    groups: [VMP_OTHER_OPTION],
  },
  {
    id: 'eq-group-steroids',
    departments: ['STEROIDS'],
    groups: [
      'Mixing / Granulation',
      'Drying Equipment',
      'Milling and Sizing Equipment',
      'Blending Equipment',
      'Compression Equipment',
      'Primary Packaging Equipment',
      VMP_OTHER_OPTION,
    ],
  },
  {
    id: 'eq-group-cephalosporin',
    departments: ['CEPHALOSPHORIN'],
    groups: [
      'Mixing / Granulation',
      'Drying Equipment',
      'Milling and Sizing Equipment',
      'Blending Equipment',
      'Compression Equipment',
      'Encapsulation Equipment',
      'Coating Equipment',
      'Coating Solution Preparation Equipment',
      'Packaging — Blister / Strip / Bottle Equipment',
      VMP_OTHER_OPTION,
    ],
  },
  {
    id: 'eq-group-qc',
    departments: ['QC Plant 1', 'QC Plant 2'],
    groups: [
      'Refrigerators / Chillers / Freezers',
      'Incubation Equipment',
      'Laboratory Ovens',
      'Sterilization Equipment',
      VMP_OTHER_OPTION,
    ],
  },
]

export const equipmentThermalMappingSections = [
  'QC',
  'Retention / Stability',
  'Micro',
  VMP_OTHER_OPTION,
] as const

export const equipmentThermalMappingGroups = [
  'Refrigerators / Chillers / Freezers',
  'Incubation Equipment',
  'Laboratory Ovens',
  'Sterilization Equipment',
  VMP_OTHER_OPTION,
] as const

export const computerizedSystemsDepartmentOptions = [
  'Plant-Wide',
  'Chemical Dispensing',
  'QC Plant 1',
  'QC Plant 2',
  'Quality Assurance',
  'Warehouse',
  VMP_OTHER_OPTION,
] as const

export const plantQualificationDepartmentOptions = [
  'LIQUIDS PRODUCTS MANUFACTURING',
  'LIQUIDS PRODUCTS PACKAGING',
  'DRY PRODUCTS MANUFACTURING',
  'DRY PRODUCTS PACKAGING',
  'CREAMS AND OINTMENT',
  'COSMETICS',
  'TOPICAL SOLUTION',
  'SOFTGEL',
  'STEROIDS',
  'CEPHALOSPHORIN',
  'QC Plant 1',
  'QC Plant 2',
  VMP_OTHER_OPTION,
] as const

export const cleaningValidationGroupOptions = [
  'Equipment Train',
  'Clean Hold Time',
  'Dirty Hold Time',
  'Sanitization Study',
  'CIP Verification',
  'Trace Test',
  'Cross-Contamination Study',
  VMP_OTHER_OPTION,
] as const

export const plantQualificationGroupOptions = [
  'Borescope Inspection',
  'Lux Intensity Verification',
  'Cleanroom Qualification',
  'ETB Qualification',
  'Fume Hood Qualification',
  'Laminar Flow Hood Qualification',
  VMP_OTHER_OPTION,
] as const

export const groupOptionsByArea: Partial<Record<string, readonly string[]>> = {
  Utilities: ['Purified Water System', VMP_OTHER_OPTION],
  'Computerized Systems': ['Computerized System', VMP_OTHER_OPTION],
}
