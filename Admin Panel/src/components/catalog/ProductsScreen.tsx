import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { errText, useI18n } from '@/src/i18n';
import { Alert, Btn, DataTable, IconBtn, Modal, SelectField, Td, TextField, Th } from '@/src/components/ui/Panel';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest, mediaUrl } from '@/src/lib/api';
import { formatCurrency } from '@/src/lib/utils';
import type { Category, Product, Subcategory } from '@/src/types';

export function ProductsScreen() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [cats, setCats] = useState<Category[]>([]);
  const [subs, setSubs] = useState<Subcategory[]>([]);
  const [items, setItems] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitLabel, setUnitLabel] = useState('dona');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const [c, p] = await Promise.all([
      apiRequest<{ items: Category[] }>('/api/admin/categories', { token }),
      apiRequest<{ items: Product[] }>('/api/admin/products', { token }),
    ]);
    setCats(c.items || []);
    setItems(p.items || []);
  }, [token]);

  useEffect(() => {
    void load().catch((e) => setError(errText(e)));
  }, [load]);

  useEffect(() => {
    if (!token || !categoryId) {
      setSubs([]);
      return;
    }
    void apiRequest<{ items: Subcategory[] }>(`/api/admin/subcategories?categoryId=${categoryId}`, { token }).then((d) =>
      setSubs(d.items || [])
    );
  }, [categoryId, token]);

  const resetForm = () => {
    setEditId(null);
    setCategoryId('');
    setSubcategoryId('');
    setName('');
    setDescription('');
    setUnitLabel('dona');
    setPrice('');
    setStock('1');
    setPhotoFile(null);
    setPhotoUrl(null);
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setError(null);
    setEditId(p.id);
    setCategoryId(p.categoryId || '');
    setSubcategoryId(p.subcategoryId);
    setName(p.name);
    setDescription(p.description);
    setUnitLabel(p.unitLabel);
    setPrice(String(p.unitPriceUzs));
    setStock(String(p.stock ?? 0));
    setPhotoFile(null);
    setPhotoUrl(p.photoUrl || null);
    setOpen(true);
  };

  const save = async () => {
    if (!token || !subcategoryId || !name.trim()) {
      setError(t('prod_need'));
      return;
    }
    if (!photoFile && !photoUrl) {
      setError(t('prod_needPhoto'));
      return;
    }
    setBusy(true);
    setError(null);
    const qty = Math.max(0, Math.trunc(Number(stock)) || 0);
    const form = new FormData();
    form.append('subcategoryId', subcategoryId);
    form.append('name', name);
    form.append('description', description);
    form.append('unitLabel', unitLabel);
    form.append('unitPriceUzs', String(Number(price) || 0));
    form.append('stock', String(qty));
    if (photoFile) form.append('photo', photoFile);
    else if (photoUrl) form.append('keepPhoto', photoUrl);
    try {
      if (editId) {
        await apiRequest(`/api/admin/products/${editId}`, { method: 'PATCH', token, form, success: t('prod_updated') });
      } else {
        await apiRequest('/api/admin/products', { method: 'POST', token, form, success: t('prod_added') });
      }
      setOpen(false);
      resetForm();
      await load();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!token || !removeId) return;
    await apiRequest(`/api/admin/products/${removeId}`, { method: 'DELETE', token });
    setRemoveId(null);
    await load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">{t('prod_kicker')}</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink">{t('prod_title')}</h1>
          <p className="text-sm text-[#5C6B63] mt-1">{t('prod_hint')}</p>
        </div>
        <Btn onClick={openCreate}>
          <Plus size={16} /> {t('prod_new')}
        </Btn>
      </div>

      <DataTable>
        <thead>
          <tr>
            <Th>{t('prod_col')}</Th>
            <Th className="hidden lg:table-cell">{t('prod_category')}</Th>
            <Th className="hidden md:table-cell">{t('prod_sub')}</Th>
            <Th className="hidden sm:table-cell">{t('common_unit')}</Th>
            <Th>{t('prod_stock')}</Th>
            <Th>{t('common_price')}</Th>
            <Th className="hidden md:table-cell">{t('common_status')}</Th>
            <Th className="text-right">{t('common_actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="hover:bg-[#FBF8F1]">
              <Td>
                <div className="flex items-center gap-3">
                  {p.photoUrl ? (
                    <img src={mediaUrl(p.photoUrl)} alt="" className="w-11 h-11 rounded-xl object-cover bg-[#F6F1E8]" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-[#F6F1E8]" />
                  )}
                  <div>
                    <p className="font-bold">{p.name}</p>
                    {p.description ? <p className="text-xs text-[#5C6B63] mt-0.5 line-clamp-1">{p.description}</p> : null}
                  </div>
                </div>
              </Td>
              <Td className="hidden lg:table-cell">{p.categoryName}</Td>
              <Td className="hidden md:table-cell">{p.subcategoryName}</Td>
              <Td className="hidden sm:table-cell">{p.unitLabel}</Td>
              <Td>{p.stock}</Td>
              <Td className="whitespace-nowrap">{formatCurrency(p.unitPriceUzs)}</Td>
              <Td className="hidden md:table-cell">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${p.active ? 'bg-brand-50 text-brand-800' : 'bg-danger-50 text-danger-500'}`}>
                  {p.active ? t('common_active') : t('common_inactive')}
                </span>
              </Td>
              <Td className="text-right whitespace-nowrap">
                <IconBtn title={t('common_edit')} onClick={() => openEdit(p)}>
                  <Pencil size={16} />
                </IconBtn>
                <IconBtn title={t('common_delete')} danger onClick={() => setRemoveId(p.id)}>
                  <Trash2 size={16} />
                </IconBtn>
              </Td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <Td colSpan={7} className="text-[#5C6B63] py-10 text-center">
                {t('prod_empty')}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </DataTable>

      <Modal
        open={open}
        title={editId ? t('prod_edit') : t('prod_new')}
        onClose={() => { setOpen(false); resetForm(); }}
        footer={
          <>
            <Btn variant="outline" onClick={() => { setOpen(false); resetForm(); }}>{t('common_cancel')}</Btn>
            <Btn disabled={busy} onClick={() => void save()}>{busy ? t('common_saving') : t('common_save')}</Btn>
          </>
        }
      >
        {error ? <Alert>{error}</Alert> : null}
        <div className="space-y-3">
          <SelectField
            label={t('prod_category')}
            value={categoryId}
            onChange={(v) => {
              setCategoryId(v);
              setSubcategoryId('');
            }}
            options={[{ label: t('common_select'), value: '' }, ...cats.map((c) => ({ label: c.name, value: c.id }))]}
          />
          <SelectField
            label={t('prod_sub')}
            value={subcategoryId}
            onChange={setSubcategoryId}
            options={[{ label: categoryId ? t('common_select') : t('common_selectCategoryFirst'), value: '' }, ...subs.map((s) => ({ label: s.name, value: s.id }))]}
          />
          <TextField label={t('common_name')} value={name} onChange={setName} />
          <TextField label={t('common_description')} value={description} onChange={setDescription} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TextField label={t('common_unit')} value={unitLabel} onChange={setUnitLabel} />
            <TextField label={t('prod_stock')} value={stock} onChange={setStock} type="number" />
            <TextField label={t('prod_priceSom')} value={price} onChange={setPrice} type="number" />
          </div>
          <p className="text-xs text-[#5C6B63] -mt-1">{t('prod_stockHint')}</p>
          <div>
            <p className="text-sm font-medium text-[#3d4a43] mb-1.5">{t('prod_photo')}</p>
            <input
              ref={photoInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setPhotoFile(f);
                if (f) setPhotoUrl(null);
              }}
            />
            <div className="relative w-full max-w-[220px] aspect-square overflow-hidden rounded-2xl border-2 border-dashed border-[#E8DFD0] bg-[#FBF8F1]">
              {photoFile || photoUrl ? (
                <img
                  src={photoFile ? URL.createObjectURL(photoFile) : mediaUrl(photoUrl)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 hover:bg-white/40"
                >
                  <ImagePlus size={28} className="text-brand-800" />
                  <span className="text-sm font-bold text-brand-900">{t('prod_photo')}</span>
                </button>
              )}
              {photoFile || photoUrl ? (
                <div className="absolute inset-x-0 bottom-0 p-1.5 flex gap-1 bg-gradient-to-t from-black/55 to-transparent">
                  <button
                    type="button"
                    onClick={() => photoInput.current?.click()}
                    className="flex-1 h-8 rounded-lg bg-white/95 text-[#0B3D2E] text-[11px] font-bold"
                  >
                    {t('common_edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoUrl(null);
                      if (photoInput.current) photoInput.current.value = '';
                    }}
                    className="flex-1 h-8 rounded-lg bg-white/95 text-danger-500 text-[11px] font-bold"
                  >
                    {t('common_delete')}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(removeId)}
        title={t('prod_del')}
        onClose={() => setRemoveId(null)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setRemoveId(null)}>{t('common_cancel')}</Btn>
            <Btn variant="danger" onClick={() => void remove()}>{t('common_delete')}</Btn>
          </>
        }
      >
        <p className="text-sm text-[#5C6B63]">{t('prod_delBody')}</p>
      </Modal>
    </div>
  );
}
