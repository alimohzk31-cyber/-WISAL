import { Capacitor } from '@capacitor/core';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, ExternalLink } from 'lucide-react';
import { sanitizeExternalUrl } from '../lib/externalUrl';
import { sanitizeSliderLink, SLIDER_SOCIAL_FIELDS, type SliderLinks } from '../lib/sliderLinks';

function SocialIcon({ field }: { field: string }) {
  if (field === 'facebook_url') return <Facebook size={15} aria-hidden="true" />;
  if (field === 'instagram_url') return <Instagram size={15} aria-hidden="true" />;
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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

export default function SliderLinkActions({ links, inline = false }: { links: SliderLinks; inline?: boolean }) {
  const href = sanitizeSliderLink(links.button_link);
  const title = links.button_text?.trim();
  const socials = SLIDER_SOCIAL_FIELDS.flatMap(item => {
    const url = sanitizeExternalUrl(links[item.field]);
    return url ? [{ ...item, url }] : [];
  });
  if (!(href && title) && !socials.length) return null;
  return <div data-slider-links className={`pointer-events-auto flex flex-wrap items-center gap-1.5 ${inline ? 'mt-2.5' : 'absolute right-3 top-3 z-20 max-w-[calc(100%-1.5rem)]'}`} dir="rtl">
    {href && title ? <SliderDestination href={href} action
      className="inline-flex h-8 max-w-40 items-center gap-1.5 rounded-lg border border-white/30 bg-black/65 px-3 text-xs font-bold text-white shadow-sm backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-white">
      <span className="truncate">{title}</span><ExternalLink size={13} aria-hidden="true" />
    </SliderDestination> : null}
    {socials.map(item => <SliderDestination key={item.field} href={item.url} label={item.label} action
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/30 bg-black/65 text-white shadow-sm backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-white">
      <SocialIcon field={item.field} />
    </SliderDestination>)}
  </div>;
}
