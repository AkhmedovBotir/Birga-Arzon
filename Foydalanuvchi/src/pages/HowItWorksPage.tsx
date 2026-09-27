import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Package,
  ShoppingCart,
  Smartphone,
  Truck,
  Users,
} from 'lucide-react'

const stepIcons = [Smartphone, ShoppingCart, Users, Truck] as const

export function HowItWorksPage() {
  const { t } = useTranslation()

  const steps = [1, 2, 3, 4].map((n) => ({
    n,
    Icon: stepIcons[n - 1],
    title: t(`guide.step${n}Title`),
    text: t(`guide.step${n}Text`),
  }))

  const features = [1, 2, 3, 4, 5, 6].map((n) => ({
    title: t(`guide.feature${n}Title`),
    text: t(`guide.feature${n}Text`),
  }))

  return (
    <div className="mx-auto max-w-3xl space-y-8 sm:space-y-10">
      <section className="rounded-[1.35rem] bg-[var(--green-soft)] px-5 py-7 sm:rounded-[1.5rem] sm:px-8 sm:py-9">
        <p className="text-[11px] font-extrabold tracking-[0.16em] text-[var(--green-mid)] uppercase">
          {t('guide.eyebrow')}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--green)] sm:text-3xl">
          {t('guide.title')}
        </h1>
        <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-[var(--muted)] sm:text-[15px]">
          {t('guide.subtitle')}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-extrabold text-[var(--ink)] sm:text-xl">
          {t('guide.stepsTitle')}
        </h2>
        <ol className="space-y-3">
          {steps.map(({ n, Icon, title, text }, i) => (
            <motion.li
              key={n}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="flex gap-3.5 rounded-[1.25rem] bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] sm:gap-4 sm:p-5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] sm:h-12 sm:w-12">
                <Icon size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold tracking-wide text-[var(--brand)] uppercase">
                  {t('guide.stepLabel', { n })}
                </p>
                <h3 className="mt-0.5 text-[15px] font-extrabold text-[var(--ink)] sm:text-base">
                  {title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  {text}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-extrabold text-[var(--ink)] sm:text-xl">
          {t('guide.featuresTitle')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {features.map(({ title, text }) => (
            <li
              key={title}
              className="rounded-[1.15rem] bg-white p-4 ring-1 ring-[var(--line)] sm:p-5"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0 text-[var(--green-bright)]"
                />
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--ink)]">
                    {title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] sm:text-[13px]">
                    {text}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-[1.35rem] bg-white p-5 ring-1 ring-[var(--line)] sm:p-6">
        <h2 className="text-lg font-extrabold text-[var(--ink)]">
          {t('guide.tipsTitle')}
        </h2>
        <ul className="space-y-2.5 text-sm leading-relaxed text-[var(--muted)]">
          <li className="flex gap-2.5">
            <Package size={16} className="mt-0.5 shrink-0 text-[var(--brand)]" />
            {t('guide.tip1')}
          </li>
          <li className="flex gap-2.5">
            <MapPin size={16} className="mt-0.5 shrink-0 text-[var(--brand)]" />
            {t('guide.tip2')}
          </li>
          <li className="flex gap-2.5">
            <Users size={16} className="mt-0.5 shrink-0 text-[var(--brand)]" />
            {t('guide.tip3')}
          </li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3 pb-2">
        <Link
          to="/kategoriyalar"
          className="ba-btn inline-flex rounded-xl px-5 py-3 text-sm"
        >
          {t('home.goToYigims')}
          <ArrowRight size={16} />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[var(--ink)] ring-1 ring-[var(--line)]"
        >
          {t('common.back')}
        </Link>
      </div>
    </div>
  )
}
