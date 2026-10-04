import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { CpvError, CpvLoading, CpvPage } from '../../components/cpv/CpvComponents'
import { listDatabaseRows } from '../../features/apqr/apqrService'
import { uniqueApqrProducts } from '../../features/cpv/apqrProductCatalog'
import { ensureCpvProductFromApqr, listCpvProducts } from '../../features/cpv/cpvService'
import { isProductProfileSection, productProfilePath, type ProductProfileSectionId } from '../../features/cpv/productProfile'
import { loadProductSectionWorkbook, saveProductSectionWorkbook } from '../../features/cpv/productProfileWorkbook'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import type { CpvProduct } from '../../features/cpv/types'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import type { EquipmentWorkbook } from '../../features/vmp/equipmentWorkbook'
import { EquipmentSpreadsheet } from '../vmp/EquipmentSpreadsheet'
import '../../styles/equipment-profile.css'

async function loadProductByCode(productCode: string): Promise<CpvProduct | null> {
  const code = productCode.trim().toUpperCase()
  if (!code) return null
  const catalog = uniqueApqrProducts(await listDatabaseRows()).find((row) => row.product_code === code)
  if (!catalog) return null
  const saved = (await listCpvProducts()).find((row) => row.product_code.toUpperCase() === code)
  if (saved) return saved
  return (
    await ensureCpvProductFromApqr({
      product_code: catalog.product_code,
      product_name: catalog.product_name,
      client_name: catalog.client_name,
    })
  ).product
}

export function CpvProductProfilePage() {
  const { productCode = '', section: sectionParam = '' } = useParams()
  const product = useCpvLoad(() => loadProductByCode(productCode), [productCode])
  const { canEdit } = useMenuPermission('cpv-products')
  const section: ProductProfileSectionId | null = isProductProfileSection(sectionParam) ? sectionParam : null
  const [workbook, setWorkbook] = useState<EquipmentWorkbook | null>(null)
  const [saveState, setSaveState] = useState('Saved')
  const [sheetError, setSheetError] = useState<string | null>(null)
  const pending = useRef<{ productId: string; section: string; workbook: EquipmentWorkbook } | null>(null)
  const timer = useRef<number | null>(null)

  function writePending() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    const item = pending.current
    if (!item) return
    saveProductSectionWorkbook(item.productId, item.section, item.workbook)
    pending.current = null
  }

  useEffect(() => {
    if (!section) return
    writePending()
    setWorkbook(loadProductSectionWorkbook(productCode, section))
    setSaveState('Saved')
    setSheetError(null)
    return () => writePending()
  }, [productCode, section])

  useEffect(() => {
    if (!product.data) return
    const previous = document.title
    document.title = product.data.product_name
    return () => {
      document.title = previous
    }
  }, [product.data])

  if (!productCode) {
    return (
      <CpvPage title="Product Profile">
        <CpvError message="Product not found." />
      </CpvPage>
    )
  }

  if (!section) {
    return <Navigate to={productProfilePath(productCode, 'raw-material')} replace />
  }

  if (product.loading || (product.data && !workbook)) {
    return (
      <CpvPage title="Product Profile">
        <CpvLoading />
      </CpvPage>
    )
  }

  if (!product.data || !workbook) {
    return (
      <CpvPage title="Product Profile">
        <CpvError message={product.error ?? 'Product not found.'} />
      </CpvPage>
    )
  }

  const record = product.data

  return (
    <div className="page equipment-profile-page cpv-product-profile">
      <header className="equipment-profile-header">
        <p className="eyebrow">Product Profile</p>
        <h1>{record.product_name}</h1>
        <p className="cpv-profile-meta">
          <span>
            Product Code: <strong>{record.product_code}</strong>
          </span>
          <span className="cpv-profile-meta-sep" aria-hidden>
            |
          </span>
          <span>Maintain product-related data, test results, and quality information.</span>
        </p>
      </header>
      {sheetError ? <p className="eq-banner">{sheetError}</p> : null}
      <EquipmentSpreadsheet
        key={`${productCode}:${section}`}
        workbook={workbook}
        readOnly={!canEdit}
        saveState={saveState}
        onChange={(next) => {
          setWorkbook(next)
          pending.current = { productId: productCode, section, workbook: next }
          setSaveState('Saving…')
          if (timer.current !== null) window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => {
            writePending()
            setSaveState('Saved')
          }, 400)
        }}
        onError={setSheetError}
      />
    </div>
  )
}
