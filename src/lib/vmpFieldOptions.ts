import {
  cleaningValidationGroupOptions,
  computerizedSystemsDepartmentOptions,
  equipmentDepartmentOptions,
  equipmentGroupRules,
  equipmentThermalMappingGroups,
  equipmentThermalMappingSections,
  facilitiesSubCategoryOptions,
  facilityDepartmentRules,
  groupOptionsByArea,
  legacyEquipmentGroupByDepartment,
  plantQualificationDepartmentOptions,
  plantQualificationGroupOptions,
} from '../data/vmpFieldOptionDefaults'
import {
  mergeVmpOptions,
  normalizeEquipmentDepartment,
  getControlledSelectValue,
  type ValidationArea,
} from './vmpMasterlist'
import { VMP_OTHER_OPTION } from '../data/vmpFieldOptionDefaults'

export type VmpFieldType = 'site_plant' | 'group' | 'department' | 'room_line'

export interface VmpFieldOption {
  id: string
  fieldType: VmpFieldType
  validationArea: string | null
  siteId: string | null
  departmentId: string | null
  parentOptionId: string | null
  displayValue: string
  normalizedValue: string
  displayOrder: number
  isSystemDefault: boolean
  isUserDefined: boolean
  isActive: boolean
  createdAt: string
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface VmpCascadeContext {
  validationArea: ValidationArea
  sitePlant: string
  department: string
  group: string
}

export interface VmpResolvedField {
  options: readonly string[]
  label: string
  useDropdown: boolean
  searchable: boolean
  visible: boolean
}

const SEARCHABLE_THRESHOLD = 8

export function normalizeVmpValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s/]/g, '')
}

export function normalizeSiteId(sitePlant: string): string | null {
  const normalized = normalizeVmpValue(sitePlant)
  if (normalized === 'plant 1') return 'plant_1'
  if (normalized === 'plant 2') return 'plant_2'
  return normalized ? normalized.replace(/\s+/g, '_') : null
}

export function valuesMatch(a: string, b: string): boolean {
  return normalizeVmpValue(a) === normalizeVmpValue(b)
}

function findFacilityDepartmentRule(sitePlant: string, group: string) {
  return facilityDepartmentRules.find(
    (rule) =>
      rule.sites.some((site) => valuesMatch(site, sitePlant)) &&
      rule.groups.some((item) => valuesMatch(item, group)),
  )
}

function findEquipmentGroupRule(department: string) {
  const key = normalizeEquipmentDepartment(department)
  return equipmentGroupRules.find((rule) =>
    rule.departments.some((item) => valuesMatch(normalizeEquipmentDepartment(item), key)),
  )
}

function isEquipmentThermalMapping(department: string): boolean {
  return valuesMatch(department, 'Equipment Thermal Mapping')
}

export function isQcPlantDepartment(department: string): boolean {
  return valuesMatch(department, 'QC Plant 1') || valuesMatch(department, 'QC Plant 2')
}

export function isDepartmentFieldVisible(ctx: VmpCascadeContext): boolean {
  return ctx.validationArea !== 'Utilities'
}

export function isQcInstrumentSectionVisible(ctx: VmpCascadeContext): boolean {
  return ctx.validationArea === 'Computerized Systems' && isQcPlantDepartment(ctx.department)
}

export function otherSpecifyLabel(fieldLabel: string): string {
  if (fieldLabel.includes('Department') || fieldLabel.includes('Facility')) {
    return 'Specify Other Department / Facility'
  }
  if (fieldLabel.includes('Group') || fieldLabel.includes('Subcategory')) {
    return 'Specify Other Group / Subcategory'
  }
  if (fieldLabel.includes('Section')) {
    return 'Specify Other Section'
  }
  return 'Specify Other'
}

function filterUserOptions(
  allOptions: readonly VmpFieldOption[],
  fieldType: VmpFieldType,
  ctx: VmpCascadeContext,
): string[] {
  const siteId = normalizeSiteId(ctx.sitePlant)
  const deptId = ctx.department ? normalizeVmpValue(normalizeEquipmentDepartment(ctx.department)) : null
  const groupId = ctx.group ? normalizeVmpValue(ctx.group) : null

  return allOptions
    .filter((option) => {
      if (!option.isActive || option.fieldType !== fieldType) return false
      if (option.validationArea && option.validationArea !== ctx.validationArea) return false
      if (option.siteId && option.siteId !== siteId) return false
      if (option.departmentId && deptId && option.departmentId !== deptId) return false
      if (option.parentOptionId && groupId && option.parentOptionId !== groupId) return false
      return true
    })
    .sort((a, b) => a.displayOrder - b.displayOrder || a.displayValue.localeCompare(b.displayValue))
    .map((option) => option.displayValue)
}

