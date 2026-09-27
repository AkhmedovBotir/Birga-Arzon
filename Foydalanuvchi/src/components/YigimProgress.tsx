import { useTranslation } from 'react-i18next'

type Props = {
  current: number
  target: number
  unit?: string
  /** compact = card ichida; default = batafsil */
  size?: 'sm' | 'md'
  className?: string
  showLabel?: boolean
}

export function YigimProgress({
  current,
  target,
  unit = '',
  size = 'md',
  className = '',
  showLabel = true,
}: Props) {
  const { t } = useTranslation()
  const goal = Math.max(target || 1, 1)
  const filled = Math.max(0, Math.min(current, goal))
  const pct = Math.min(100, Math.round((filled / goal) * 100))
  const unitSuffix = unit ? ` ${unit}` : ''
  const tall = size === 'md'

  return (
    <div className={`space-y-1.5 ${className}`}>
      {showLabel && (
        <div
          className={`flex items-center justify-between gap-2 font-bold ${
            tall ? 'text-xs sm:text-[13px]' : 'text-[11px]'
          }`}
        >
          <span className="min-w-0 truncate text-[var(--green-mid)]">
            {t('yigim.collected', {
              filled,
              goal,
              unit: unitSuffix,
            })}
          </span>
          <span className="shrink-0 tabular-nums text-[var(--green)]">
            {pct}%
          </span>
        </div>
      )}
      <div
        className={`ba-progress ${tall ? 'ba-progress--md' : 'ba-progress--sm'}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('yigim.progressAria', { pct })}
      >
        <span
          style={{ width: `${pct === 0 ? 0 : Math.max(pct, 3)}%` }}
          data-full={pct >= 100 ? '' : undefined}
        />
      </div>
    </div>
  )
}
