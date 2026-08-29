import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { errText, useI18n } from '@/src/i18n';
import { Alert, Btn, DataTable, FilterChips, IconBtn, Modal, SelectField, StatusBadge, Td, TextField, Th } from '@/src/components/ui/Panel';
import { PHOTO_SLOT_COUNT, PhotoSlots } from '@/src/components/collections/PhotoSlots';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest, mediaUrl } from '@/src/lib/api';
import { formatCurrency } from '@/src/lib/utils';
import type { GroupBuy, Product } from '@/src/types';

type Filter = 'all' | 'open' | 'closed' | 'in_fulfillment' | 'done';
type Kind = 'product' | 'combo';
type ComboLine = { productId: string; quantity: string };

const emptyLine = (): ComboLine => ({ productId: '', quantity: '1' });

function comboPreview(products: Product[], lines: ComboLine[]) {
  let price = 0;
  let stock = Number.POSITIVE_INFINITY;
  let count = 0;
  for (const line of lines) {
    const p = products.find((x) => x.id === line.productId);
    if (!p) continue;
    const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
    price += p.unitPriceUzs * qty;
    stock = Math.min(stock, Math.floor(p.stock / qty));
    count += 1;
  }
  return { price, stock: Number.isFinite(stock) ? stock : 0, count };
}