function withOthers(values: readonly string[]): string[] {
  return mergeVmpOptions(values, values.includes(VMP_OTHER_OPTION) ? [] : [VMP_OTHER_OPTION])
}

export function resolveGroupField(
  ctx: VmpCascadeContext,
  userOptions: readonly VmpFieldOption[] = [],
): VmpResolvedField {
  if (ctx.validationArea === 'Facilities') {
    const options = withOthers([
      ...facilitiesSubCategoryOptions,
      ...filterUserOptions(userOptions, 'group', ctx),
    ])
    return {
      options,
      label: 'Group / Subcategory',
      useDropdown: true,
      searchable: options.length >= SEARCHABLE_THRESHOLD,
      visible: true,
    }
  }

  if (ctx.validationArea === 'Equipment') {
    if (isEquipmentThermalMapping(ctx.department)) {
      const options = withOthers([
        ...equipmentThermalMappingGroups,
        ...filterUserOptions(userOptions, 'group', ctx),
      ])
      return {
        options,
        label: 'Group / Subcategory',
        useDropdown: true,
        searchable: options.length >= SEARCHABLE_THRESHOLD,
        visible: true,
      }
    }
    const rule = findEquipmentGroupRule(ctx.department)
    const legacy = legacyEquipmentGroupByDepartment[normalizeEquipmentDepartment(ctx.department)]
    const base = rule?.groups ?? legacy ?? []
    const options = withOthers([...base, ...filterUserOptions(userOptions, 'group', ctx)])
    return {
      options,
      label: 'Group / Subcategory',
      useDropdown: options.length > 0,
      searchable: options.length >= SEARCHABLE_THRESHOLD,
      visible: true,
    }
  }

  if (ctx.validationArea === 'Cleaning Validation') {
    const options = withOthers([
      ...cleaningValidationGroupOptions,
      ...filterUserOptions(userOptions, 'group', ctx),
    ])
    return {
      options,
      label: 'Group / Subcategory',
      useDropdown: true,
      searchable: options.length >= SEARCHABLE_THRESHOLD,
      visible: true,
    }
  }

  if (ctx.validationArea === 'Plant Qualification') {
    const options = withOthers([
      ...plantQualificationGroupOptions,
      ...filterUserOptions(userOptions, 'group', ctx),
    ])
    return {
      options,
      label: 'Group / Subcategory',
      useDropdown: true,
      searchable: options.length >= SEARCHABLE_THRESHOLD,
      visible: true,
    }
  }

  if (ctx.validationArea === 'Computerized Systems') {
    return {
      options: [],
      label: 'Group / Subcategory',
      useDropdown: false,
      searchable: false,
      visible: false,
    }
  }

  const fallback = groupOptionsByArea[ctx.validationArea] ?? []
  const options = withOthers([...fallback, ...filterUserOptions(userOptions, 'group', ctx)])
  return {
    options,
    label: 'Group / Subcategory',
    useDropdown: options.length > 0,
    searchable: options.length >= SEARCHABLE_THRESHOLD,
    visible: options.length > 0,
  }
}

