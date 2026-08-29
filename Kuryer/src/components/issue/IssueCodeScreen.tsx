import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { CheckCircle2, KeyRound, Sparkles, XCircle } from 'lucide-react-native';
import { errText, useI18n } from '@/src/i18n';
import { Button, Card } from '@/src/components/ui/Base';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { cardShadowStyle, tw } from '@/src/lib/utils';
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
    const clean = code.trim();
    if (clean.length !== 4) {
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
        body: { code: clean },
        success: t('cour_issuedOk'),
      });
      setOk(true);
      setMsg(t('cour_issuedTo', { name: o.customerName }));
      setCode('');
      setTimeout(() => onIssued?.(), 1000);
    } catch (e) {
      setOk(false);
      setMsg(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={tw`flex-1 justify-between pb-6 pt-2`}>
      <View>
        <View style={tw`flex-row items-center gap-2 mb-1`}>
          <KeyRound size={22} color="#0B3D2E" />
          <Text style={tw`text-2xl font-black text-[#0f1c16] tracking-tight`}>{t('cour_issueTitle')}</Text>
        </View>
        <Text style={tw`text-[#54665d] text-xs sm:text-sm mb-6 leading-5`}>
          {t('cour_issueHint')}
        </Text>

        {/* Card for Entering Code */}
        <View style={[tw`bg-white rounded-3xl p-6 border border-[#e8dfd0] shadow-sm items-center`, cardShadowStyle()]}>
          <Text style={tw`text-xs font-black uppercase tracking-wider text-[#b8913b] mb-4`}>
            Mijoz bergan 4 xonali kod
          </Text>

          {/* 4-digit Visual Boxes */}
          <View style={tw`flex-row justify-center gap-3 mb-5`}>
            {[0, 1, 2, 3].map((i) => {
              const char = code[i];
              const active = code.length === i;
              return (
                <View
                  key={i}
                  style={[
                    tw`w-14 h-16 rounded-2xl bg-[#fbf8f2] border-2 items-center justify-center shadow-sm`,
                    char
                      ? tw`border-[#0b3d2e] bg-[#f1fbf5]`
                      : active
                      ? tw`border-[#d4af37] bg-white`
                      : tw`border-[#e8dfd0]`,
                  ]}
                >
                  <Text style={tw`text-3xl font-black text-[#0b3d2e]`}>{char || ''}</Text>
                </View>
              );
            })}
          </View>

          {/* Clean Input Field */}
          <TextInput
            value={code}
            onChangeText={(txt) => {
              const digits = txt.replace(/\D/g, '').slice(0, 4);
              setCode(digits);
              setMsg(null);
            }}
            placeholder="0000"
            placeholderTextColor="#8c9c93"
            keyboardType="number-pad"
            maxLength={4}
            autoFocus
            style={tw`w-full max-w-xs text-center py-3.5 px-4 bg-[#fbf8f2] rounded-2xl border border-[#e8dfd0] text-xl font-black text-[#0b3d2e] tracking-[8px]`}
          />
        </View>

        {msg ? (
          <View
            style={[
              tw`p-4 rounded-2xl border flex-row items-center justify-center gap-2.5 mt-4`,
              ok ? tw`bg-[#f1fbf5] border-[#daf3e5]` : tw`bg-red-50 border-red-200`,
            ]}
          >
            {ok ? <CheckCircle2 size={20} color="#1b7a4a" /> : <XCircle size={20} color="#dc2626" />}
            <Text style={[tw`font-extrabold text-xs text-center`, { color: ok ? '#1b7a4a' : '#dc2626' }]}>
              {msg}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={tw`w-full max-w-sm self-center mt-4`}>
        <Button
          disabled={busy || code.length !== 4}
          onPress={() => void submit()}
          className="w-full shadow-lg py-4"
        >
          {busy ? t('common_checking') : t('common_confirm')}
        </Button>
      </View>
    </View>
  );
}
