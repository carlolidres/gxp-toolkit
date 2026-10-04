import { createContext, useContext } from 'react'
import { useOutletContext } from 'react-router-dom'

import type { CpvProduct } from '../../features/cpv/types'

export const CpvWorkspaceProductContext = createContext<CpvProduct | null>(null)

export function useCpvProductRecord(): CpvProduct {
  const provided = useContext(CpvWorkspaceProductContext)
  const outlet = useOutletContext<{ product?: CpvProduct } | null>()
  const product = provided ?? outlet?.product ?? null
  if (!product) throw new Error('Open this screen from a CPV product.')
  return product
}
