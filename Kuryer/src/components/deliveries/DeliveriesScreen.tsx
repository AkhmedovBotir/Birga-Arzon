import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useI18n } from '@/src/i18n';
import { Button, Card } from '@/src/components/ui/Base';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { tw } from '@/src/lib/utils';
import type { GroupBuy, Order } from '@/src/types';

type Waiting = { collection: GroupBuy; orders: Order[] };

export function DeliveriesScreen({ onAccepted }: { onAccepted?: () => void }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [needArea, setNeedArea] = useState(false);
  const [areaName, setAreaName] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    const d = await apiRequest<{ waiting: Waiting[]; needArea?: boolean; area?: { regionName?: string; cityName?: string } }>(
      '/api/courier/deliveries',
      { token, silent },
    );
    setWaiting(d.waiting || []);
    setNeedArea(Boolean(d.needArea));
    setAreaName([d.area?.regionName, d.area?.cityName].filter(Boolean).join(' · '));
  }, [token]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(true), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const accept = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    try {
      await apiRequest(`/api/courier/group-buys/${id}/accept`, {
        method: 'POST',
        token,
        body: {},
        success: t('cour_accepted'),
      });
      await load();
      onAccepted?.();
    } finally {
      setBusyId(null);
    }
  };

  const area = areaName ? `${areaName}. ` : '';

  return (
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-6`}>
      <Text style={tw`text-2xl font-extrabold text-[#14221B] mb-1`}>{t('cour_acceptTitle')}</Text>
      <Text style={tw`text-[#5C6B63] mb-4`}>
        {t('cour_acceptHint', { area })}
      </Text>

      {needArea ? (
        <Card>
          <Text style={tw`font-bold text-[#14221B]`}>{t('cour_needMfyTitle')}</Text>
          <Text style={tw`text-[#5C6B63] mt-1`}>{t('cour_needMfyBody')}</Text>
        </Card>
      ) : null}

      {!needArea && waiting.length === 0 ? (
        <Card>
          <Text style={tw`font-bold text-[#14221B]`}>{t('cour_noWaitingTitle')}</Text>
          <Text style={tw`text-[#5C6B63] mt-1`}>
            {t('cour_noWaitingHint')}
          </Text>
        </Card>
      ) : null}

      {!needArea
        ? waiting.map((w) => (
        <Card key={w.collection.id} style={tw`mb-3`}>
          <View style={[tw`self-start px-2 py-1 rounded-lg mb-2`, { backgroundColor: '#F4EAD4' }]}>
            <Text style={{ color: '#7A5A1E', fontSize: 11, fontWeight: '800' }}>{t('cour_closedN', { n: w.orders.length })}</Text>
          </View>
          <Text style={tw`font-extrabold text-[#14221B]`}>{w.collection.title}</Text>
          <Text style={tw`text-[#5C6B63] mt-1`}>
            {w.collection.currentVolume} {w.collection.unitLabel}
          </Text>
          {w.orders.map((o) => (
            <View key={o.id} style={tw`mt-2`}>
              <Text style={tw`font-semibold`}>{o.customerName}</Text>
              <Text style={tw`text-gray-500 text-sm`}>{o.customerPhone}</Text>
              {o.items.map((it) => (
                <Text key={it.id} style={tw`text-gray-600`}>{it.title} × {it.quantity}</Text>
              ))}
              <Text style={tw`text-xs text-[#5C6B63] mt-0.5`}>
                {o.deliveryMethod === 'home_delivery' ? t('cour_homeDel') : t('cour_mfyPick')}
              </Text>
            </View>
          ))}
          <Button className="mt-4" disabled={busyId === w.collection.id} onPress={() => void accept(w.collection.id)}>
            {busyId === w.collection.id ? t('common_accepting') : t('cour_acceptBtn')}
          </Button>
        </Card>
          ))
        : null}
    </ScrollView>
  );
}
