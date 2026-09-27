import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'

export type DeltaJSON = {
  ops: Array<Record<string, unknown>>
}

const EMPTY_DELTA: DeltaJSON = { ops: [{ insert: '\n' }] }

type Props = {
  label?: string
  value: DeltaJSON | null
  onChange: (delta: DeltaJSON) => void
}

export function DeltaEditor({ label, value, onChange }: Props) {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t('common.description')
  const wrapRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  const skipSyncRef = useRef(false)
  const placeholderRef = useRef(t('admin.productDescPlaceholder'))

  onChangeRef.current = onChange
  valueRef.current = value
  placeholderRef.current = t('admin.productDescPlaceholder')

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    // Strict Mode / remount: eski toolbar + editor ni tozalash
    wrap.innerHTML = ''
    const editorEl = document.createElement('div')
    wrap.appendChild(editorEl)

    const quill = new Quill(editorEl, {
      theme: 'snow',
      placeholder: placeholderRef.current,
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link'],
          ['clean'],
        ],
      },
    })

    const initial = valueRef.current?.ops?.length
      ? valueRef.current
      : EMPTY_DELTA
    quill.setContents(initial as Parameters<Quill['setContents']>[0])

    quill.on('text-change', (_delta, _old, source) => {
      if (source !== 'user') return
      skipSyncRef.current = true
      onChangeRef.current(quill.getContents() as unknown as DeltaJSON)
    })

    quillRef.current = quill

    return () => {
      quillRef.current = null
      wrap.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    const quill = quillRef.current
    if (!quill || !value) return
    if (skipSyncRef.current) {
      skipSyncRef.current = false
      return
    }
    const current = JSON.stringify(quill.getContents())
    const next = JSON.stringify(value)
    if (current !== next) {
      const sel = quill.getSelection()
      quill.setContents(value as Parameters<Quill['setContents']>[0])
      if (sel) quill.setSelection(sel)
    }
  }, [value])

  return (
    <div className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{resolvedLabel}</span>
      <div
        ref={wrapRef}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-slate-200 [&_.ql-container]:min-h-[140px] [&_.ql-container]:border-0 [&_.ql-editor]:min-h-[140px] [&_.ql-editor]:text-sm"
      />
    </div>
  )
}

export { EMPTY_DELTA }
