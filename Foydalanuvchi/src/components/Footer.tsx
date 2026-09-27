import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, MapPin, Phone, Send } from 'lucide-react'
import { config } from '../config'
import { shell } from './layout'

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M14 8.5V6.8c0-.7.5-1.3 1.2-1.3H17V3h-2.4C12 3 10.5 4.6 10.5 6.8v1.7H8.5V11h2v10h3.5V11H16l.5-2.5H14z" />
    </svg>
  )
}

function YoutubeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22.5 7.5s-.2-1.6-.8-2.3c-.8-.8-1.7-.8-2.1-.9C16.9 4 12 4 12 4s-4.9 0-7.6.3c-.4.1-1.3.1-2.1.9-.6.7-.8 2.3-.8 2.3S1.3 9.4 1.3 11.2v1.6c0 1.8.2 3.7.2 3.7s.2 1.6.8 2.3c.8.8 1.9.8 2.4.9 1.7.2 7.3.3 7.3.3s4.9 0 7.6-.3c.4-.1 1.3-.1 2.1-.9.6-.7.8-2.3.8-2.3s.2-1.9.2-3.7v-1.6c0-1.8-.2-3.7-.2-3.7z" />
      <path d="M10 15.2V8.8l5.5 3.2L10 15.2z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  const navLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/kategoriyalar', label: t('nav.categories') },
    { to: '/savat', label: t('nav.cart') },
    { to: '/profil', label: t('nav.profile') },
  ]

  const helpLinks = [
    { to: '/qanday-ishlaydi', label: t('home.howItWorks') },
    { to: '/qanday-ishlaydi', label: t('footer.faq') },
    { to: '/qanday-ishlaydi', label: t('footer.rules') },
    { to: '/kirish', label: t('footer.contact') },
  ]

  return (
    <footer className="relative mt-6 overflow-hidden md:mt-12">
      <div className="relative bg-[var(--green)] text-white">
        <div className={`${shell} relative pt-7 pb-24 md:pt-14 md:pb-10`}>
          <div className="md:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link to="/" className="inline-flex min-w-0 items-center gap-2.5">
                <img
                  src="/images/hero-mascot-removebg.png"
                  alt=""
                  className="h-9 w-9 object-contain"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src =
                      '/images/hero-mascot.png'
                  }}
                />
                <div className="min-w-0">
                  <p className="text-[15px] leading-tight font-extrabold tracking-tight">
                    <span className="text-white">Birga</span>
                    <span className="text-[var(--brand)]">Arzon</span>
                  </p>
                  <p className="mt-0.5 truncate text-[8px] font-bold tracking-[0.12em] text-[#a8d5c0] uppercase">
                    {config.tagline}
                  </p>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-1.5">
                {[
                  { Icon: Send, label: 'Telegram', href: '#' },
                  { Icon: InstagramIcon, label: 'Instagram', href: '#' },
                  { Icon: Phone, label: t('common.phone'), href: 'tel:+998901234567' },
                ].map(({ Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15"
                  >
                    <Icon size={14} />
                  </a>
                ))}
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-white/55">
              {t('footer.taglineShort')}
            </p>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <p className="text-[11px] font-semibold text-white/40">
                © {year} {config.appName}
              </p>
              <a
                href="mailto:info@birgaarzon.uz"
                className="text-[11px] font-bold text-white/55"
              >
                info@birgaarzon.uz
              </a>
            </div>
          </div>

          <div className="hidden md:block">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-4">
                <Link to="/" className="inline-flex items-center gap-3">
                  <img
                    src="/images/hero-mascot-removebg.png"
                    alt=""
                    className="h-12 w-12 object-contain"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src =
                        '/images/hero-mascot.png'
                    }}
                  />
                  <div>
                    <p className="text-lg leading-tight font-extrabold tracking-tight">
                      <span className="text-white">Birga</span>
                      <span className="text-[var(--brand)]">Arzon</span>
                    </p>
                    <p className="mt-0.5 text-[9px] font-bold tracking-[0.16em] text-[#a8d5c0] uppercase">
                      {config.tagline}
                    </p>
                  </div>
                </Link>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
                  {t('footer.about')}
                </p>
                <div className="mt-5 flex items-center gap-2">
                  {[
                    { Icon: Send, label: 'Telegram', href: '#' },
                    { Icon: InstagramIcon, label: 'Instagram', href: '#' },
                    { Icon: FacebookIcon, label: 'Facebook', href: '#' },
                    { Icon: YoutubeIcon, label: 'YouTube', href: '#' },
                  ].map(({ Icon, label, href }) => (
                    <a
                      key={label}
                      href={href}
                      aria-label={label}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-[var(--brand)] hover:ring-[var(--brand)]"
                    >
                      <Icon size={16} />
                    </a>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2">
                <h3 className="text-[11px] font-extrabold tracking-[0.18em] text-[#a8d5c0] uppercase">
                  {t('footer.menu')}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {navLinks.map(({ to, label }) => (
                    <li key={label}>
                      <Link
                        to={to}
                        className="text-sm font-bold text-white/70 transition hover:text-white"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:col-span-3">
                <h3 className="text-[11px] font-extrabold tracking-[0.18em] text-[#a8d5c0] uppercase">
                  {t('footer.help')}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {helpLinks.map(({ to, label }) => (
                    <li key={label}>
                      <Link
                        to={to}
                        className="text-sm font-bold text-white/70 transition hover:text-white"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:col-span-3">
                <h3 className="text-[11px] font-extrabold tracking-[0.18em] text-[#a8d5c0] uppercase">
                  {t('footer.contact')}
                </h3>
                <ul className="mt-4 space-y-3">
                  <li>
                    <a
                      href="tel:+998901234567"
                      className="flex items-start gap-3 text-sm font-bold text-white/70 transition hover:text-white"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#a8d5c0]">
                        <Phone size={14} />
                      </span>
                      <span>
                        +998 90 123 45 67
                        <span className="mt-0.5 block text-xs font-semibold text-white/40">
                          {t('footer.hours')}
                        </span>
                      </span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="mailto:info@birgaarzon.uz"
                      className="flex items-center gap-3 text-sm font-bold text-white/70 transition hover:text-white"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#a8d5c0]">
                        <Mail size={14} />
                      </span>
                      info@birgaarzon.uz
                    </a>
                  </li>
                  <li className="flex items-start gap-3 text-sm font-bold text-white/70">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#a8d5c0]">
                      <MapPin size={14} />
                    </span>
                    <span>
                      {t('footer.city')}
                      <span className="mt-0.5 block text-xs font-semibold text-white/40">
                        {t('footer.deliveryRegions')}
                      </span>
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-white/45">
                © {year} {config.appName}
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-white/50">
                <span className="transition hover:text-white/80">
                  {t('footer.privacy')}
                </span>
                <span className="transition hover:text-white/80">
                  {t('footer.terms')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
