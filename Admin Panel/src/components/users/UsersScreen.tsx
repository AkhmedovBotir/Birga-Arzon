import { useEffect, useState } from 'react';
import { useI18n } from '@/src/i18n';
import { DataTable, SelectField, Td, Th } from '@/src/components/ui/Panel';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import type { City, Mfy, Region, UserProfile } from '@/src/types';

export function UsersScreen() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [mfys, setMfys] = useState<Mfy[]>([]);
  const [regionId, setRegionId] = useState('');
  const [cityId, setCityId] = useState('');
  const [mfyId, setMfyId] = useState('');
  const [items, setItems] = useState<UserProfile[]>([]);

  useEffect(() => {
    void apiRequest<{ items: Region[] }>('/api/regions').then((d) => setRegions(d.items || []));
  }, []);
  useEffect(() => {
    setCityId('');
    setMfyId('');
    if (!regionId) {
      setCities([]);
      return;
    }
    void apiRequest<{ items: City[] }>(`/api/regions/${regionId}/cities`).then((d) => setCities(d.items || []));
  }, [regionId]);
  useEffect(() => {
    setMfyId('');
    if (!cityId) {
      setMfys([]);
      return;
    }
    void apiRequest<{ items: Mfy[] }>(`/api/cities/${cityId}/mfys`).then((d) => setMfys(d.items || []));
  }, [cityId]);
  useEffect(() => {
    if (!token) return;
    const q = new URLSearchParams();
    if (cityId) q.set('cityId', cityId);
    if (mfyId) q.set('mfyId', mfyId);
    void apiRequest<{ items: UserProfile[] }>(`/api/admin/users?${q.toString()}`, { token }).then((d) => setItems(d.items || []));
  }, [cityId, mfyId, token]);

  return (
    <div>
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">{t('users_kicker')}</p>
        <h1 className="text-xl sm:text-2xl font-extrabold text-ink">{t('users_title')}</h1>
        <p className="text-sm text-[#5C6B63] mt-1">{t('users_hint')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <SelectField label={t('common_region')} value={regionId} onChange={setRegionId} options={[{ label: t('common_all'), value: '' }, ...regions.map((r) => ({ label: r.name, value: r.id }))]} />
        <SelectField label={t('common_city')} value={cityId} onChange={setCityId} options={[{ label: t('common_all'), value: '' }, ...cities.map((c) => ({ label: c.name, value: c.id }))]} />
        <SelectField label={t('common_mfy')} value={mfyId} onChange={setMfyId} options={[{ label: t('common_all'), value: '' }, ...mfys.map((m) => ({ label: m.name, value: m.id }))]} />
      </div>
      <DataTable>
        <thead>
          <tr>
            <Th>{t('users_title')}</Th>
            <Th className="hidden sm:table-cell">{t('common_phone')}</Th>
            <Th className="hidden md:table-cell">{t('users_area')}</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((u) => (
            <tr key={u.id} className="hover:bg-[#FBF8F1]">
              <Td className="font-bold">
                <p>{u.firstName} {u.lastName}</p>
                <p className="text-xs text-[#5C6B63] font-normal sm:hidden mt-0.5">{u.phoneMasked || u.phone}</p>
              </Td>
              <Td className="hidden sm:table-cell">{u.phoneMasked || u.phone}</Td>
              <Td className="hidden md:table-cell text-[#5C6B63]">{[u.regionName, u.cityName, u.mfyName].filter(Boolean).join(' · ') || '—'}</Td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <Td colSpan={3} className="text-[#5C6B63]">{t('users_empty')}</Td>
            </tr>
          ) : null}
        </tbody>
      </DataTable>
    </div>
  );
}
