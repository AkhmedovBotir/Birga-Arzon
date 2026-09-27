import { useTranslation } from 'react-i18next'
import { Box } from '../components/ui/Box'

export function PlaceholderPage({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  const { t } = useTranslation()

  return (
    <Box title={title} subtitle={subtitle}>
      <p className="text-sm text-slate-500">{t('admin.placeholderBody')}</p>
    </Box>
  )
}