export function resolveDepartmentField(
  ctx: VmpCascadeContext,
  registryDepartments: readonly string[],
  userOptions: readonly VmpFieldOption[] = [],
): VmpResolvedField {
  if (!isDepartmentFieldVisible(ctx)) {
    return {
      options: [],
      label: 'Department / Facility',
      useDropdown: false,
      searchable: false,
      visible: false,
    }
  }

  if (ctx.validationArea === 'Computerized Systems') {
    const options = withOthers([
      ...computerizedSystemsDepartmentOptions,
      ...filterUserOptions(userOptions, 'department', ctx),
    ])
    return {
      options,
      label: 'Department / Facility',
      useDropdown: true,
      searchable: options.length >= SEARCHABLE_THRESHOLD,
      visible: true,
    }
  }

  if (ctx.validationArea === 'Plant Qualification') {
    const options = withOthers([
      ...plantQualificationDepartmentOptions,
      ...filterUserOptions(userOptions, 'department', ctx),
    ])
    return {
      options,
      label: 'Department / Facility',
      useDropdown: true,
      searchable: options.length >= SEARCHABLE_THRESHOLD,
      visible: true,
    }
  }

  if (ctx.validationArea === 'Facilities') {
    const rule = findFacilityDepartmentRule(ctx.sitePlant, ctx.group)
    const base = rule?.departments ?? registryDepartments
    const options = withOthers([...base, ...filterUserOptions(userOptions, 'department', ctx)])
    return {
      options,
      label: 'Department / Facility',
      useDropdown: true,
      searchable: options.length >= SEARCHABLE_THRESHOLD,
      visible: true,
    }
  }

  if (ctx.validationArea === 'Equipment') {
    const options = withOthers([
      ...equipmentDepartmentOptions,
      ...filterUserOptions(userOptions, 'department', ctx),
    ])
    return {
      options,
      label: 'Department / Facility',
      useDropdown: true,
      searchable: options.length >= SEARCHABLE_THRESHOLD,
      visible: true,
    }
  }

  const options = withOthers([...registryDepartments, ...filterUserOptions(userOptions, 'department', ctx)])
  return {
    options,
    label: 'Department / Facility',
    useDropdown: true,
    searchable: options.length >= SEARCHABLE_THRESHOLD,
    visible: true,
  }
}

export function resolveRoomLineField(
  ctx: VmpCascadeContext,
  userOptions: readonly VmpFieldOption[] = [],
): VmpResolvedField {
  if (ctx.validationArea === 'Equipment' && isEquipmentThermalMapping(ctx.department)) {
    const options = withOthers([
      ...equipmentThermalMappingSections,
      ...filterUserOptions(userOptions, 'room_line', ctx),
    ])
    return {
      options,
      label: 'Section',
      useDropdown: true,
      searchable: options.length >= SEARCHABLE_THRESHOLD,
      visible: true,
    }
  }

  const userRoom = filterUserOptions(userOptions, 'room_line', ctx)
  return {
    options: userRoom.length ? withOthers(userRoom) : [],
    label: 'Room / Line',
    useDropdown: userRoom.length > 0,
    searchable: userRoom.length >= SEARCHABLE_THRESHOLD,
    visible: true,
  }
}

export function isValueValidForOptions(value: string, options: readonly string[]): boolean {
  if (!value.trim()) return false
  if (valuesMatch(value, VMP_OTHER_OPTION)) return options.includes(VMP_OTHER_OPTION)
  return options.some((option) => option !== VMP_OTHER_OPTION && valuesMatch(option, value))
}

function shouldRetainCustomValue(value: string, options: readonly string[]): boolean {
  if (!value.trim() || valuesMatch(value, VMP_OTHER_OPTION)) return false
  return getControlledSelectValue(value, options) === VMP_OTHER_OPTION
}

export function findDuplicateOption(value: string, options: readonly string[]): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = options.find((option) => option !== VMP_OTHER_OPTION && valuesMatch(option, trimmed))
  return match ?? null
}

export interface CreateUserOptionInput {
  fieldType: VmpFieldType
  context: VmpCascadeContext
  displayValue: string
  actor: string
}

export function buildUserFieldOption(input: CreateUserOptionInput, existing: readonly VmpFieldOption[]): VmpFieldOption {
  const trimmed = input.displayValue.trim()
  const duplicate = findDuplicateOption(trimmed, existing.map((row) => row.displayValue))
  if (duplicate) {
    throw new Error('This option already exists. Select it from the dropdown instead.')
  }

  const now = new Date().toISOString()
  const normalized = normalizeVmpValue(trimmed)
  const siteId = normalizeSiteId(input.context.sitePlant)
  const departmentId = input.context.department
    ? normalizeVmpValue(normalizeEquipmentDepartment(input.context.department))
    : null
  const parentOptionId = input.context.group ? normalizeVmpValue(input.context.group) : null

  return {
    id: crypto.randomUUID(),
    fieldType: input.fieldType,
    validationArea: input.context.validationArea,
    siteId,
    departmentId,
    parentOptionId,
    displayValue: trimmed,
    normalizedValue: normalized,
    displayOrder: existing.filter((row) => row.fieldType === input.fieldType).length + 1,
    isSystemDefault: false,
    isUserDefined: true,
    isActive: true,
    createdAt: now,
    createdBy: input.actor,
    updatedAt: now,
    updatedBy: input.actor,
  }
}