export function CollectionsScreen() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [items, setItems] = useState<GroupBuy[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('product');
  const [productId, setProductId] = useState('');
  const [comboTitle, setComboTitle] = useState('');
  const [comboLines, setComboLines] = useState<ComboLine[]>([emptyLine(), emptyLine()]);
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
  const preview = useMemo(() => comboPreview(products, comboLines), [products, comboLines]);

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
    setKind('product');
    setProductId('');
    setComboTitle('');
    setComboLines([emptyLine(), emptyLine()]);
    setMinVolume('1');
    setFiles(Array(PHOTO_SLOT_COUNT).fill(null));
    setUrls(Array(PHOTO_SLOT_COUNT).fill(null));
    setError(null);
  };

  const openEdit = (g: GroupBuy) => {
    setError(null);
    setEditId(g.id);
    const isCombo = g.kind === 'combo';
    setKind(isCombo ? 'combo' : 'product');
    setProductId(g.productId || '');
    setComboTitle(isCombo ? g.title : '');
    if (isCombo && g.items && g.items.length > 0) {
      setComboLines(g.items.map((it) => ({ productId: it.productId, quantity: String(it.quantity || 1) })));
    } else {
      setComboLines([emptyLine(), emptyLine()]);
    }
    setMinVolume(String(g.minVolume || 1));
    setFiles(Array(PHOTO_SLOT_COUNT).fill(null));
    const shots = (g.photoUrls && g.photoUrls.length ? g.photoUrls : g.photoUrl ? [g.photoUrl] : []).slice(0, PHOTO_SLOT_COUNT);
    setUrls([...shots, ...Array(PHOTO_SLOT_COUNT - shots.length).fill(null)]);
    setOpen(true);
  };

  const photoCount = files.filter(Boolean).length + urls.filter((u, i) => Boolean(u) && !files[i]).length;
  const hasProductPhoto =
    kind === 'product'
      ? Boolean(selected?.photoUrl)
      : comboLines.some((l) => Boolean(products.find((p) => p.id === l.productId)?.photoUrl));
  const canSubmitPhotos = photoCount >= 1 || hasProductPhoto;

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

  const setLine = (index: number, patch: Partial<ComboLine>) => {
    setComboLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const create = async () => {
    if (!token) return;
    if (kind === 'product' && !productId) {
      setError(t('col_pickProduct'));
      return;
    }
    if (kind === 'combo') {
      const packed = comboLines
        .map((l) => ({ productId: l.productId, quantity: Math.max(1, parseInt(l.quantity, 10) || 1) }))
        .filter((l) => l.productId);
      if (packed.length < 2) {
        setError(t('col_pickCombo'));
        return;
      }
      const ids = packed.map((l) => l.productId);
      if (new Set(ids).size !== ids.length) {
        setError(t('col_comboDup'));
        return;
      }
    }
    const hasProductPhoto =
      kind === 'product'
        ? Boolean(selected?.photoUrl)
        : comboLines.some((l) => products.find((p) => p.id === l.productId)?.photoUrl);
    if (photoCount < 1 && !hasProductPhoto) {
      setError(t('col_needPhotoOrProduct'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('minVolume', minVolume || '1');
      if (kind === 'combo') {
        const packed = comboLines
          .map((l) => ({ productId: l.productId, quantity: Math.max(1, parseInt(l.quantity, 10) || 1) }))
          .filter((l) => l.productId);
        form.append('title', comboTitle.trim());
        form.append('items', JSON.stringify(packed));
      } else {
        form.append('productId', productId);
      }
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
            <Th>{t('col_ordersVsGoal')}</Th>
            <Th className="hidden sm:table-cell">{t('col_progress')}</Th>
            <Th className="text-right">{t('common_actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {visible.map((g) => {
            const pct = Math.min(100, Math.round((g.currentVolume / Math.max(1, g.minVolume)) * 100));
            const meta = statusMeta(g.status);
            const cover = g.photoUrl || g.items?.find((it) => it.photoUrl)?.photoUrl;
            const comboItems = g.kind === 'combo' ? g.items ?? [] : [];
            return (
              <tr key={g.id} className="hover:bg-[#FBF8F1]">
                <Td>
                  <div className="flex items-center gap-3">
                    {cover ? <img src={mediaUrl(cover)} alt="" className="w-11 h-11 rounded-xl object-cover bg-[#F6F1E8]" /> : <div className="w-11 h-11 rounded-xl bg-[#F6F1E8]" />}
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-bold">{g.title}</p>
                        {g.kind === 'combo' ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-[#F6F1E8] text-gold-700">
                            {t('col_kindCombo')}
                          </span>
                        ) : null}
                      </div>
                      {comboItems.length > 0 ? (
                        <p className="text-xs text-[#5C6B63]">
                          {comboItems.map((it) => `${it.name} ×${it.quantity}`).join(', ')}
                        </p>
                      ) : (
                        <p className="text-xs text-[#5C6B63]">{g.unitLabel}</p>
                      )}
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
                    <IconBtn title={t('common_delete')} danger onClick={() => setConfirmDelete(g)}>
                      <Trash2 size={16} />
                    </IconBtn>
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
            <Btn disabled={busy || !canSubmitPhotos} onClick={() => void create()}>
              {busy ? t('common_saving') : editId ? t('common_save') : t('common_open')}
            </Btn>
          </>
        }
      >
        {error ? <Alert>{error}</Alert> : null}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-[#5C6B63] mb-1.5">{t('col_kindHint')}</p>
            <div className="flex rounded-xl border border-[#E8DFD0] overflow-hidden">
              {(['product', 'combo'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 py-2 text-sm font-bold ${
                    kind === k ? 'bg-brand-700 text-white' : 'bg-white text-[#5C6B63] hover:bg-[#FBF8F1]'
                  }`}
                >
                  {k === 'product' ? t('col_kindProduct') : t('col_kindCombo')}
                </button>
              ))}
            </div>
          </div>

          {kind === 'product' ? (
            <>
              <SelectField
                label={t('col_product')}
                value={productId}
                onChange={(id) => {
                  setProductId(id);
                  const p = products.find((x) => x.id === id);
                  if (p?.photoUrl && !files[0] && !urls[0]) {
                    setUrls((prev) => {
                      const next = prev.slice();
                      next[0] = p.photoUrl || null;
                      return next;
                    });
                  }
                }}
                options={[{ label: t('common_select'), value: '' }, ...products.map((p) => ({ label: `${p.name} — ${formatCurrency(p.unitPriceUzs)}`, value: p.id }))]}
              />
              {selected ? (
                <div className="flex items-center gap-3">
                  {selected.photoUrl ? (
                    <img src={mediaUrl(selected.photoUrl)} alt="" className="w-14 h-14 rounded-xl object-cover bg-[#F6F1E8]" />
                  ) : null}
                  <p className="text-sm text-[#5C6B63]">
                    {formatCurrency(selected.unitPriceUzs)} / {selected.unitLabel}
                    {' · '}
                    {t('col_warehouse')}: {selected.stock} {selected.unitLabel}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <TextField label={t('col_comboTitle')} value={comboTitle} onChange={setComboTitle} />
              <p className="text-xs text-[#5C6B63] -mt-1">{t('col_comboHint')}</p>
              <div className="space-y-2">
                {comboLines.map((line, i) => {
                  const used = comboLines.map((l) => l.productId).filter(Boolean);
                  const p = products.find((x) => x.id === line.productId);
                  const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
                  const short = Boolean(p && p.stock < qty);
                  return (
                    <div key={i} className={`rounded-2xl border p-3 space-y-2 ${short ? 'border-red-300 bg-red-50/40' : 'border-[#E8DFD0]'}`}>
                      <div className="flex items-start gap-2">
                        {p?.photoUrl ? (
                          <img src={mediaUrl(p.photoUrl)} alt="" className="w-12 h-12 rounded-xl object-cover bg-[#F6F1E8] mt-6" />
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <SelectField
                            label={`${t('col_product')} ${i + 1}`}
                            value={line.productId}
                            onChange={(v) => setLine(i, { productId: v })}
                            options={[
                              { label: t('common_select'), value: '' },
                              ...products
                                .filter((x) => x.id === line.productId || !used.includes(x.id))
                                .map((x) => ({
                                  label: `${x.name} — ${t('col_warehouse')} ${x.stock}`,
                                  value: x.id,
                                })),
                            ]}
                          />
                        </div>
                        {comboLines.length > 2 ? (
                          <IconBtn
                            title={t('col_removeLine')}
                            danger
                            onClick={() => setComboLines((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 size={16} />
                          </IconBtn>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-36">
                          <TextField
                            label={t('col_perSet')}
                            value={line.quantity}
                            onChange={(v) => setLine(i, { quantity: v })}
                            type="number"
                          />
                        </div>
                        {p ? (
                          <p className="text-xs text-[#5C6B63] pb-2">
                            {formatCurrency(p.unitPriceUzs)} / {p.unitLabel}
                            {' · '}
                            {t('col_warehouse')}: {p.stock}
                          </p>
                        ) : null}
                      </div>
                      {short && p ? (
                        <p className="text-xs font-bold text-red-700">
                          {t('col_comboShort', { name: p.name, have: p.stock, unit: p.unitLabel, need: qty })}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
                <Btn
                  variant="outline"
                  className="w-full"
                  onClick={() => setComboLines((prev) => [...prev, emptyLine()])}
                >
                  <Plus size={16} /> {t('col_addProduct')}
                </Btn>
              </div>
              {preview.count >= 2 ? (
                <p className="text-sm text-[#5C6B63]">
                  {t('col_comboPrice')}: {formatCurrency(preview.price)}
                  {' · '}
                  {t('col_comboStock')}: {preview.stock}
                </p>
              ) : null}
            </>
          )}

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
