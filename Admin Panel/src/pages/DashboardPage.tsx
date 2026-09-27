import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Shield, Truck, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { Box } from '../components/ui/Box'
import { phoneDisplay } from '../lib/phone'

export function DashboardPage() {
  const { t } = useTranslation()
  const { admin } = useAuth()

  const cards = useMemo(
    () => [
      { label: t('nav.admins'), value: '—', icon: Shield, hint: t('admin.comingSoon') },
      { label: t('nav.users'), value: '—', icon: Users, hint: t('admin.comingSoon') },
      { label: t('nav.couriers'), value: '—', icon: Truck, hint: t('admin.comingSoon') },
    ],
    [t],
  )

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('admin.hello', { name: admin?.first_name || admin?.username })}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {t('admin.dashboardHint')}
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <Box>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {card.value}
                  </p>
                  <p className="mt-1 text-xs text-teal-700">{card.hint}</p>
                </div>
                <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700">
                  <card.icon size={20} />
                </div>
              </div>
            </Box>
          </motion.div>
        ))}
      </div>

      <Box title={t('admin.quickInfo')} subtitle={t('admin.quickInfoHint')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <p className="text-slate-500">{t('admin.yourRole')}</p>
            <p className="mt-1 font-semibold text-teal-800 uppercase">
              {admin?.role}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <p className="text-slate-500">{t('common.phone')}</p>
            <p className="mt-1 font-semibold text-slate-800">
              {admin?.phone ? phoneDisplay(admin.phone) : '—'}
            </p>
          </div>
        </div>
      </Box>
    </div>
  )
}
