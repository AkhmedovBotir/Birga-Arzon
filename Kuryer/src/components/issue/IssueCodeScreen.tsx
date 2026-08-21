import { useState } from 'react';
import { Text, View } from 'react-native';
import { errText, useI18n } from '@/src/i18n';
import { Button, Input } from '@/src/components/ui/Base';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { tw } from '@/src/lib/utils';
import type { Order } from '@/src/types';

export function IssueCodeScreen({ onIssued }: { onIssued?: () => void }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!token) return;
    const trimmed = code.replace(/\D/g, '').slice(0, 4);
    if (trimmed.length !== 4) {
      setOk(false);
      setMsg(t('cour_need4'));
      return;
    }
    setMsg(null);
    setBusy(true);
    try {
      const o = await apiRequest<Order>('/api/courier/orders/issue', {
        method: 'POST',
        token,
        body: { code: trimmed },
        success: t('cour_issuedOk'),
      });
      setOk(true);
      setMsg(t('cour_issuedTo', { name: o.customerName }));
      setCode('');
      setTimeout(() => onIssued?.(), 900);
    } catch (e) {
      setOk(false);
      setMsg(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={tw`flex-1 pt-4`}>
      <Text style={tw`text-2xl font-extrabold text-[#14221B] mb-2`}>{t('cour_issueTitle')}</Text>
      <Text style={tw`text-[#5C6B63] mb-6`}>
        {t('cour_issueHint')}
      </Text>
      <Input
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="numeric"
        placeholder="1234"
        className="text-center text-3xl tracking-widest"
      />
      <Button className="mt-5" disabled={busy} onPress={() => void submit()}>
        {busy ? t('common_checking') : t('common_confirm')}
      </Button>
      {msg ? (
        <Text style={[tw`mt-4 text-center font-semibold`, { color: ok ? '#1B7A4A' : '#C0392B' }]}>{msg}</Text>
      ) : null}
    </View>
  );
}
