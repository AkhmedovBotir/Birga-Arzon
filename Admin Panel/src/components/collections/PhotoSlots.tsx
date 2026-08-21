import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Pencil, Star, Trash2 } from 'lucide-react';
import { useI18n } from '@/src/i18n';
import { cn } from '@/src/lib/utils';

export const PHOTO_SLOT_COUNT = 5;

export function PhotoSlots({
  files,
  urls,
  onChange,
  onUrlsChange,
}: {
  files: (File | null)[];
  urls?: (string | null)[];
  onChange: (next: (File | null)[]) => void;
  onUrlsChange?: (next: (string | null)[]) => void;
}) {
  const { t } = useI18n();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [previews, setPreviews] = useState<(string | null)[]>(() => files.map(() => null));

  useEffect(() => {
    const objectUrls = files.map((f) => (f ? URL.createObjectURL(f) : null));
    setPreviews(objectUrls);
    return () => {
      objectUrls.forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
  }, [files]);

  const setFileAt = (i: number, file: File | null) => {
    const next = files.slice();
    next[i] = file;
    onChange(next);
    if (file && onUrlsChange && urls) {
      const u = urls.slice();
      u[i] = null;
      onUrlsChange(u);
    }
  };

  const clearAt = (i: number) => {
    setFileAt(i, null);
    if (inputs.current[i]) inputs.current[i]!.value = '';
    if (onUrlsChange && urls) {
      const u = urls.slice();
      u[i] = null;
      onUrlsChange(u);
    }
  };

  const shown = files.map((f, i) => previews[i] || urls?.[i] || null);
  const filled = shown.filter(Boolean).length;

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-medium text-[#3d4a43]">{t('col_photos')}</p>
          <p className="text-xs text-[#8A968E] mt-0.5">{t('col_photosHint')}</p>
        </div>
        <span className={cn('text-xs font-bold tabular-nums', filled >= 1 ? 'text-brand-800' : 'text-[#C0392B]')}>
          {filled}/{PHOTO_SLOT_COUNT}
        </span>
      </div>
      <div className="grid grid-cols-4 grid-rows-2 gap-2">
        {files.map((_, i) => {
          const cover = i === 0;
          const preview = shown[i];
          return (
            <div
              key={i}
              className={cn(
                'relative overflow-hidden rounded-2xl border-2 border-dashed',
                cover ? 'col-span-2 row-span-2 min-h-[180px]' : 'min-h-[96px]',
                preview ? 'border-brand-800/30 bg-[#F8F4EC]' : 'border-[#E8DFD0] bg-[#FBF8F1]'
              )}
            >
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => setFileAt(i, e.target.files?.[0] || null)}
              />
              {preview ? (
                <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <button
                  type="button"
                  onClick={() => inputs.current[i]?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 hover:bg-white/40"
                >
                  <ImagePlus size={cover ? 28 : 18} className="text-brand-800" />
                  <span className={cn('font-bold text-brand-900 text-center leading-tight', cover ? 'text-sm' : 'text-[11px]')}>
                    {cover ? t('col_cover') : t('col_photoN', { n: i + 1 })}
                  </span>
                </button>
              )}
              {preview ? (
                <>
                  <span
                    className={cn(
                      'absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide',
                      cover ? 'bg-[#C4A35A] text-[#0B3D2E]' : 'bg-black/45 text-white'
                    )}
                  >
                    {cover ? (
                      <>
                        <Star size={10} fill="currentColor" /> {t('col_cover')}
                      </>
                    ) : (
                      `${i + 1}`
                    )}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-1.5 flex gap-1 bg-gradient-to-t from-black/55 to-transparent">
                    <button
                      type="button"
                      title={t('common_edit')}
                      onClick={() => inputs.current[i]?.click()}
                      className={cn(
                        'h-8 rounded-lg bg-white/95 text-[#0B3D2E] text-[11px] font-bold inline-flex items-center justify-center gap-1',
                        cover ? 'flex-1' : 'flex-1'
                      )}
                    >
                      <Pencil size={12} />
                      {cover ? t('common_edit') : null}
                    </button>
                    <button
                      type="button"
                      title={t('common_delete')}
                      onClick={() => clearAt(i)}
                      className={cn(
                        'h-8 rounded-lg bg-white/95 text-danger-500 text-[11px] font-bold inline-flex items-center justify-center gap-1',
                        cover ? 'flex-1' : 'flex-1'
                      )}
                    >
                      <Trash2 size={12} />
                      {cover ? t('common_delete') : null}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
