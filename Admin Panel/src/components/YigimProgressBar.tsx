type Props = {
  current: number
  target: number
  className?: string
}

/** Admin yig‘im progress — user tomondagi bilan bir xil mantiq */
export function YigimProgressBar({ current, target, className = '' }: Props) {
  const goal = Math.max(target || 1, 1)
  const filled = Math.max(0, Math.min(current, goal))
  const pct = Math.min(100, Math.round((filled / goal) * 100))

  return (
    <div className={`min-w-[140px] space-y-1 ${className}`}>
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
        <span className="tabular-nums text-teal-800">
          {filled} / {goal}
        </span>
        <span className="tabular-nums text-teal-600">{pct}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-teal-100 shadow-inner"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${pct === 0 ? 0 : Math.max(pct, 4)}%` }}
        />
      </div>
    </div>
  )
}
