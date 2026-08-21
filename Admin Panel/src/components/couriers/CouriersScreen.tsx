import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { errText, useI18n } from '@/src/i18n';
import { Alert, Btn, DataTable, IconBtn, Modal, SelectField, Td, TextField, Th } from '@/src/components/ui/Panel';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { formatFullUzDisplay, formatNationalDisplay, nationalDigitsFromAny, toFullUzE164, UZ_NATIONAL_LEN } from '@/src/lib/phoneUz';
import type { City, Mfy, Region, UserProfile } from '@/src/types';

export function CouriersScreen() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [items, setItems] = useState<UserProfile[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [mfys, setMfys] = useState<Mfy[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<UserProfile | null>(null);
  const [remove, setRemove] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNational, setPhoneNational] = useState('');
  const [password, setPassword] = useState('');
  const [regionId, setRegionId] = useState('');
  const [cityId, setCityId] = useState('');
  const [mfyId, setMfyId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const d = await apiRequest<{ items: UserProfile[] }>('/api/admin/couriers', { token });
    setItems(d.items || []);
  }, [token]);

  useEffect(() => {
    void load();
    void apiRequest<{ items: Region[] }>('/api/regions').then((d) => setRegions(d.items || []));
  }, [load]);

  useEffect(() => {
    if (!regionId) {
      setCities([]);
      return;
    }
    void apiRequest<{ items: City[] }>(`/api/regions/${regionId}/cities`).then((d) => setCities(d.items || []));
  }, [regionId]);

  useEffect(() => {
    if (!cityId) {
      setMfys([]);
      return;
    }
    void apiRequest<{ items: Mfy[] }>(`/api/cities/${cityId}/mfys`).then((d) => setMfys(d.items || []));
  }, [cityId]);

  const reset = () => {
    setEdit(null);
    setFirstName('');
    setLastName('');
    setPhoneNational('');
    setPassword('');
    setRegionId('');
    setCityId('');
    setMfyId('');
    setError(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (u: UserProfile) => {
    setError(null);
    setEdit(u);
    setFirstName(u.firstName);
    setLastName(u.lastName);
    setPhoneNational(nationalDigitsFromAny(u.phone || u.phoneMasked || ''));
    setPassword('');
    setRegionId(u.regionId || '');
    setCityId(u.cityId || '');
    setMfyId(u.mfyId || '');
    setOpen(true);
  };

  const save = async () => {
    if (!token) return;
    if (!firstName.trim() || !lastName.trim()) {
      setError(t('cour_needName'));
      return;
    }
    if (phoneNational.length < UZ_NATIONAL_LEN) {
      setError(t('cour_phoneBad'));
      return;
    }
    if (!regionId || !cityId || !mfyId) {
      setError(t('cour_needArea'));
      return;
    }
    if (!edit && password.trim().length < 6) {
      setError(t('common_min6'));
      return;
    }
    if (edit && password && password.trim().length < 6) {
      setError(t('common_min6'));
      return;
    }
    setBusy(true);
    setError(null);
    const body: Record<string, string> = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: toFullUzE164(phoneNational),
      regionId,
      cityId,
      mfyId,
    };
    if (password.trim()) body.password = password.trim();
    try {
      if (edit) {
        await apiRequest(`/api/admin/couriers/${edit.id}`, { method: 'PATCH', token, body, success: t('cour_updated') });
      } else {
        await apiRequest('/api/admin/couriers', { method: 'POST', token, body, success: t('cour_added') });
      }
      setOpen(false);
      reset();
      await load();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const destroy = async () => {
    if (!token || !remove) return;
    await apiRequest(`/api/admin/couriers/${remove.id}`, { method: 'DELETE', token, success: t('cour_deleted') });
    setRemove(null);
    await load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">{t('cour_kicker')}</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink">{t('cour_title')}</h1>
          <p className="text-sm text-[#5C6B63] mt-1">{t('cour_hint')}</p>
        </div>
        <Btn onClick={openCreate}>
          <Plus size={16} /> {t('cour_new')}
        </Btn>
      </div>

      <DataTable>
        <thead>
          <tr>
            <Th>{t('cour_roleCourier')}</Th>
            <Th>{t('common_phone')}</Th>
            <Th className="hidden sm:table-cell">{t('users_area')}</Th>
            <Th className="text-right">{t('common_actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((u) => (
            <tr key={u.id} className="hover:bg-[#FBF8F1]">
              <Td className="font-bold">
                {u.firstName} {u.lastName}
              </Td>
              <Td className="whitespace-nowrap">{formatFullUzDisplay(u.phone || u.phoneMasked || '')}</Td>
              <Td className="hidden sm:table-cell text-[#5C6B63]">
                {[u.regionName, u.cityName, u.mfyName].filter(Boolean).join(' · ')
                  || (u.mfyId || u.cityId || u.regionId ? t('common_assigned') : t('common_notAssigned'))}
              </Td>
              <Td className="text-right whitespace-nowrap">
                <IconBtn title={t('common_edit')} onClick={() => openEdit(u)}>
                  <Pencil size={16} />
                </IconBtn>
                <IconBtn title={t('common_delete')} danger onClick={() => setRemove(u)}>
                  <Trash2 size={16} />
                </IconBtn>
              </Td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <Td colSpan={4} className="text-[#5C6B63]">
                {t('cour_empty')}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </DataTable>

      <Modal
        open={open}
        title={edit ? t('cour_edit') : t('cour_new')}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        footer={
          <>
            <Btn variant="outline" onClick={() => { setOpen(false); reset(); }}>
              {t('common_cancel')}
            </Btn>
            <Btn disabled={busy || !regionId || !cityId || !mfyId} onClick={() => void save()}>
              {busy ? t('common_saving') : t('common_save')}
            </Btn>
          </>
        }
      >
        {error ? <Alert>{error}</Alert> : null}
        <div className="space-y-3">
          <TextField label={t('common_firstName')} value={firstName} onChange={setFirstName} placeholder="Ali" />
          <TextField label={t('common_lastName')} value={lastName} onChange={setLastName} placeholder="Karimov" />
          <label className="block">
            <span className="block text-sm font-medium text-[#3d4a43] mb-1.5">{t('common_phone')}</span>
            <div className="flex rounded-xl overflow-hidden border border-[#E8DFD0] bg-[#F8F4EC] focus-within:ring-2 focus-within:ring-brand-800/20">
              <span className="px-3 bg-brand-900 text-white flex items-center text-sm font-semibold">+998</span>
              <input
                className="flex-1 px-3 py-2.5 bg-transparent outline-none text-ink min-w-0 placeholder:text-[#9AA59D]"
                value={formatNationalDisplay(phoneNational)}
                onChange={(e) => setPhoneNational(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="90 123 45 67"
                inputMode="numeric"
              />
            </div>
          </label>
          <SelectField
            label={t('common_region')}
            value={regionId}
            onChange={(v) => {
              setRegionId(v);
              setCityId('');
              setMfyId('');
            }}
            options={[{ label: t('common_select'), value: '' }, ...regions.map((r) => ({ label: r.name, value: r.id }))]}
          />
          <SelectField
            label={t('common_city')}
            value={cityId}
            onChange={(v) => {
              setCityId(v);
              setMfyId('');
            }}
            options={[{ label: regionId ? t('common_select') : t('common_selectRegionFirst'), value: '' }, ...cities.map((c) => ({ label: c.name, value: c.id }))]}
          />
          <SelectField
            label={t('common_mfy')}
            value={mfyId}
            onChange={setMfyId}
            options={[{ label: cityId ? t('common_select') : t('common_selectCityFirst'), value: '' }, ...mfys.map((m) => ({ label: m.name, value: m.id }))]}
          />
          <TextField
            label={edit ? t('common_newPasswordOptional') : t('common_password')}
            value={password}
            onChange={setPassword}
            type="password"
            placeholder={edit ? t('common_keepPassword') : t('common_min6')}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(remove)}
        title={t('cour_del')}
        onClose={() => setRemove(null)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setRemove(null)}>
              {t('common_cancel')}
            </Btn>
            <Btn variant="danger" onClick={() => void destroy()}>
              {t('common_delete')}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-[#5C6B63]">
          {remove ? t('cour_delBody', { name: `${remove.firstName} ${remove.lastName}` }) : ''}
        </p>
      </Modal>
    </div>
  );
}
