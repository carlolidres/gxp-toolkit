import { useMemo, useState } from 'react'
import { Button, Modal, Select, Space, Typography } from 'antd'
import { Trash2 } from 'lucide-react'

import { normalizeRegistryValue } from '../../utils/vrmsLogic'

const { Text } = Typography

function filterOption(input: string, option?: { label?: string; value?: string }) {
  const needle = input.trim().toLowerCase()
  if (!needle) return true
  return String(option?.label ?? option?.value ?? '')
    .toLowerCase()
    .includes(needle)
}

export function VrmsRegistrySelect({
  value,
  options,
  placeholder,
  disabled = false,
  allowCreate = false,
  canRemove = false,
  onChange,
  onRemoveOption,
}: {
  value: string
  options: readonly string[]
  placeholder: string
  disabled?: boolean
  allowCreate?: boolean
  canRemove?: boolean
  onChange: (value: string) => void
  onRemoveOption?: (value: string) => Promise<void> | void
}) {
  const [search, setSearch] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const normalizedOptions = useMemo(() => {
    const seen = new Set<string>()
    const next: string[] = []
    for (const option of options) {
      const trimmed = option.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      next.push(trimmed)
    }
    if (value.trim() && !seen.has(value.trim().toLowerCase())) {
      next.unshift(value.trim())
    }
    return next
  }, [options, value])

  const createCandidate = useMemo(() => {
    if (!allowCreate) return ''
    return normalizeRegistryValue(search)
  }, [allowCreate, search])

  const showCreate =
    Boolean(createCandidate) &&
    !normalizedOptions.some((option) => option.toLowerCase() === createCandidate.toLowerCase())

  async function confirmRemove() {
    if (!removing || !onRemoveOption) return
    setBusy(true)
    try {
      await onRemoveOption(removing)
      setRemoving(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Select
        className="vrms-routing-select"
        showSearch
        allowClear
        value={value || undefined}
        disabled={disabled}
        placeholder={placeholder}
        searchValue={search}
        onSearch={setSearch}
        filterOption={filterOption}
        optionLabelProp="label"
        notFoundContent={
          showCreate ? (
            <button
              type="button"
              className="vrms-registry-create-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(createCandidate)
                setSearch('')
              }}
            >
              Add “{createCandidate}”
            </button>
          ) : (
            <Text type="secondary">No matching suggestions</Text>
          )
        }
        onChange={(next) => {
          onChange(typeof next === 'string' ? next : '')
          setSearch('')
        }}
        onClear={() => {
          onChange('')
          setSearch('')
        }}
        options={normalizedOptions.map((option) => ({
          value: option,
          label: option,
          title: option,
        }))}
        optionRender={(option) => {
          const optionValue = String(option.value ?? '')
          return (
            <div className="vrms-registry-option-row">
              <span className="vrms-registry-option-label">{optionValue}</span>
              {canRemove && onRemoveOption ? (
                <Button
                  type="text"
                  size="small"
                  className="vrms-registry-option-remove"
                  aria-label={`Remove ${optionValue}`}
                  icon={<Trash2 size={13} aria-hidden />}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setRemoving(optionValue)
                  }}
                />
              ) : null}
            </div>
          )
        }}
        popupMatchSelectWidth
        getPopupContainer={() => document.body}
      />

      {showCreate && search.trim() ? (
        <button
          type="button"
          className="vrms-registry-inline-create"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange(createCandidate)
            setSearch('')
          }}
        >
          Use “{createCandidate}”
        </button>
      ) : null}

      <Modal
        open={Boolean(removing)}
        title="Remove saved option?"
        onCancel={() => setRemoving(null)}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={() => setRemoving(null)} disabled={busy}>
              Cancel
            </Button>
            <Button danger type="primary" loading={busy} onClick={() => void confirmRemove()}>
              Remove
            </Button>
          </Space>
        }
      >
        <p>
          Remove <strong>{removing}</strong> from the shared suggestion list? Existing routing records that already
          use this value will not be changed.
        </p>
      </Modal>
    </>
  )
}
