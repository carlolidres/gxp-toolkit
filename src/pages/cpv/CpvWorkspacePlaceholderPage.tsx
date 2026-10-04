import { Card } from 'antd'
import { useOutletContext } from 'react-router-dom'

import { CpvEmpty } from '../../components/cpv/CpvComponents'
import type { CpvProduct } from '../../features/cpv/types'

const COPY: Record<string, { title: string; hint: string }> = {
  'raw-materials': {
    title: 'Raw Materials',
    hint: 'This spreadsheet will use Product Batches as rows. Add batches first; do not create a second batch register here.',
  },
  'packaging-materials': {
    title: 'Packaging Materials',
    hint: 'Packaging material usage will hang off batch plus packaging order children.',
  },
  equipment: {
    title: 'Equipment / Rooms / Lines',
    hint: 'Manufacturing and Packaging tabs will evaluate qualification as of the date of use.',
  },
  ipc: {
    title: 'In-Process Controls',
    hint: 'Bulk and Finished Product IPC results will reference the shared batch ID.',
  },
  analytical: {
    title: 'Analytical Reports',
    hint: 'Analytical results will reference the shared batch ID. Official OOS/OOT will require an investigation link.',
  },
  stability: {
    title: 'Stability',
    hint: 'Stability studies are created independently and may optionally link a product batch.',
  },
  'hold-time': {
    title: 'Hold-Time Monitoring',
    hint: 'Hold-time records are created independently. Requirements will need a study or SOP reference.',
  },
  cnf: {
    title: 'Change Notification Forms',
    hint: 'Independent Change Notification Form records can later link affected batches.',
  },
  complaints: {
    title: 'Product Complaints',
    hint: 'Independent complaint records can later link affected batches.',
  },
  deviations: {
    title: 'Deviation Reports',
    hint: 'Independent Deviation Report records can later link affected batches.',
  },
  improvements: {
    title: 'Process Improvement Monitoring',
    hint: 'Endorsement reports will hold multiple recommendations in a later phase.',
  },
}

export function CpvWorkspacePlaceholderPage({ section }: { section: keyof typeof COPY }) {
  const { product } = useOutletContext<{ product: CpvProduct }>()
  const copy = COPY[section]
  return (
    <Card className="panel" title={copy.title}>
      <CpvEmpty title={`${copy.title} is scheduled for a later CPV phase`} hint={`${copy.hint} Product ${product.product_code} is ready to receive linked records.`} />
    </Card>
  )
}
