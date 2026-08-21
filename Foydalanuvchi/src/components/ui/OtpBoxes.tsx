import { useEffect, useRef } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { tw } from '@/src/lib/utils';

const OTP_LEN = 5;

export function OtpBoxes({
  value,
  onChange,
  label,
  autoFocus,
  length = OTP_LEN,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  autoFocus?: boolean;
  length?: number;
}) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.replace(/\D/g, '').slice(0, length);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <View style={tw`w-full gap-1.5`}>
      {label ? (
        <Text style={tw`text-xs font-semibold text-[#5C6B63] ml-1 uppercase tracking-wider`}>{label}</Text>
      ) : null}
      <Pressable onPress={() => inputRef.current?.focus()}>
        <View style={tw`relative flex-row gap-2`}>
          {Array.from({ length }).map((_, i) => {
            const filled = digits[i];
            const active = digits.length === i || (i === length - 1 && digits.length === length);
            return (
              <View
                key={i}
                style={[
                  tw`flex-1 items-center justify-center rounded-2xl bg-white`,
                  {
                    minHeight: 56,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? '#0B3D2E' : '#E8DFD0',
                  },
                ]}
              >
                <Text style={tw`text-2xl font-extrabold text-[#14221B] tabular-nums`}>{filled ?? ''}</Text>
              </View>
            );
          })}
          <TextInput
            ref={inputRef}
            value={digits}
            onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
            keyboardType="number-pad"
            maxLength={length}
            autoFocus={autoFocus}
            caretHidden
            textContentType="oneTimeCode"
            autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              opacity: 0.02,
              color: 'transparent',
            }}
          />
        </View>
      </Pressable>
    </View>
  );
}
