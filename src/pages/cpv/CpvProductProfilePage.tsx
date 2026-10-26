import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { CpvError, CpvLoading, CpvPage } from '../../components/cpv/CpvComponents'
import { listDatabaseRows } from '../../features/apqr/apqrService'
import { uniqueApqrProducts } from '../../features/cpv/apqrProductCatalog'
import { CPV_PRODUCT_ARCHIVED } from '../../features/cpv/cpvLinks'
import { ensureCpvProductFromApqr, listCpvProducts, reloadCpvStoreFromSession, retireCpvProduct } from '../../features/cpv/cpvService'
import { isProductProfileSection, productProfilePath, type ProductProfileSectionId } from '../../features/cpv/productProfile'
import { loadProductSectionWorkbook, productSectionHeld, saveProductSectionWorkbook } from '../../features/cpv/productProfileWorkbook'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import type { CpvProduct } from '../../features/cpv/types'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import type { EquipmentWorkbook } from '../../features/vmp/equipmentWorkbook'
import { EquipmentSpreadsheet } from '../vmp/EquipmentSpreadsheet'
import '../../styles/equipment-profile.css'

const STORAGE_ERROR = 'This sheet could not be saved. Browser storage is full, so the latest edits stay in this tab until a save succeeds.'

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
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)
  const pending = useRef<{ productId: string; section: string; workbook: EquipmentWorkbook } | null>(null)
  const timer = useRef<number | null>(null)

  function writePending() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    const item = pending.current
    if (!item) return true
    try {
      saveProductSectionWorkbook(item.productId, item.section, item.workbook)
    } catch {
      return false
    }
    pending.current = null
    return true
  }

  function finishSave(saved: boolean) {
    if (saved) {
      setSaveState('Saved')
      setSheetError((current) => (current === STORAGE_ERROR ? null : current))
      return
    }
    setSaveState('Not saved')
    setSheetError(STORAGE_ERROR)
  }

  useEffect(() => {
    if (!section) return
    writePending()
    const loaded = loadProductSectionWorkbook(productCode, section)
    setWorkbook(loaded)
    if (productSectionHeld(productCode, section)) {
      pending.current = { productId: productCode, section, workbook: loaded }
      finishSave(false)
    } else {
      pending.current = null
      finishSave(true)
    }
    return () => {
      writePending()
    }
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
  const archived = record.status === 'Retired'

  async function archiveProduct() {
    setArchiving(true)
    setArchiveError(null)
    try {
      reloadCpvStoreFromSession()
      await retireCpvProduct(record.id, archiveReason)
      const archivedMessage = { type: CPV_PRODUCT_ARCHIVED, productCode: record.product_code }
      if (window.parent !== window) window.parent.postMessage(archivedMessage, window.location.origin)
      if (window.opener && window.opener !== window) window.opener.postMessage(archivedMessage, window.location.origin)
      setArchiveOpen(false)
      setArchiveReason('')
      await product.reload()
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Could not archive this product.')
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="page equipment-profile-page cpv-product-profile">
      <header className="equipment-profile-header">
        <h1>{record.product_name} ({record.product_code})</h1>
        {archived ? (
          <span className="cpv-profile-archived" title={record.retire_reason ?? undefined}>Archived</span>
        ) : canEdit ? (
          <button type="button" className="cpv-profile-archive" onClick={() => { setArchiveOpen(true); setArchiveError(null) }}>
            Archive
          </button>
        ) : null}
      </header>
      {archiveOpen ? (
        <form
          className="cpv-profile-archive-form"
          onSubmit={(event) => {
            event.preventDefault()
            void archiveProduct()
          }}
        >
          <label>
            Reason
            <input value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} required aria-label="Archive reason" />
          </label>
          <p>Archiving hides this product from the current list. Its sheets stay saved.</p>
          {archiveError ? <p className="eq-banner">{archiveError}</p> : null}
          <button type="submit" disabled={archiving}>Archive</button>
          <button type="button" onClick={() => setArchiveOpen(false)}>Cancel</button>
        </form>
      ) : null}
      {sheetError ? <p className="eq-banner">{sheetError}</p> : null}
      <EquipmentSpreadsheet
        key={`${productCode}:${section}`}
        workbook={workbook}
        readOnly={!canEdit || archived}
        saveState={saveState}
        onChange={(next) => {
          setWorkbook(next)
          pending.current = { productId: productCode, section, workbook: next }
          setSaveState('Saving…')
          if (timer.current !== null) window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => {
            finishSave(writePending())
          }, 400)
        }}
        onError={setSheetError}
      />
    </div>
  )
}
