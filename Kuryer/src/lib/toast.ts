export type ToastTone = 'ok' | 'error';

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

type Listener = (items: Toast[]) => void;

let items: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((fn) => fn(items));
}

export function toast(message: string, tone: ToastTone = 'ok') {
  const text = message.trim();
  if (!text) return;
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  items = [...items.slice(-3), { id, message: text, tone }];
  emit();
  window.setTimeout(() => dismiss(id), 3800);
}

export function dismiss(id: string) {
  const next = items.filter((t) => t.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}

export function subscribe(fn: Listener) {
  listeners.add(fn);
  fn(items);
  return () => {
    listeners.delete(fn);
  };
}
