import { Fragment, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { errText, useI18n } from '@/src/i18n';
import { Alert, Btn, DataTable, IconBtn, Modal, Td, TextField, Th } from '@/src/components/ui/Panel';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import type { City, Mfy, Region } from '@/src/types';

export function LocationsScreen() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [citiesByRegion, setCitiesByRegion] = useState<Record<string, City[]>>({});
  const [mfysByCity, setMfysByCity] = useState<Record<string, Mfy[]>>({});
  const [openRegions, setOpenRegions] = useState<Record<string, boolean>>({});
  const [openCities, setOpenCities] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const [regionModal, setRegionModal] = useState(false);
  const [editRegion, setEditRegion] = useState<Region | null>(null);
  const [regionName, setRegionName] = useState('');
  const [removeRegion, setRemoveRegion] = useState<Region | null>(null);

  const [cityParent, setCityParent] = useState('');
  const [cityModal, setCityModal] = useState(false);
  const [editCity, setEditCity] = useState<City | null>(null);
  const [cityName, setCityName] = useState('');
  const [removeCity, setRemoveCity] = useState<City | null>(null);

  const [mfyParent, setMfyParent] = useState('');
  const [mfyModal, setMfyModal] = useState(false);
  const [editMfy, setEditMfy] = useState<Mfy | null>(null);
  const [mfyName, setMfyName] = useState('');
  const [addr, setAddr] = useState('');
  const [removeMfy, setRemoveMfy] = useState<Mfy | null>(null);

  const loadRegions = useCallback(async () => {
    const d = await apiRequest<{ items: Region[] }>('/api/regions');
    setRegions(d.items || []);
  }, []);

  const loadCities = useCallback(async (regionId: string) => {
    const d = await apiRequest<{ items: City[] }>(`/api/regions/${regionId}/cities`);
    setCitiesByRegion((p) => ({ ...p, [regionId]: d.items || [] }));
  }, []);

  const loadMfys = useCallback(async (cityId: string) => {
    const d = await apiRequest<{ items: Mfy[] }>(`/api/cities/${cityId}/mfys`);
    setMfysByCity((p) => ({ ...p, [cityId]: d.items || [] }));
  }, []);

  useEffect(() => {
    void loadRegions().catch((e) => setError(errText(e)));
  }, [loadRegions]);

  const toggleRegion = async (id: string) => {
    const next = !openRegions[id];
    setOpenRegions((s) => ({ ...s, [id]: next }));
    if (next && !citiesByRegion[id]) await loadCities(id);
  };

  const toggleCity = async (id: string) => {
    const next = !openCities[id];
    setOpenCities((s) => ({ ...s, [id]: next }));
    if (next && !mfysByCity[id]) await loadMfys(id);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">{t('loc_kicker')}</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink">{t('loc_title')}</h1>
          <p className="text-sm text-[#5C6B63] mt-1">{t('loc_hint')}</p>
        </div>
        <Btn
          onClick={() => {
            setEditRegion(null);
            setRegionName('');
            setRegionModal(true);
          }}
        >
          <Plus size={16} /> {t('loc_addRegion')}
        </Btn>
      </div>
      {error ? <Alert>{error}</Alert> : null}

      <DataTable>
        <thead>
          <tr>
            <Th>{t('loc_area')}</Th>
            <Th className="w-48 text-right">{t('common_actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {regions.map((r) => {
            const rOpen = Boolean(openRegions[r.id]);
            const cities = citiesByRegion[r.id] || [];
            return (
              <Fragment key={r.id}>
                <tr key={r.id} className="hover:bg-[#FBF8F1] cursor-pointer" onClick={() => void toggleRegion(r.id)}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <motion.span animate={{ rotate: rOpen ? 90 : 0 }} className="text-brand-800 inline-flex">
                        <ChevronRight size={18} />
                      </motion.span>
                      <span className="font-bold">{r.name}</span>
                      <span className="text-xs text-[#5C6B63] bg-cream px-2 py-0.5 rounded-lg">
                        {citiesByRegion[r.id] ? cities.length : ''}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <IconBtn
                      title={t('loc_addCity')}
                      onClick={() => {
                        setCityParent(r.id);
                        setEditCity(null);
                        setCityName('');
                        setCityModal(true);
                      }}
                    >
                      <Plus size={16} />
                    </IconBtn>
                    <IconBtn
                      title={t('common_edit')}
                      onClick={() => {
                        setEditRegion(r);
                        setRegionName(r.name);
                        setRegionModal(true);
                      }}
                    >
                      <Pencil size={16} />
                    </IconBtn>
                    <IconBtn title={t('common_delete')} danger onClick={() => setRemoveRegion(r)}>
                      <Trash2 size={16} />
                    </IconBtn>
                  </Td>
                </tr>
                <tr key={`${r.id}-cities`} className={!rOpen ? 'hidden' : undefined}>
                  <Td colSpan={2} className="bg-[#F8F4EC] p-0">
                    <AnimatePresence>
                      {rOpen ? (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                          <table className="w-full text-sm">
                            <tbody>
                              {cities.map((c) => {
                                const cOpen = Boolean(openCities[c.id]);
                                const mfys = mfysByCity[c.id] || [];
                                return (
                                  <Fragment key={c.id}>
                                    <tr key={c.id} className="hover:bg-white/60 cursor-pointer" onClick={() => void toggleCity(c.id)}>
                                      <td className="pl-6 md:pl-10 pr-4 py-2.5 border-t border-[#E8DFD0]">
                                        <div className="flex items-center gap-2">
                                          <motion.span animate={{ rotate: cOpen ? 90 : 0 }} className="text-brand-800 inline-flex">
                                            <ChevronRight size={16} />
                                          </motion.span>
                                          <span className="font-semibold">{c.name}</span>
                                          <span className="text-[11px] text-[#5C6B63]">{mfysByCity[c.id] ? t('loc_mfyCount', { n: mfys.length }) : ''}</span>
                                        </div>
                                      </td>
                                      <td className="pr-4 py-2.5 border-t border-[#E8DFD0] text-right whitespace-nowrap w-48">
                                        <IconBtn
                                          title={t('loc_addMfy')}
                                          onClick={() => {
                                            setMfyParent(c.id);
                                            setEditMfy(null);
                                            setMfyName('');
                                            setAddr('');
                                            setMfyModal(true);
                                          }}
                                        >
                                          <Plus size={16} />
                                        </IconBtn>
                                        <IconBtn
                                          title={t('common_edit')}
                                          onClick={() => {
                                            setCityParent(r.id);
                                            setEditCity(c);
                                            setCityName(c.name);
                                            setCityModal(true);
                                          }}
                                        >
                                          <Pencil size={16} />
                                        </IconBtn>
                                        <IconBtn title={t('common_delete')} danger onClick={() => setRemoveCity(c)}>
                                          <Trash2 size={16} />
                                        </IconBtn>
                                      </td>
                                    </tr>
                                    <tr key={`${c.id}-mfys`} className={!cOpen ? 'hidden' : undefined}>
                                      <td colSpan={2} className="bg-white p-0">
                                        <table className="w-full text-sm">
                                          <tbody>
                                            {mfys.map((m) => (
                                              <tr key={m.id} className="hover:bg-[#FBF8F1]">
                                                <td className="pl-8 md:pl-16 pr-4 py-2 border-t border-[#F0E8D8]">
                                                  <p className="font-medium">{m.name}</p>
                                                  {m.pickupAddress ? <p className="text-xs text-[#5C6B63]">{m.pickupAddress}</p> : null}
                                                </td>
                                                <td className="pr-4 py-2 border-t border-[#F0E8D8] text-right whitespace-nowrap w-48">
                                                  <IconBtn
                                                    title={t('common_edit')}
                                                    onClick={() => {
                                                      setMfyParent(c.id);
                                                      setEditMfy(m);
                                                      setMfyName(m.name);
                                                      setAddr(m.pickupAddress || '');
                                                      setMfyModal(true);
                                                    }}
                                                  >
                                                    <Pencil size={16} />
                                                  </IconBtn>
                                                  <IconBtn title={t('common_delete')} danger onClick={() => setRemoveMfy(m)}>
                                                    <Trash2 size={16} />
                                                  </IconBtn>
                                                </td>
                                              </tr>
                                            ))}
                                            {mfys.length === 0 ? (
                                              <tr>
                                                <td className="pl-8 md:pl-16 pr-4 py-3 text-[#5C6B63] border-t border-[#F0E8D8]" colSpan={2}>
                                                  {t('loc_noMfy')}
                                                </td>
                                              </tr>
                                            ) : null}
                                          </tbody>
                                        </table>
                                      </td>
                                    </tr>
                                  </Fragment>
                                );
                              })}
                              {cities.length === 0 ? (
                                <tr>
                                  <td className="pl-6 md:pl-10 pr-4 py-3 text-[#5C6B63] border-t border-[#E8DFD0]" colSpan={2}>
                                    {t('loc_noCity')}
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </Td>
                </tr>
              </Fragment>
            );
          })}
          {regions.length === 0 ? (
            <tr>
              <Td colSpan={2} className="text-[#5C6B63]">{t('loc_empty')}</Td>
            </tr>
          ) : null}
        </tbody>
      </DataTable>

      <Modal
        open={regionModal}
        title={editRegion ? t('loc_editRegion') : t('loc_newRegion')}
        onClose={() => setRegionModal(false)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setRegionModal(false)}>{t('common_cancel')}</Btn>
            <Btn
              onClick={async () => {
                if (!token || !regionName.trim()) return;
                if (editRegion) {
                  await apiRequest(`/api/admin/regions/${editRegion.id}`, { method: 'PATCH', token, body: { name: regionName }, success: t('loc_regionUpdated') });
                } else {
                  await apiRequest('/api/admin/regions', { method: 'POST', token, body: { name: regionName }, success: t('loc_regionAdded') });
                }
                setRegionModal(false);
                await loadRegions();
              }}
            >
              {t('common_save')}
            </Btn>
          </>
        }
      >
        <TextField label={t('common_name')} value={regionName} onChange={setRegionName} />
      </Modal>

      <Modal
        open={cityModal}
        title={editCity ? t('loc_editCity') : t('loc_newCity')}
        onClose={() => setCityModal(false)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setCityModal(false)}>{t('common_cancel')}</Btn>
            <Btn
              onClick={async () => {
                if (!token || !cityName.trim()) return;
                if (editCity) {
                  await apiRequest(`/api/admin/cities/${editCity.id}`, { method: 'PATCH', token, body: { name: cityName }, success: t('loc_cityUpdated') });
                } else {
                  await apiRequest('/api/admin/cities', { method: 'POST', token, body: { name: cityName, regionId: cityParent }, success: t('loc_cityAdded') });
                }
                setCityModal(false);
                setOpenRegions((s) => ({ ...s, [cityParent]: true }));
                await loadCities(cityParent);
              }}
            >
              {t('common_save')}
            </Btn>
          </>
        }
      >
        <TextField label={t('loc_cityName')} value={cityName} onChange={setCityName} />
      </Modal>

      <Modal
        open={mfyModal}
        title={editMfy ? t('loc_editMfy') : t('loc_newMfy')}
        onClose={() => setMfyModal(false)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setMfyModal(false)}>{t('common_cancel')}</Btn>
            <Btn
              onClick={async () => {
                if (!token || !mfyName.trim()) return;
                if (editMfy) {
                  await apiRequest(`/api/admin/mfys/${editMfy.id}`, { method: 'PATCH', token, body: { name: mfyName, pickupAddress: addr }, success: t('loc_mfyUpdated') });
                } else {
                  await apiRequest('/api/admin/mfys', { method: 'POST', token, body: { cityId: mfyParent, name: mfyName, pickupAddress: addr }, success: t('loc_mfyAdded') });
                }
                setMfyModal(false);
                setOpenCities((s) => ({ ...s, [mfyParent]: true }));
                await loadMfys(mfyParent);
              }}
            >
              {t('common_save')}
            </Btn>
          </>
        }
      >
        <div className="space-y-3">
          <TextField label={t('loc_mfyName')} value={mfyName} onChange={setMfyName} />
          <TextField label={t('loc_pickupAddrLong')} value={addr} onChange={setAddr} />
        </div>
      </Modal>

      <Modal
        open={Boolean(removeRegion)}
        title={t('loc_delRegion')}
        onClose={() => setRemoveRegion(null)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setRemoveRegion(null)}>{t('common_cancel')}</Btn>
            <Btn
              variant="danger"
              onClick={async () => {
                if (!token || !removeRegion) return;
                await apiRequest(`/api/admin/regions/${removeRegion.id}`, { method: 'DELETE', token, success: t('loc_regionDeleted') });
                setRemoveRegion(null);
                await loadRegions();
              }}
            >
              {t('common_delete')}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-[#5C6B63]">{t('loc_delRegionBody', { name: removeRegion?.name ?? '' })}</p>
      </Modal>

      <Modal
        open={Boolean(removeCity)}
        title={t('loc_delCity')}
        onClose={() => setRemoveCity(null)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setRemoveCity(null)}>{t('common_cancel')}</Btn>
            <Btn
              variant="danger"
              onClick={async () => {
                if (!token || !removeCity) return;
                const regionId = removeCity.regionId || cityParent;
                await apiRequest(`/api/admin/cities/${removeCity.id}`, { method: 'DELETE', token, success: t('loc_cityDeleted') });
                setRemoveCity(null);
                if (regionId) await loadCities(regionId);
              }}
            >
              {t('common_delete')}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-[#5C6B63]">{t('loc_delCityBody', { name: removeCity?.name ?? '' })}</p>
      </Modal>

      <Modal
        open={Boolean(removeMfy)}
        title={t('loc_delMfy')}
        onClose={() => setRemoveMfy(null)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setRemoveMfy(null)}>{t('common_cancel')}</Btn>
            <Btn
              variant="danger"
              onClick={async () => {
                if (!token || !removeMfy) return;
                const cityId = removeMfy.cityId;
                await apiRequest(`/api/admin/mfys/${removeMfy.id}`, { method: 'DELETE', token, success: t('loc_mfyDeleted') });
                setRemoveMfy(null);
                await loadMfys(cityId);
              }}
            >
              {t('common_delete')}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-[#5C6B63]">{t('loc_delMfyBody', { name: removeMfy?.name ?? '' })}</p>
      </Modal>
    </div>
  );
}
