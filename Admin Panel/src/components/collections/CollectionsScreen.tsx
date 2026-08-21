import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { errText, useI18n } from '@/src/i18n';
import { Alert, Btn, DataTable, FilterChips, IconBtn, Modal, SelectField, StatusBadge, Td, TextField, Th } from '@/src/components/ui/Panel';
import { PHOTO_SLOT_COUNT, PhotoSlots } from '@/src/components/collections/PhotoSlots';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { formatCurrency } from '@/src/lib/utils';
import type { GroupBuy, Product } from '@/src/types';

type Filter = 'all' | 'open' | 'closed' | 'in_fulfillment' | 'done';

export function CollectionsScreen() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [items, setItems] = useState<GroupBuy[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [minVolume, setMinVolume] = useState('1');
  const [files, setFiles] = useState<(File | null)[]>(() => Array(PHOTO_SLOT_COUNT).fill(null));
  const [urls, setUrls] = useState<(string | null)[]>(() => Array(PHOTO_SLOT_COUNT).fill(null));
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmClose, setConfirmClose] = useState<GroupBuy | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<GroupBuy | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GroupBuy | null>(null);

  const selected = products.find((p) => p.id === productId);

  const statusMeta = (status: string): { label: string; tone: 'open' | 'wait' | 'ok' | 'done' | 'danger' } => {
    if (status === 'open') return { label: t('st_open'), tone: 'open' };
    if (status === 'closed' || status === 'ready_for_payment') return { label: t('st_waitCourier'), tone: 'wait' };
    if (status === 'in_fulfillment') return { label: t('st_courierTook'), tone: 'ok' };
    if (status === 'cancelled') return { label: t('st_cancelled'), tone: 'danger' };
    if (status === 'completed') return { label: t('st_completed'), tone: 'done' };
    return { label: status, tone: 'done' };
  };

  const load = useCallback(async () => {
    if (!token) return;
    const [g, p] = await Promise.all([
      apiRequest<{ items: GroupBuy[] }>('/api/group-buys', { token }),
      apiRequest<{ items: Product[] }>('/api/admin/products', { token }),
    ]);
    setItems(g.items || []);
    setProducts(p.items || []);
  }, [token]);

  useEffect(() => {
    void load().catch((e) => setError(errText(e)));
  }, [load]);

  const reset = () => {
    setEditId(null);
    setProductId('');
    setMinVolume('1');
    setFiles(Array(PHOTO_SLOT_COUNT).fill(null));
    setUrls(Array(PHOTO_SLOT_COUNT).fill(null));
    setError(null);
  };

  const openEdit = (g: GroupBuy) => {
    setError(null);
    setEditId(g.id);
    setProductId(g.productId || '');
    setMinVolume(String(g.minVolume || 1));
    setFiles(Array(PHOTO_SLOT_COUNT).fill(null));
    const shots = (g.photoUrls && g.photoUrls.length ? g.photoUrls : g.photoUrl ? [g.photoUrl] : []).slice(0, PHOTO_SLOT_COUNT);
    setUrls([...shots, ...Array(PHOTO_SLOT_COUNT - shots.length).fill(null)]);
    setOpen(true);
  };

  const photoCount = files.filter(Boolean).length + urls.filter((u, i) => Boolean(u) && !files[i]).length;

  const counts = useMemo(() => {
    const isClosed = (s: string) => s === 'closed' || s === 'ready_for_payment';
    return {
      all: items.length,
      open: items.filter((g) => g.status === 'open').length,
      closed: items.filter((g) => isClosed(g.status)).length,
      in_fulfillment: items.filter((g) => g.status === 'in_fulfillment').length,
      done: items.filter((g) => g.status === 'completed' || g.status === 'cancelled').length,
    };
  }, [items]);

  const visible = items.filter((g) => {
    if (filter === 'all') return true;
    if (filter === 'open') return g.status === 'open';
    if (filter === 'closed') return g.status === 'closed' || g.status === 'ready_for_payment';
    if (filter === 'in_fulfillment') return g.status === 'in_fulfillment';
    return g.status === 'completed' || g.status === 'cancelled';
  });

  const create = async () => {
    if (!token || !productId) {
      setError(t('col_pickProduct'));
      return;
    }
    if (photoCount < 1) {
      setError(t('col_need5photos'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('productId', productId);
      form.append('minVolume', minVolume || '1');
      let slot = 0;
      for (let i = 0; i < PHOTO_SLOT_COUNT; i++) {
        const f = files[i];
        const u = urls[i];
        if (f) {
          form.append(`photo_${slot}`, f);
          slot += 1;
        } else if (u) {
          form.append(`keep_${slot}`, u);
          slot += 1;
        }
      }
      if (editId) {
        await apiRequest(`/api/admin/group-buys/${editId}`, { method: 'PATCH', token, form, success: t('col_updated') });
      } else {
        await apiRequest('/api/admin/group-buys', { method: 'POST', token, form, success: t('col_opened') });
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

  const closeCollection = async () => {
    if (!token || !confirmClose) return;
    await apiRequest(`/api/admin/group-buys/${confirmClose.id}/close`, {
      method: 'POST',
      token,
      body: {},
      success: t('col_closedOk'),
    });
    setConfirmClose(null);
    await load();
  };

  const cancelCollection = async () => {
    if (!token || !confirmCancel) return;
    await apiRequest(`/api/admin/group-buys/${confirmCancel.id}/cancel`, {
      method: 'POST',
      token,
      body: {},
      success: t('col_cancelledOk'),
    });
    setConfirmCancel(null);
    await load();
  };

  const deleteCollection = async () => {
    if (!token || !confirmDelete) return;
    await apiRequest(`/api/admin/group-buys/${confirmDelete.id}`, {
      method: 'DELETE',
      token,
      success: t('col_deleted'),
    });
    setConfirmDelete(null);
    await load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">{t('col_kicker')}</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink">{t('col_title')}</h1>
          <p className="text-sm text-[#5C6B63] mt-1">{t('col_hint')}</p>
        </div>
        <Btn
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          <Plus size={16} /> {t('col_new')}
        </Btn>
      </div>

      <FilterChips
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        options={[
          { id: 'all', label: t('common_all'), count: counts.all },
          { id: 'open', label: t('col_filterOpen'), count: counts.open },
          { id: 'closed', label: t('col_filterWait'), count: counts.closed },
          { id: 'in_fulfillment', label: t('col_filterCourier'), count: counts.in_fulfillment },
          { id: 'done', label: t('col_filterDone'), count: counts.done },
        ]}
      />

      <DataTable>
        <thead>
          <tr>
            <Th>{t('col_collection')}</Th>
            <Th>{t('common_status')}</Th>
            <Th className="hidden md:table-cell">{t('common_price')}</Th>
            <Th>{t('col_volume')}</Th>
            <Th className="hidden sm:table-cell">{t('col_progress')}</Th>
            <Th className="text-right">{t('common_actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {visible.map((g) => {
            const pct = Math.min(100, Math.round((g.currentVolume / Math.max(1, g.minVolume)) * 100));
            const meta = statusMeta(g.status);
            return (
              <tr key={g.id} className="hover:bg-[#FBF8F1]">
                <Td>
                  <div className="flex items-center gap-3">
                    {g.photoUrl ? <img src={g.photoUrl} alt="" className="w-11 h-11 rounded-xl object-cover" /> : null}
                    <div>
                      <p className="font-bold">{g.title}</p>
                      <p className="text-xs text-[#5C6B63]">{g.unitLabel}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </Td>
                <Td className="hidden md:table-cell whitespace-nowrap">{formatCurrency(g.unitPriceUzs)}</Td>
                <Td>
                  {g.currentVolume}/{g.minVolume} {g.unitLabel}
                </Td>
                <Td className="min-w-[140px] hidden sm:table-cell">
                  <div className="h-2 bg-[#F0E8D8] rounded-full overflow-hidden">
                    <div className="h-full bg-brand-700 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <div className="inline-flex flex-wrap items-center justify-end gap-1">
                    {g.status === 'open' ? (
                      <IconBtn title={t('common_edit')} onClick={() => openEdit(g)}>
                        <Pencil size={16} />
                      </IconBtn>
                    ) : null}
                    {g.status !== 'in_fulfillment' ? (
                      <IconBtn title={t('common_delete')} danger onClick={() => setConfirmDelete(g)}>
                        <Trash2 size={16} />
                      </IconBtn>
                    ) : null}
                    {g.status === 'open' ? (
                      <>
                        <Btn variant="gold" className="!py-1.5 !px-3" onClick={() => setConfirmClose(g)}>
                          {t('col_close')}
                        </Btn>
                        <Btn variant="outline" className="!py-1.5 !px-3" onClick={() => setConfirmCancel(g)}>
                          {t('st_cancelled')}
                        </Btn>
                      </>
                    ) : null}
                  </div>
                </Td>
              </tr>
            );
          })}
          {visible.length === 0 ? (
            <tr>
              <Td colSpan={6} className="text-[#5C6B63]">
                {items.length === 0 ? t('col_empty') : t('col_emptyFilter')}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </DataTable>

      <Modal
        open={open}
        wide
        title={editId ? t('col_edit') : t('col_new')}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        footer={
          <>
            <Btn variant="outline" onClick={() => { setOpen(false); reset(); }}>{t('common_cancel')}</Btn>
            <Btn disabled={busy || photoCount < 1} onClick={() => void create()}>
              {busy ? t('common_saving') : editId ? t('common_save') : t('common_open')}
            </Btn>
          </>
        }
      >
        {error ? <Alert>{error}</Alert> : null}
        <div className="space-y-3">
          <SelectField
            label={t('col_product')}
            value={productId}
            onChange={setProductId}
            options={[{ label: t('common_select'), value: '' }, ...products.map((p) => ({ label: `${p.name} — ${formatCurrency(p.unitPriceUzs)}`, value: p.id }))]}
          />
          {selected ? (
            <p className="text-sm text-[#5C6B63]">
              {formatCurrency(selected.unitPriceUzs)} / {selected.unitLabel}
            </p>
          ) : null}
          <TextField label={t('col_minVol')} value={minVolume} onChange={setMinVolume} type="number" />
          <p className="text-xs text-[#5C6B63] -mt-1">{t('col_minHint')}</p>
          <PhotoSlots files={files} urls={urls} onChange={setFiles} onUrlsChange={setUrls} />
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmClose)}
        title={t('col_closeTitle')}
        onClose={() => setConfirmClose(null)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setConfirmClose(null)}>{t('common_cancel')}</Btn>
            <Btn variant="gold" onClick={() => void closeCollection()}>{t('col_close')}</Btn>
          </>
        }
      >
        <p className="text-sm text-[#5C6B63] leading-6">
          {t('col_closeBody', { title: confirmClose?.title ?? '' })}
        </p>
      </Modal>

      <Modal
        open={Boolean(confirmCancel)}
        title={t('col_cancelTitle')}
        onClose={() => setConfirmCancel(null)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setConfirmCancel(null)}>{t('col_keep')}</Btn>
            <Btn variant="danger" onClick={() => void cancelCollection()}>{t('common_cancel')}</Btn>
          </>
        }
      >
        <p className="text-sm text-[#5C6B63] leading-6">
          {t('col_cancelBody', { title: confirmCancel?.title ?? '' })}
        </p>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        title={t('col_del')}
        onClose={() => setConfirmDelete(null)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setConfirmDelete(null)}>{t('common_cancel')}</Btn>
            <Btn variant="danger" onClick={() => void deleteCollection()}>{t('common_delete')}</Btn>
          </>
        }
      >
        <p className="text-sm text-[#5C6B63] leading-6">
          {t('col_delBody', { title: confirmDelete?.title ?? '' })}
        </p>
      </Modal>
    </div>
  );
}
