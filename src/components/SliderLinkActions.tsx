import { Capacitor } from '@capacitor/core';
import { Link } from 'react-router-dom';
import { Instagram, Github, Globe } from 'lucide-react';
import { sanitizeExternalUrl } from '../lib/externalUrl';
import { normalizeSocialIconsPosition, sanitizeSliderLink, SLIDER_SOCIAL_FIELDS, type SliderLinks } from '../lib/sliderLinks';

function SocialIcon({ field }: { field: string }) {
  if (field === 'facebook_url') return <svg width="14" height="14" className="h-3.5 w-3.5 md:h-4 md:w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 22v-9h3l.5-4H14V6.5c0-1.2.3-2 2-2h1.8V1.2A24 24 0 0 0 15.2 1C12.6 1 11 2.6 11 5.7V9H8v4h3v9h3Z" /></svg>;
  if (field === 'instagram_url') return <Instagram size={14} className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />;
  if (field === 'whatsapp_url') return <svg width="14" height="14" className="h-3.5 w-3.5 md:h-4 md:w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0 11.9 11.9 0 0 0 1.7 17.8L0 24l6.4-1.7A11.9 11.9 0 0 0 24 11.9a11.8 11.8 0 0 0-3.5-8.4ZM12.1 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.9 9.9 0 1 1 8.4 4.7Zm5.4-7.4c-.3-.1-1.8-.9-2.1-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.5l-1-2.3c-.2-.6-.5-.5-.7-.5H8c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.1 4.5l1.7.5c.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.3-.7-.4Z" /></svg>;
  return <svg width="14" height="14" className="h-3.5 w-3.5 md:h-4 md:w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={field === 'tiktok_url' ? { filter: 'drop-shadow(-1px -1px 0 #25f4ee) drop-shadow(1px 1px 0 #fe2c55)' } : undefined}>
    {field === 'twitter_url'
      ? <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.2l7.3-8.5L.8 2h6.5l4.4 5.9L18.9 2Zm-1.1 18h1.8L6.3 3.9H4.4L17.8 20Z" />
      : <path d="M16.7 2c.3 2.8 1.8 4.5 4.3 4.7v3.2a8.6 8.6 0 0 1-4.4-1.4v7.2a6.3 6.3 0 1 1-5.5-6.3v3.3a3 3 0 1 0 2.2 2.9V2h3.4Z" />}
  </svg>;
}

/** Native HTTP(S) anchors use Capacitor's existing ACTION_VIEW handler. */
export function SliderDestination({ href, className, label, action = false, children }: {
  href: string; className: string; label?: string; action?: boolean; children?: React.ReactNode;
}) {
  const safe = sanitizeSliderLink(href);
  if (!safe) return null;
  const props = { className, 'aria-label': label, draggable: false, 'data-slider-link-action': action ? true : undefined };
  if (safe.startsWith('/')) return <Link to={safe} {...props}>{children}</Link>;
  return <a href={safe} target={Capacitor.isNativePlatform() ? '_self' : '_blank'} rel="noopener noreferrer" {...props}>{children}</a>;
}

export function hasSliderLinks(links: SliderLinks): boolean {
  return Boolean(sanitizeSliderLink(links.button_link) || SLIDER_SOCIAL_FIELDS.some(item => sanitizeExternalUrl(links[item.field])));
}

export default function SliderLinkActions({ links, inline = false }: { links: SliderLinks; inline?: boolean }) {
  const href = sanitizeSliderLink(links.button_link);
  const title = links.button_text?.trim();
  const socials = SLIDER_SOCIAL_FIELDS.flatMap(item => {
    const url = sanitizeExternalUrl(links[item.field]);
    return url ? [{ ...item, url }] : [];
  });
  if (!href && !socials.length) return null;
  const github = href && !href.startsWith('/') && /^(www\.)?github\.com$/i.test(new URL(href).hostname);
  const whatsapp = href && !href.startsWith('/') && /^(?:(?:www\.)?wa\.me|(?:(?:www|api|web)\.)?whatsapp\.com)$/i.test(new URL(href).hostname);
  const position = normalizeSocialIconsPosition(links.social_icons_position);
  const placement = {
    left: 'left-2 top-1/2 -translate-y-1/2 flex-col',
    right: 'right-2 top-1/2 -translate-y-1/2 flex-col',
    top: 'top-2 left-1/2 -translate-x-1/2',
    bottom: 'bottom-4 left-1/2 -translate-x-1/2',
  }[position];
  const circle = 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.10)] transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] md:h-7 md:w-7';
  const socialColors: Record<string, string> = {
    facebook_url: 'bg-[#1877f2] text-white',
    instagram_url: 'bg-[linear-gradient(135deg,#833ab4,#e1306c,#fcb045)] text-white',
    tiktok_url: 'bg-black text-white',
    twitter_url: 'bg-[var(--text-primary)] text-[var(--surface)]',
  };
  return <div data-slider-links data-social-icons-position={position} className={`pointer-events-auto flex w-fit max-w-[calc(100%-1rem)] max-h-[calc(100%-1rem)] items-center justify-center gap-1 rounded-2xl border px-1 py-1 ${inline ? 'mx-auto mt-2 border-[var(--border)] bg-[var(--surface)]' : `absolute z-20 border-white/20 bg-white/10 backdrop-blur-sm ${placement}`}`} dir="rtl" aria-label="روابط الشريحة">
    {socials.map(item => <SliderDestination key={item.field} href={item.url} label={item.label} action
      className={`${circle} ${socialColors[item.field]}`}>
      <SocialIcon field={item.field} />
    </SliderDestination>)}
    {href ? <SliderDestination href={href} action label={title || (github ? 'GitHub' : whatsapp ? 'WhatsApp' : 'فتح الرابط')}
      className={`${circle} ${whatsapp ? 'bg-[#25D366] text-white' : github ? 'bg-[var(--text-primary)] text-[var(--surface)]' : 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'}`}>
      {whatsapp ? <SocialIcon field="whatsapp_url" /> : github ? <Github size={14} className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" /> : <Globe size={14} className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />}
    </SliderDestination> : null}
  </div>;
}
