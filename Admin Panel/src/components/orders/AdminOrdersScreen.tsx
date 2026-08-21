import { useCallback, useEffect, useMemo, useState } from 'react';
import { errText, useI18n } from '@/src/i18n';
import { Alert, Btn, DataTable, FilterChips, Modal, StatusBadge, Td, TextField, Th } from '@/src/components/ui/Panel';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { formatCurrency } from '@/src/lib/utils';
import type { Order } from '@/src/types';

type Filter = 'all' | 'collecting' | 'awaiting_courier' | 'with_courier' | 'issued' | 'cancelled';

export function AdminOrdersScreen() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [items, setItems] = useState<Order[]>([]);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const statusMeta = (status: string): { label: string; tone: 'open' | 'wait' | 'ok' | 'done' | 'danger' } => {
    if (status === 'collecting') return { label: t('st_collecting'), tone: 'open' };
    if (status === 'awaiting_courier' || status === 'awaiting_payment') return { label: t('st_waitCourier'), tone: 'wait' };
    if (['with_courier', 'paid', 'pay_on_delivery', 'ready_for_pickup', 'out_for_delivery'].includes(status)) {
      return { label: t('st_withCourier'), tone: 'ok' };
    }
    if (status === 'issued') return { label: t('st_issued'), tone: 'done' };
    if (status === 'cancelled') return { label: t('st_cancelled'), tone: 'danger' };
    return { label: status, tone: 'done' };
  };

  const load = useCallback(async () => {
    if (!token) return;
    const d = await apiRequest<{ items: Order[] }>('/api/admin/orders', { token });
    setItems(d.items || []);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const norm = (s: string) => {
    if (s === 'awaiting_payment') return 'awaiting_courier';
    if (['paid', 'pay_on_delivery', 'ready_for_pickup', 'out_for_delivery'].includes(s)) return 'with_courier';
    return s;
  };

  const counts = useMemo(() => {
    const n = items.map((o) => norm(o.status));
    return {
      all: items.length,
      collecting: n.filter((s) => s === 'collecting').length,
      awaiting_courier: n.filter((s) => s === 'awaiting_courier').length,
      with_courier: n.filter((s) => s === 'with_courier').length,
      issued: n.filter((s) => s === 'issued').length,
      cancelled: n.filter((s) => s === 'cancelled').length,
    };
  }, [items]);

  const visible = items.filter((o) => filter === 'all' || norm(o.status) === filter);

  const issue = async () => {
    if (!token) return;
    setMsg(null);
    setErr(null);
    try {
      const o = await apiRequest<Order>('/api/admin/orders/issue', {
        method: 'POST',
        token,
        body: { code },
        success: t('ord_issued'),
      });
      setMsg(t('ord_issuedTo', { name: o.customerName }));
      setCode('');
      setOpen(false);
      await load();
    } catch (e) {
      setErr(errText(e));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">{t('ord_kicker')}</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink">{t('ord_title')}</h1>
          <p className="text-sm text-[#5C6B63] mt-1">
            {t('ord_hint')}
          </p>
        </div>
        <Btn
          variant="outline"
          onClick={() => {
            setErr(null);
            setMsg(null);
            setCode('');
            setOpen(true);
          }}
        >
          {t('ord_issueBtn')}
        </Btn>
      </div>
      {msg ? <Alert tone="ok">{msg}</Alert> : null}

      <FilterChips
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        options={[
          { id: 'all', label: t('common_all'), count: counts.all },
          { id: 'collecting', label: t('ord_filterCollecting'), count: counts.collecting },
          { id: 'awaiting_courier', label: t('ord_filterWait'), count: counts.awaiting_courier },
          { id: 'with_courier', label: t('ord_filterHand'), count: counts.with_courier },
          { id: 'issued', label: t('ord_filterIssued'), count: counts.issued },
          { id: 'cancelled', label: t('ord_filterCancel'), count: counts.cancelled },
        ]}
      />

      <DataTable>
        <thead>
          <tr>
            <Th>{t('ord_customer')}</Th>
            <Th>{t('common_status')}</Th>
            <Th className="hidden md:table-cell">{t('ord_items')}</Th>
            <Th className="hidden sm:table-cell">{t('ord_delivery')}</Th>
            <Th>{t('common_code')}</Th>
            <Th className="hidden sm:table-cell">{t('ord_sum')}</Th>
          </tr>
        </thead>
        <tbody>
          {visible.map((o) => {
            const meta = statusMeta(o.status);
            const showCode = Boolean(o.pickupCode) || (o.hasPickupCode && meta.tone === 'ok');
            return (
              <tr key={o.id} className="hover:bg-[#FBF8F1]">
                <Td>
                  <p className="font-bold">{o.customerName}</p>
                  <p className="text-xs text-[#5C6B63]">{o.customerPhone}</p>
                </Td>
                <Td>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </Td>
                <Td className="hidden md:table-cell text-[#3d4a43]">
                  {o.items.map((it) => (
                    <span key={it.id} className="block">
                      {it.title} × {it.quantity}
                    </span>
                  ))}
                </Td>
                <Td className="hidden sm:table-cell text-[#5C6B63]">
                  {o.deliveryMethod === 'home_delivery' ? t('ord_home') : t('ord_mfy')}
                </Td>
                <Td className="font-black tracking-widest text-brand-800">
                  {o.pickupCode || (showCode ? '••••' : '—')}
                </Td>
                <Td className="hidden sm:table-cell font-semibold whitespace-nowrap">{formatCurrency(o.totalUzs)}</Td>
              </tr>
            );
          })}
          {visible.length === 0 ? (
            <tr>
              <Td colSpan={6} className="text-[#5C6B63]">
                {items.length === 0 ? t('ord_empty') : t('ord_emptyFilter')}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </DataTable>

      <Modal
        open={open}
        title={t('ord_issueTitle')}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setOpen(false)}>{t('common_cancel')}</Btn>
            <Btn onClick={() => void issue()}>{t('common_confirm')}</Btn>
          </>
        }
      >
        {err ? <Alert>{err}</Alert> : null}
        <p className="text-sm text-[#5C6B63] mb-3">{t('ord_issueHint')}</p>
        <TextField label={t('common_code')} value={code} onChange={setCode} placeholder="1234" />
      </Modal>
    </div>
  );
}
