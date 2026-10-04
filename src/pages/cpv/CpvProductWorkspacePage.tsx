import { NavLink, Outlet, useParams } from 'react-router-dom'
import { Card } from 'antd'

import { CpvError, CpvLoading, CpvPage, CpvPostureBadge, CpvStatusBadge } from '../../components/cpv/CpvComponents'
import { getCpvProduct } from '../../features/cpv/cpvService'
import { CPV_WORKSPACE_SECTIONS } from '../../features/cpv/types'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import { formatAppDate, formatAppDateTime } from '../../utils/dateUtils'

export function CpvProductWorkspacePage() {
  const { productId = '' } = useParams()
  const product = useCpvLoad(() => getCpvProduct(productId), [productId])

  if (product.loading) {
    return (
      <CpvPage title="Product Workspace">
        <CpvLoading />
      </CpvPage>
    )
  }

  if (!product.data) {
    return (
      <CpvPage title="Product Workspace">
        <CpvError message={product.error ?? 'Product not found.'} />
      </CpvPage>
    )
  }

  const record = product.data

  return (
    <CpvPage title={`${record.product_code} · ${record.product_name}`} description="Product-centered CPV workspace.">
      <dl className="cpv-product-header panel">
        <div>
          <dt>Dosage form</dt>
          <dd>{record.dosage_form}</dd>
        </div>
        <div>
          <dt>Review period</dt>
          <dd>
            {record.review_period_start || record.review_period_end
              ? `${formatAppDate(record.review_period_start)} – ${formatAppDate(record.review_period_end)}`
              : 'Not set'}
          </dd>
        </div>
        <div>
          <dt>Official posture</dt>
          <dd>
            <CpvPostureBadge posture={record.official_posture} />
          </dd>
        </div>
        <div>
          <dt>Proposed posture</dt>
          <dd>
            <CpvPostureBadge posture={record.proposed_posture} />
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <CpvStatusBadge status={record.status} />
          </dd>
        </div>
        <div>
          <dt>Last data refresh</dt>
          <dd>{formatAppDateTime(record.updated_at)}</dd>
        </div>
      </dl>

      <div className="cpv-workspace">
        <Card className="panel cpv-workspace-nav" title="Workspace">
          <nav aria-label="Product workspace">
            <ul>
              {CPV_WORKSPACE_SECTIONS.map((section) => (
                <li key={section.id}>
                  <NavLink
                    to={section.path ? `/cpv/products/${record.id}/${section.path}` : `/cpv/products/${record.id}`}
                    end={!section.path}
                  >
                    {section.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </Card>
        <div>
          <Outlet context={{ product: record, reload: product.reload }} />
        </div>
      </div>
    </CpvPage>
  )
}
