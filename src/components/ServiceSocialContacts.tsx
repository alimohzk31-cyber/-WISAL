import { useState, type ReactElement } from 'react';
import type { Service } from '../types/models';
import { SOCIAL_PLATFORMS, socialContactUrl, type SocialPlatform } from '../lib/serviceSocialLinks';

export interface SocialContactValues {
  whatsappPhone: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
}

// أيقونات المنصات الحقيقية (SVG بمسار العلامة التجارية) — تُستخدم في عرض
// حسابات التواصل داخل تفاصيل الخدمة بدل الحروف المختصرة.
const socialIconPaths: Record<SocialPlatform, ReactElement> = {
  whatsapp: <svg className="h-1/2 w-1/2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>,
  facebook: <svg className="h-1/2 w-1/2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
  instagram: <svg className="h-1/2 w-1/2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>,
  tiktok: <svg className="h-1/2 w-1/2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.47 4.17 1.31 1.84 3.75 3.1 6.01 3.1s4.7-1.26 6.01-3.1c.84-1.08 1.39-2.64 1.47-4.17.13 1.3-.96 2.5-2.25 2.5h-.32c-1.45 0-2.66-.95-3.03-2.52-.33-1.46-.54-2.95-.61-4.44-.38-1.5-1.1-3.61-2.31-4.99-1.27-1.45-3.12-2.57-5.2-2.72C10.85.08 11.6-.02 12.52.02zm4.26 4.7c-.02.16-.04.32-.07.49-.15.86-.53 1.86-1.13 2.51-1.27 1.3-3.27 2.05-4.95 2.05h-.4c-2.03 0-3.51-.92-4.45-2.53-.71-1.19-1.07-2.62-1.13-4.08-.03-.66-.05-1.33-.05-2 0-1.31.02-2.63.05-3.94.02-.87.1-1.76.23-2.66.25-1.86.9-3.1 2.34-4.1 1.27-1.03 2.93-1.59 4.54-1.76 1.69-.18 3.32-.12 4.62-.02.06 1.52.63 3.06 1.5 4.17.79.98 1.98 1.79 3.34 2.27.04.02.08.04.13.06l.13.06c.76.37 1.37.86 1.87 1.5.57.72.97 1.55 1.2 2.4.18.68.28 1.39.3 2.1.03.77.05 1.54.06 2.31.01.9-.02 1.79-.08 2.68-.07.98-.2 1.92-.4 2.87z" /></svg>,
};

const meta: Record<SocialPlatform, { label: string; field: keyof SocialContactValues; color: string; glyph: string; placeholder: string; type: 'tel' | 'url' }> = {
  whatsapp: { label: 'WhatsApp', field: 'whatsappPhone', color: 'bg-[#25D366] text-white', glyph: 'W', placeholder: '9647XXXXXXXXX', type: 'tel' },
  facebook: { label: 'Facebook', field: 'facebookUrl', color: 'bg-[#1877F2] text-white', glyph: 'f', placeholder: 'https://facebook.com/page', type: 'url' },
  instagram: { label: 'Instagram', field: 'instagramUrl', color: 'bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] text-white', glyph: '◎', placeholder: 'https://instagram.com/account', type: 'url' },
  tiktok: { label: 'TikTok', field: 'tiktokUrl', color: 'bg-black text-white', glyph: '♪', placeholder: 'https://tiktok.com/@account', type: 'url' },
};

export function SocialContactFields({ values, onChange }: { values: SocialContactValues; onChange: (field: keyof SocialContactValues, value: string) => void }) {
  const [open, setOpen] = useState<SocialPlatform[]>(() => SOCIAL_PLATFORMS.filter(platform => Boolean(values[meta[platform].field])));
  return (
    <div className="space-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2" aria-label="روابط التواصل الاختيارية">
        {SOCIAL_PLATFORMS.map(platform => {
          const item = meta[platform];
          const active = open.includes(platform);
          return <button key={platform} type="button" title={item.label} aria-label={`إضافة ${item.label}`} aria-pressed={active} onClick={() => setOpen(current => active ? current.filter(value => value !== platform) : [...current, platform])} className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black shadow-sm transition-transform hover:scale-105 ${item.color} ${active ? 'ring-2 ring-[var(--accent-primary)] ring-offset-2 ring-offset-[var(--surface-elevated)]' : 'opacity-80'}`}>{item.glyph}</button>;
        })}
        <span className="min-w-0 flex-1 break-words text-xs font-bold text-[var(--text-muted)]">اختياري — اضغط لإظهار الحقل</span>
      </div>
      {SOCIAL_PLATFORMS.filter(platform => open.includes(platform)).map(platform => {
        const item = meta[platform];
        const value = values[item.field];
        const invalid = Boolean(value.trim()) && !socialContactUrl(platform, value);
        return <div key={platform} className="space-y-1">
          <label className="text-xs font-bold text-[var(--text-secondary)]" htmlFor={`social-${platform}`}>{item.label}</label>
          <input id={`social-${platform}`} type={item.type} value={value} onChange={event => onChange(item.field, event.target.value)} placeholder={item.placeholder} dir="ltr" aria-invalid={invalid} className={`w-full rounded-xl border bg-[var(--input-bg)] px-4 py-2.5 text-left font-bold text-[var(--text-primary)] focus:outline-none ${invalid ? 'border-red-500' : 'border-[var(--input-border)] focus:border-[var(--accent-primary)]'}`} />
          {invalid && <p className="text-xs font-bold text-red-500">أدخل {platform === 'whatsapp' ? 'رقمًا دوليًا صحيحًا' : `رابط ${item.label} صحيحًا`}.</p>}
        </div>;
      })}
    </div>
  );
}

export function ServiceSocialLinks({ service, compact = false, title }: { service: Service; compact?: boolean; title?: string }) {
  const values: Record<SocialPlatform, string | undefined> = { whatsapp: service.whatsappPhone, facebook: service.facebookUrl, instagram: service.instagramUrl, tiktok: service.tiktokUrl };
  // فقط الحسابات التي أضافها صاحب الخدمة فعليًا تُنتج أيقونة؛ الحقل الفارغ
  // أو غير الصالح يُسقط نهائيًا (لا أيقونة ولا رابط نصي طويل).
  const links = SOCIAL_PLATFORMS.flatMap(platform => {
    const href = socialContactUrl(platform, values[platform]);
    return href ? [{ platform, href, ...meta[platform] }] : [];
  });
  if (!links.length) return null;
  return (
    <div className="space-y-2">
      {title && <p className="text-xs font-bold text-[var(--text-muted)]">{title}</p>}
      <div className={`flex flex-wrap items-center ${title ? 'gap-2' : 'justify-center gap-3'}`} aria-label="حسابات التواصل">
        {links.map(link => (
          <a
            key={link.platform}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label}
            title={link.label}
            className={`flex shrink-0 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${link.color} ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}
          >
            {socialIconPaths[link.platform]}
          </a>
        ))}
      </div>
    </div>
  );
}
