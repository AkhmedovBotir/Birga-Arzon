type Props = {
  open: boolean
  onToggle: () => void
  className?: string
}

export function Hamburger({ open, onToggle, className = '' }: Props) {
  return (
    <button
      type="button"
      aria-label={open ? 'Sidebar yopish' : 'Sidebar ochish'}
      aria-expanded={open}
      onClick={onToggle}
      className={`relative z-50 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-900/10 bg-white text-teal-900 shadow-sm transition hover:border-teal-700/20 hover:bg-teal-50 active:scale-95 ${className}`}
    >
      <span className="sr-only">Menu</span>
      <span className="relative block h-3.5 w-[18px]">
        <span
          className={`absolute left-0 block h-[2px] w-[18px] rounded-full bg-current transition-all duration-300 ${
            open ? 'top-[6px] rotate-45' : 'top-0'
          }`}
        />
        <span
          className={`absolute top-[6px] left-0 block h-[2px] w-[18px] rounded-full bg-current transition-all duration-300 ${
            open ? 'scale-x-0 opacity-0' : 'scale-x-100 opacity-100'
          }`}
        />
        <span
          className={`absolute left-0 block h-[2px] w-[18px] rounded-full bg-current transition-all duration-300 ${
            open ? 'top-[6px] -rotate-45' : 'top-3'
          }`}
        />
      </span>
    </button>
  )
}
