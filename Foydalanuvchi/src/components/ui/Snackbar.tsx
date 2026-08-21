import { tStatic } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { dismiss, subscribe, type Toast } from '@/src/lib/toast';

export function SnackbarHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => subscribe(setItems), []);

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 88,
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence>
        {items.map((item) => (
          <motion.button
            key={item.id}
            type="button"
            onClick={() => dismiss(item.id)}
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0 }}
            style={{
              pointerEvents: 'auto',
              maxWidth: 420,
              width: '100%',
              textAlign: 'left',
              borderRadius: 16,
              padding: '12px 16px',
              border: 0,
              cursor: 'pointer',
              background: item.tone === 'ok' ? '#0B3D2E' : '#7f1d1d',
              color: item.tone === 'ok' ? '#F6F1E8' : '#fff',
              boxShadow: '0 12px 40px rgba(7,38,28,0.28)',
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', margin: 0, color: item.tone === 'ok' ? '#C4A35A' : '#fecaca' }}>
              {item.tone === 'ok' ? tStatic('snackOk') : tStatic('snackErr')}
            </p>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '4px 0 0', lineHeight: 1.35 }}>{item.message}</p>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
