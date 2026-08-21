import { tStatic } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { dismiss, subscribe, type Toast } from '@/src/lib/toast';

export function SnackbarHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => subscribe(setItems), []);

  return (
    <div className="fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-3 pointer-events-none">
      <AnimatePresence>
        {items.map((item) => (
          <motion.button
            key={item.id}
            type="button"
            onClick={() => dismiss(item.id)}
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0 }}
            className="pointer-events-auto max-w-[min(92vw,420px)] w-full text-left rounded-2xl px-4 py-3 shadow-[0_12px_40px_rgba(7,38,28,0.28)]"
            style={{
              background: item.tone === 'ok' ? '#0B3D2E' : '#7f1d1d',
              color: item.tone === 'ok' ? '#F6F1E8' : '#fff',
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-0.5" style={{ color: item.tone === 'ok' ? '#C4A35A' : '#fecaca' }}>
              {item.tone === 'ok' ? tStatic('snackOk') : tStatic('snackErr')}
            </p>
            <p className="text-sm font-semibold leading-5">{item.message}</p>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
