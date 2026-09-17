import { useState } from 'react';
import type { Service } from '../types/models';
import { SOCIAL_PLATFORMS, socialContactUrl, type SocialPlatform } from '../lib/serviceSocialLinks';

export interface SocialContactValues {
  whatsappPhone: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
}

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

export function ServiceSocialLinks({ service }: { service: Service }) {
  const values: Record<SocialPlatform, string | undefined> = { whatsapp: service.whatsappPhone, facebook: service.facebookUrl, instagram: service.instagramUrl, tiktok: service.tiktokUrl };
  const links = SOCIAL_PLATFORMS.flatMap(platform => {
    const href = socialContactUrl(platform, values[platform]);
    return href ? [{ platform, href, ...meta[platform] }] : [];
  });
  if (!links.length) return null;
  return <div className="flex flex-wrap items-center justify-center gap-3" aria-label="حسابات التواصل">
    {links.map(link => <a key={link.platform} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label} title={link.label} className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-black shadow-md transition-transform hover:scale-105 ${link.color}`}>{link.glyph}</a>)}
  </div>;
}