export function applyCascadeOnChange<K extends keyof (VmpCascadeContext & { roomLine: string })>(
  current: VmpCascadeContext & { roomLine: string },
  key: K,
  value: (VmpCascadeContext & { roomLine: string })[K],
  registryDepartments: readonly string[],
  userOptions: readonly VmpFieldOption[],
): typeof current {
  const next = { ...current, [key]: value }

  if (key === 'roomLine') {
    return next
  }

  if (key === 'validationArea' && value === 'Utilities') {
    next.department = ''
  }

  if (key === 'validationArea' && value === 'Computerized Systems') {
    next.group = ''
  }

  if (key === 'department') {
    const wasThermal =
      current.validationArea === 'Equipment' && valuesMatch(current.department, 'Equipment Thermal Mapping')
    const isThermal =
      next.validationArea === 'Equipment' && valuesMatch(next.department, 'Equipment Thermal Mapping')
    if (wasThermal && !isThermal) {
      next.roomLine = ''
    }
  }

  const departmentField = resolveDepartmentField(next, registryDepartments, userOptions)
  const groupField = resolveGroupField(next, userOptions)
  const roomField = resolveRoomLineField(next, userOptions)

  if (
    key !== 'department' &&
    next.department &&
    !isValueValidForOptions(next.department, departmentField.options)
  ) {
    next.department = ''
  }
  if (key !== 'group' && next.group && !isValueValidForOptions(next.group, groupField.options)) {
    next.group = ''
  }
  if (
    key !== 'roomLine' &&
    next.roomLine &&
    roomField.useDropdown &&
    !isValueValidForOptions(next.roomLine, roomField.options)
  ) {
    next.roomLine = ''
  }

  return next
}

export function validateCascadeFields(
  record: VmpCascadeContext & { roomLine: string },
  registryDepartments: readonly string[],
  userOptions: readonly VmpFieldOption[],
): string | null {
  const departmentField = resolveDepartmentField(record, registryDepartments, userOptions)
  const groupField = resolveGroupField(record, userOptions)
  const roomField = resolveRoomLineField(record, userOptions)

  if (departmentField.visible) {
    if (!record.department.trim()) {
      return 'Department / Facility is required.'
    }
    if (valuesMatch(record.department, VMP_OTHER_OPTION)) {
      return 'Specify the Department / Facility when selecting Others.'
    }
    if (
      !isValueValidForOptions(record.department, departmentField.options) &&
      !shouldRetainCustomValue(record.department, departmentField.options)
    ) {
      return 'Department / Facility is not valid for the current selection.'
    }
  }

  if (groupField.visible) {
    if (record.validationArea === 'Facilities' && !record.group.trim()) {
      return 'Group / Subcategory is required when Validation Area is Facilities.'
    }
    if (record.validationArea === 'Equipment' && groupField.useDropdown && groupField.options.length > 0 && !record.group.trim()) {
      return 'Please specify the equipment group before saving the record.'
    }
    if (record.group && valuesMatch(record.group, VMP_OTHER_OPTION)) {
      return 'Please specify the equipment group before saving the record.'
    }
    if (
      record.group &&
      groupField.useDropdown &&
      !isValueValidForOptions(record.group, groupField.options) &&
      !shouldRetainCustomValue(record.group, groupField.options)
    ) {
      return 'Group / Subcategory is not valid for the current selection.'
    }
  }

  if (roomField.useDropdown) {
    if (!record.roomLine.trim()) {
      return `Please specify the ${roomField.label.toLowerCase()} before saving the record.`
    }
    if (valuesMatch(record.roomLine, VMP_OTHER_OPTION)) {
      return `Specify the ${roomField.label} when selecting Others.`
    }
    if (
      !isValueValidForOptions(record.roomLine, roomField.options) &&
      !shouldRetainCustomValue(record.roomLine, roomField.options)
    ) {
      return `${roomField.label} is not valid for the current selection.`
    }
  }

  return null
}

export const VMP_FIELD_SEARCHABLE_THRESHOLD = SEARCHABLE_THRESHOLD
