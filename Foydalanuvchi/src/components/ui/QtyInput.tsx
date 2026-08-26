import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { tw } from '@/src/lib/utils';

export function QtyInput({
  value,
  unit,
  onChange,
  min = 0,
  max = 9999,
}: {
  value: number;
  unit?: string;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const cap = Math.max(min, max);
  const shown = Math.min(cap, Math.max(min, value));
  const [text, setText] = useState(String(shown));

  useEffect(() => {
    setText(String(Math.min(cap, Math.max(min, value))));
  }, [value, min, cap]);

  const commit = (raw: string) => {
    const n = parseInt(raw.replace(/\D/g, ''), 10);
    if (!Number.isFinite(n)) {
      const fallback = Math.max(min, 0);
      onChange(fallback);
      setText(String(fallback));
      return;
    }
    const clamped = Math.min(cap, Math.max(min, n));
    onChange(clamped);
    setText(String(clamped));
  };

  const atMin = shown <= min;
  const atMax = shown >= cap;

  return (
    <View style={tw`flex-row items-center gap-2`}>
      <Pressable
        onPress={() => {
          if (atMin) return;
          onChange(Math.max(min, shown - 1));
        }}
        style={[
          tw`w-10 h-10 rounded-xl bg-[#F6F1E8] border border-[#E8DFD0] items-center justify-center`,
          atMin ? tw`opacity-40` : null,
        ]}
      >
        <Text style={tw`text-lg font-bold text-[#0B3D2E]`}>−</Text>
      </Pressable>
      <TextInput
        value={text}
        keyboardType="number-pad"
        inputMode="numeric"
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, 4);
          if (!digits) {
            setText('');
            return;
          }
          const n = parseInt(digits, 10);
          if (Number.isFinite(n) && n > cap) {
            setText(String(cap));
            if (shown !== cap) onChange(cap);
            return;
          }
          setText(digits);
        }}
        onBlur={() => commit(text)}
        onSubmitEditing={() => commit(text)}
        style={tw`w-14 h-10 text-center font-extrabold text-base text-[#14221B] bg-white border border-[#E8DFD0] rounded-xl`}
      />
      <Pressable
        onPress={() => {
          if (atMax) return;
          onChange(Math.min(cap, shown + 1));
        }}
        style={[
          tw`w-10 h-10 rounded-xl bg-[#F6F1E8] border border-[#E8DFD0] items-center justify-center`,
          atMax ? tw`opacity-40` : null,
        ]}
      >
        <Text style={tw`text-lg font-bold text-[#0B3D2E]`}>+</Text>
      </Pressable>
      {unit ? <Text style={tw`text-sm text-[#5C6B63] font-semibold`}>{unit}</Text> : null}
    </View>
  );
}
