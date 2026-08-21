import { Fragment, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { errText, useI18n } from '@/src/i18n';
import { Alert, Btn, DataTable, IconBtn, Modal, Td, TextField, Th } from '@/src/components/ui/Panel';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import type { Category, Subcategory } from '@/src/types';

export function CategoriesScreen() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [cats, setCats] = useState<Category[]>([]);
  const [subsByCat, setSubsByCat] = useState<Record<string, Subcategory[]>>({});
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [removeCat, setRemoveCat] = useState<Category | null>(null);

  const [subParentId, setSubParentId] = useState('');
  const [subOpen, setSubOpen] = useState(false);
  const [subName, setSubName] = useState('');
  const [editSub, setEditSub] = useState<Subcategory | null>(null);
  const [removeSub, setRemoveSub] = useState<Subcategory | null>(null);

  const loadCats = useCallback(async () => {
    if (!token) return;
    const d = await apiRequest<{ items: Category[] }>('/api/admin/categories', { token });
    setCats(d.items || []);
  }, [token]);

  const loadSubs = useCallback(async (id: string) => {
    if (!token) return;
    const d = await apiRequest<{ items: Subcategory[] }>(`/api/admin/subcategories?categoryId=${id}`, { token });
    setSubsByCat((prev) => ({ ...prev, [id]: d.items || [] }));
  }, [token]);

  useEffect(() => {
    void loadCats().catch((e) => setError(errText(e)));
  }, [loadCats]);

  const toggle = async (id: string) => {
    const next = !openIds[id];
    setOpenIds((s) => ({ ...s, [id]: next }));
    if (next && !subsByCat[id]) await loadSubs(id);
  };

  const saveCat = async () => {
    if (!token || !catName.trim()) return;
    try {
      if (editCat) {
        await apiRequest(`/api/admin/categories/${editCat.id}`, { method: 'PATCH', token, body: { name: catName }, success: t('cat_updated') });
      } else {
        await apiRequest('/api/admin/categories', { method: 'POST', token, body: { name: catName }, success: t('cat_added') });
      }
      setCatOpen(false);
      setEditCat(null);
      setCatName('');
      await loadCats();
    } catch (e) {
      setError(errText(e));
    }
  };

  const saveSub = async () => {
    if (!token || !subName.trim() || !subParentId) return;
    try {
      if (editSub) {
        await apiRequest(`/api/admin/subcategories/${editSub.id}`, { method: 'PATCH', token, body: { name: subName }, success: t('cat_subUpdated') });
      } else {
        await apiRequest('/api/admin/subcategories', { method: 'POST', token, body: { categoryId: subParentId, name: subName }, success: t('cat_subAdded') });
      }
      setSubOpen(false);
      setEditSub(null);
      setSubName('');
      await loadSubs(subParentId);
      setOpenIds((s) => ({ ...s, [subParentId]: true }));
    } catch (e) {
      setError(errText(e));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">{t('cat_kicker')}</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink">{t('cat_title')}</h1>
          <p className="text-sm text-[#5C6B63] mt-1">{t('cat_hint')}</p>
        </div>
        <Btn
          onClick={() => {
            setEditCat(null);
            setCatName('');
            setCatOpen(true);
          }}
        >
          <Plus size={16} /> {t('cat_add')}
        </Btn>
      </div>
      {error ? <Alert>{error}</Alert> : null}

      <DataTable>
        <thead>
          <tr>
            <Th>{t('common_name')}</Th>
            <Th className="w-44 text-right">{t('common_actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {cats.map((c) => {
            const open = Boolean(openIds[c.id]);
            const subs = subsByCat[c.id] || [];
            return (
              <Fragment key={c.id}>
                <tr key={c.id} className="hover:bg-[#FBF8F1] cursor-pointer" onClick={() => void toggle(c.id)}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-brand-800 inline-flex">
                        <ChevronRight size={18} />
                      </motion.span>
                      <span className="font-bold">{c.name}</span>
                      <span className="text-xs text-[#5C6B63] bg-cream px-2 py-0.5 rounded-lg">
                        {subsByCat[c.id] ? subs.length : ''}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <IconBtn
                      title={t('cat_addSub')}
                      onClick={() => {
                        setSubParentId(c.id);
                        setEditSub(null);
                        setSubName('');
                        setSubOpen(true);
                      }}
                    >
                      <Plus size={16} />
                    </IconBtn>
                    <IconBtn
                      title={t('common_edit')}
                      onClick={() => {
                        setEditCat(c);
                        setCatName(c.name);
                        setCatOpen(true);
                      }}
                    >
                      <Pencil size={16} />
                    </IconBtn>
                    <IconBtn title={t('common_delete')} danger onClick={() => setRemoveCat(c)}>
                      <Trash2 size={16} />
                    </IconBtn>
                  </Td>
                </tr>
                <tr key={`${c.id}-kids`} className={!open ? 'hidden' : undefined}>
                  <Td colSpan={2} className="bg-[#FBF8F1] p-0">
                    <AnimatePresence>
                      {open ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <table className="w-full text-sm">
                            <tbody>
                              {subs.map((s) => (
                                <tr key={s.id} className="hover:bg-white/70">
                                  <td className="pl-6 md:pl-12 pr-4 py-2.5 border-t border-[#EDE4D4] font-medium">{s.name}</td>
                                  <td className="pr-4 py-2.5 border-t border-[#EDE4D4] text-right whitespace-nowrap w-44">
                                    <IconBtn
                                      title={t('common_edit')}
                                      onClick={() => {
                                        setSubParentId(c.id);
                                        setEditSub(s);
                                        setSubName(s.name);
                                        setSubOpen(true);
                                      }}
                                    >
                                      <Pencil size={16} />
                                    </IconBtn>
                                    <IconBtn title={t('common_delete')} danger onClick={() => setRemoveSub(s)}>
                                      <Trash2 size={16} />
                                    </IconBtn>
                                  </td>
                                </tr>
                              ))}
                              {subs.length === 0 ? (
                                <tr>
                                  <td className="pl-6 md:pl-12 pr-4 py-3 text-[#5C6B63] border-t border-[#EDE4D4]" colSpan={2}>
                                    {t('cat_noSub')}
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
          {cats.length === 0 ? (
            <tr>
              <Td colSpan={2} className="text-[#5C6B63]">{t('cat_empty')}</Td>
            </tr>
          ) : null}
        </tbody>
      </DataTable>

      <Modal
        open={catOpen}
        title={editCat ? t('cat_edit') : t('cat_new')}
        onClose={() => setCatOpen(false)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setCatOpen(false)}>{t('common_cancel')}</Btn>
            <Btn onClick={() => void saveCat()}>{t('common_save')}</Btn>
          </>
        }
      >
        <TextField label={t('common_name')} value={catName} onChange={setCatName} placeholder={t('cat_ph')} />
      </Modal>

      <Modal
        open={subOpen}
        title={editSub ? t('cat_subEdit') : t('cat_subNew')}
        onClose={() => setSubOpen(false)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setSubOpen(false)}>{t('common_cancel')}</Btn>
            <Btn onClick={() => void saveSub()}>{t('common_save')}</Btn>
          </>
        }
      >
        <TextField label={t('common_name')} value={subName} onChange={setSubName} placeholder={t('cat_subPh')} />
      </Modal>

      <Modal
        open={Boolean(removeCat)}
        title={t('cat_del')}
        onClose={() => setRemoveCat(null)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setRemoveCat(null)}>{t('common_cancel')}</Btn>
            <Btn
              variant="danger"
              onClick={async () => {
                if (!token || !removeCat) return;
                await apiRequest(`/api/admin/categories/${removeCat.id}`, { method: 'DELETE', token });
                setRemoveCat(null);
                await loadCats();
              }}
            >
              {t('common_delete')}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-[#5C6B63]">{t('cat_delBody', { name: removeCat?.name ?? '' })}</p>
      </Modal>

      <Modal
        open={Boolean(removeSub)}
        title={t('cat_subDel')}
        onClose={() => setRemoveSub(null)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setRemoveSub(null)}>{t('common_cancel')}</Btn>
            <Btn
              variant="danger"
              onClick={async () => {
                if (!token || !removeSub) return;
                await apiRequest(`/api/admin/subcategories/${removeSub.id}`, { method: 'DELETE', token });
                const parent = removeSub.categoryId;
                setRemoveSub(null);
                await loadSubs(parent);
              }}
            >
              {t('common_delete')}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-[#5C6B63]">{t('cat_subDelBody', { name: removeSub?.name ?? '' })}</p>
      </Modal>
    </div>
  );
}
