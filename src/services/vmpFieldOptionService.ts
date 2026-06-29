import { mockVmpFieldOptionService } from './mockVmpFieldOptionService'

export type { VmpFieldOptionRepository } from './mockVmpFieldOptionService'
export { mockVmpFieldOptionService, resetMockVmpFieldOptionStore } from './mockVmpFieldOptionService'

export function getVmpFieldOptionService() {
  return mockVmpFieldOptionService
}
