import { mockVmpMasterlistService } from './mockVmpMasterlistService'
import { resolveVrmsUserEmail } from './vrmsService'

export type { SaveVmpRecordPayload, VmpMasterlistRepository } from './mockVmpMasterlistService'

export function getVmpMasterlistService() {
  return mockVmpMasterlistService
}

export function resolveVmpActorEmail(): string {
  return resolveVrmsUserEmail()
}

export { mockVmpMasterlistService }
