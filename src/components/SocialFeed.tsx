import { memo, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, Eye, MapPin, MessageCircle, Plus, Phone, ExternalLink, Video, Navigation } from 'lucide-react';
import { useServices } from '../context/ServicesContext';
import { useCategories } from '../hooks/useCategories';
import { useFeedInteractions } from '../hooks/useFeedInteractions';
import { getServiceIcon } from '../data/serviceIcons';
import PostInteractions from './PostInteractions';
import { openServiceCategory } from '../lib/directoryNavigation';
import { useCategoryDirectory } from '../hooks/useCategoryDirectory';
import ServicePublicationTime from './ServicePublicationTime';
import { getServicePublicationTimestamp } from '../lib/servicePublicationTime';
import { LazyServiceGallery } from './LazyServiceMedia';
import { getBrowseDescriptionPreview, getBrowseExtraImages, getBrowseImages, hasBrowseDetails } from '../lib/browseServiceCard';
import { useSavedServices } from '../hooks/useSavedServices';
import type { Service } from '../types/models';

interface SocialFeedProps {
  onAddService?: () => void;
  services?: Service[];
  showAddButton?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

function SocialFeed({
  onAddService,
  services,
  showAddButton = true,
  emptyTitle = 'لا توجد منشورات للعرض حاليًا',
  emptyDescription = 'ستظهر هنا الخدمات المعتمدة عند توفرها.',
}: SocialFeedProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { publicServices } = useServices();
  const { categories } = useCategories();
  const { sections, locateService } = useCategoryDirectory(categories, publicServices);
  const { savedIds, toggleSaved } = useSavedServices();
  const sourceServices = services ?? publicServices;

  // التصفح الاجتماعي يعرض الخدمات المعتمدة للجميع، بالإضافة إلى الخدمات التي
  // أضافها هذا الجهاز وما زالت قيد المراجعة (تظهر له فوراً بعد الإضافة
  // دون تحديث الصفحة، مع شارة «قيد المراجعة» — لا تُرى للأجهزة الأخرى).
  // ملاحظة أداء/صحة: نسخة قبل الفرز (spread) — الفرز مكانياً (mutate) كان
  // يعيد ترتيب مصفوفة publicServices المشتركة مع باقي الصفحات ويُبطل الكاش.
  const feedItems = useMemo(() => {
    return [...sourceServices]
      .sort((a, b) => getServicePublicationTimestamp(b) - getServicePublicationTimestamp(a));
  }, [sourceServices]);
  const [visibleCount, setVisibleCount] = useState(12);
  // يتحكّم في توسيع بطاقة المنشور في مكانها (المزيد → إخفاء التفاصيل) دون أي انتقال
  // إلى صفحة أخرى ودون إعادة جلب للخدمات.
  const [detailsExpanded, setDetailsExpanded] = useState<Set<string>>(() => new Set());
  const visibleItems = useMemo(() => feedItems.slice(0, visibleCount), [feedItems, visibleCount]);

  const toggleDetailsExpanded = (serviceKey: string) => {
    setDetailsExpanded(current => {
      const next = new Set(current);
      if (next.has(serviceKey)) next.delete(serviceKey);
      else next.add(serviceKey);
      return next;
    });
  };

  const isDetailsExpanded = (serviceKey: string) => detailsExpanded.has(serviceKey);

  // نظام التفاعلات والتعليقات (service_reactions / service_comments)
  const {
    summaries,
    myReactions,
    commentsByService,
    toggleReaction,
    addComment,
    deleteComment,
  } = useFeedInteractions(visibleItems.map((s) => s.id).filter((id) => id !== undefined));

  return (
    <section className="relative z-10 mx-auto w-full min-w-0 max-w-2xl space-y-5" aria-label="التصفح">
      {feedItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-16 text-center">
          <MessageCircle className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{emptyTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{emptyDescription}</p>
        </div>
      ) : (
        visibleItems.map((service) => {
          const Icon = getServiceIcon(service.categorySlug);
          const placement = locateService(service);
          const section = sections.find(item => item.slug === placement?.sectionSlug);
          const childName = section?.children.find(item => item.slug === placement?.childSlug)?.name;
          const categoryName = childName
            ?? section?.name
            ?? categories.find((category) => category.slug === service.categorySlug)?.name
            ?? service.categorySlug;
          const browseImages = getBrowseImages(service);
          const extraImages = getBrowseExtraImages(service);
          const serviceKey = String(service.id ?? service.slug);
          const detailsOpen = isDetailsExpanded(serviceKey);
          const description = getBrowseDescriptionPreview(service.experience);
          // «المزيد» تظهر فقط عند وجود تفاصيل غير ظاهرة في الحالة المختصرة.
          const canExpandDetails = description.truncated || hasBrowseDetails(service);

          return (
            <article key={serviceKey} className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)]">
              <div className="flex min-w-0 items-center gap-2 px-3 py-3 sm:gap-3 sm:px-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#D90429] bg-white">
                  <Icon className="h-5 w-5 text-[#D90429]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-xs font-bold text-[var(--text-secondary)]">{categoryName}</p>
                    {service.status === 'pending' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        قيد المراجعة
                      </span>
                    )}
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className="flex items-center gap-1 text-xs font-bold text-[var(--text-muted)]"
                    aria-label={service.views === undefined ? 'عدد الزيارات غير متاح' : `${service.views} زيارة`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {service.views === undefined ? '—' : service.views.toLocaleString('ar-IQ')}
                  </span>
                  <ServicePublicationTime service={service} className="text-xs text-[var(--text-muted)]" />
                </span>
              </div>

              <LazyServiceGallery service={service} images={browseImages} />

              <div className="space-y-2.5 px-3.5 pb-3 pt-3">
                <h2 className="break-words text-base font-bold text-[var(--text-primary)]">{service.name}</h2>

                {(service.profession || service.location) && (
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-[var(--text-muted)]">
                    {service.profession && <><Briefcase className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" /><span className="truncate">{service.profession}</span></>}
                    {service.profession && service.location && <span aria-hidden="true">•</span>}
                    {service.location && <><MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" /><span className="truncate">{service.location}</span></>}
                  </p>
                )}

                {/* الحالة المختصرة: نبذة قصيرة واحدة تنتهي بكلمة «المزيد» مرة واحدة،
                    وعند التوسيع تختفي النبذة القصيرة وتظهر التفاصيل الكاملة كقطعة واحدة. */}
                {!detailsOpen && (description.text || canExpandDetails) && (
                  <p className="flex min-w-0 items-center gap-1 text-sm leading-6 text-[var(--text-muted)]">
                    {description.text && (
                      <span className="min-w-0 flex-1 truncate">{description.text}</span>
                    )}
                    {canExpandDetails && (
                      <button
                        type="button"
                        onClick={() => toggleDetailsExpanded(serviceKey)}
                        aria-expanded={detailsOpen}
                        aria-controls={`browse-details-${serviceKey}`}
                        className="shrink-0 rounded px-1 font-bold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                      >
                        المزيد
                      </button>
                    )}
                  </p>
                )}
              </div>

              {isDetailsExpanded(serviceKey) && (
                <div id={`browse-details-${serviceKey}`} className="border-t border-[var(--border)] bg-[var(--surface-elevated)] px-3.5 py-4 space-y-3">
                  {/* التخصص — القسم والمهنة ظاهران أصلًا في رأس البطاقة، فلا يُكرران هنا */}
                  {service.subCategory && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-secondary)] px-3 py-1.5 font-bold text-[var(--text-secondary)]">
                        التخصص: {service.subCategory}
                      </span>
                    </div>
                  )}

                  {service.experience && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-[var(--text-muted)]">
                        {description.truncated ? 'النبذة كاملة' : 'نبذة عن الخدمة'}
                      </p>
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                        {service.experience}
                      </p>
                    </div>
                  )}

                  {service.phone && (
                    <a
                      href={`tel:${service.phone}`}
                      className="flex items-center gap-3 rounded-2xl bg-[var(--bg-secondary)] px-4 py-3 transition-colors hover:bg-[var(--accent-soft)]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/20 text-green-500">
                        <Phone className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[var(--text-muted)]">رقم الهاتف</p>
                        <p dir="ltr" className="break-all font-bold text-[var(--text-primary)]">{service.phone}</p>
                      </div>
                      <svg className="h-5 w-5 shrink-0 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  )}

                  {service.whatsappPhone && (
                    <a
                      href={`https://wa.me/${service.whatsappPhone.replace(/[^0-9]/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-2xl bg-green-500/10 px-4 py-3 transition-colors hover:bg-green-500/20"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500 text-white">
                        <span className="text-lg font-black">W</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-green-500">واتساب</p>
                        <p dir="ltr" className="break-all font-bold text-[var(--text-primary)]">{service.whatsappPhone}</p>
                      </div>
                      <ExternalLink className="h-5 w-5 shrink-0 text-green-500" />
                    </a>
                  )}

                  {service.location && (
                    /* العنوان قابل للفتح في الخرائط: بالإحداثيات إن وُجدت، وإلا بالبحث النصي */
                    <a
                      href={service.latitude && service.longitude
                        ? `https://www.google.com/maps/search/?api=1&query=${service.latitude},${service.longitude}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(service.location)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-3 rounded-2xl bg-[var(--bg-secondary)] px-4 py-3 transition-colors hover:bg-[var(--accent-soft)]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[var(--text-muted)]">الموقع/العنوان (المحافظة والمنطقة)</p>
                        <p className="text-sm font-bold text-[var(--text-primary)]">{service.location}</p>
                      </div>
                      <ExternalLink className="h-5 w-5 shrink-0 text-[var(--accent-primary)]" />
                    </a>
                  )}

                  {service.latitude && service.longitude && (
                    <div className="flex flex-wrap gap-2">
                      <a href={`https://www.google.com/maps/search/?api=1&query=${service.latitude},${service.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-bold text-[var(--accent-primary)] hover:bg-[var(--accent-light)] transition-colors">
                        <MapPin className="h-3 w-3" /> خرائط جوجل
                      </a>
                      <a href={`https://waze.com/ul?ll=${service.latitude},${service.longitude}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--accent-soft)] transition-colors">
                        <Navigation className="h-3 w-3" /> ويز
                      </a>
                    </div>
                  )}

                  {/* وسائل التواصل الاجتماعي */}
                  {(service.facebookUrl || service.instagramUrl || service.tiktokUrl) && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[var(--text-muted)]">تواصل معنا</p>
                      <div className="flex flex-wrap gap-2">
                        {service.facebookUrl && (
                          <a href={service.facebookUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-500 hover:bg-blue-500/20 transition-colors">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                            فيسبوك
                          </a>
                        )}
                        {service.instagramUrl && (
                          <a href={service.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-2 text-xs font-bold text-white hover:opacity-90">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                            انستغرام
                          </a>
                        )}
                        {service.tiktokUrl && (
                          <a href={service.tiktokUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-2 text-xs font-bold text-white hover:opacity-90">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.47 4.17 1.31 1.84 3.75 3.1 6.01 3.1s4.7-1.26 6.01-3.1c.84-1.08 1.39-2.64 1.47-4.17.13 1.3-.96 2.5-2.25 2.5h-.32c-1.45 0-2.66-.95-3.03-2.52-.33-1.46-.54-2.95-.61-4.44-.38-1.5-1.1-3.61-2.31-4.99-1.27-1.45-3.12-2.57-5.2-2.72C10.85.08 11.6-.02 12.52.02zm4.26 4.7c-.02.16-.04.32-.07.49-.15.86-.53 1.86-1.13 2.51-1.27 1.3-3.27 2.05-4.95 2.05h-.4c-2.03 0-3.51-.92-4.45-2.53-.71-1.19-1.07-2.62-1.13-4.08-.03-.66-.05-1.33-.05-2 0-1.31.02-2.63.05-3.94.02-.87.1-1.76.23-2.66.25-1.86.9-3.1 2.34-4.1 1.27-1.03 2.93-1.59 4.54-1.76 1.69-.18 3.32-.12 4.62-.02.06 1.52.63 3.06 1.5 4.17.79.98 1.98 1.79 3.34 2.27.04.02.08.04.13.06l.13.06c.76.37 1.37.86 1.87 1.5.57.72.97 1.55 1.2 2.4.18.68.28 1.39.3 2.1.03.77.05 1.54.06 2.31.01.9-.02 1.79-.08 2.68-.07.98-.2 1.92-.4 2.87z"/></svg>
                            تيك توك
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* صور إضافية — الصورة الرئيسية مستبعدة لأن معرض البطاقة يعرضها */}
                  {extraImages.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[var(--text-muted)]">صور إضافية</p>
                      <div className="grid grid-cols-3 gap-2">
                        {extraImages.slice(0, 6).map((img, idx) => (
                          <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-xl overflow-hidden bg-[var(--bg-secondary)]">
                            <img src={img} alt={`${service.name} - صورة ${idx + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover hover:scale-105 transition-transform" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* الفيديو إن وجد */}
                  {service.video && (
                    <a href={service.video} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-[var(--bg-secondary)] px-4 py-3 transition-colors hover:bg-[var(--accent-soft)]">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white">
                        <Video className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[var(--text-muted)]">شاهد الفيديو</p>
                        <p className="text-sm font-bold text-blue-500 truncate">{service.video}</p>
                      </div>
                      <ExternalLink className="h-5 w-5 shrink-0 text-[var(--accent-primary)]" />
                    </a>
                  )}

                  {/* نهاية التفاصيل: كلمة «عرض أقل» مرة واحدة لإرجاع البطاقة للحالة المختصرة */}
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => toggleDetailsExpanded(serviceKey)}
                      aria-expanded={detailsOpen}
                      aria-controls={`browse-details-${serviceKey}`}
                      className="inline rounded px-2 py-1 text-sm font-bold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    >
                      عرض أقل
                    </button>
                  </div>
                </div>
              )}

              {/* شريط التفاعل والتعليقات — آخر البطاقة، بعد كل تفاصيل الخدمة */}
              {service.id !== undefined && (
                <PostInteractions
                  serviceId={service.id}
                  summary={summaries[String(service.id)] ?? { total: 0, byType: {}, top: null }}
                  myReaction={myReactions[String(service.id)] ?? null}
                  comments={commentsByService[String(service.id)] ?? []}
                  onToggleReaction={(type) => toggleReaction(service.id!, type)}
                  onAddComment={async (content) => { await addComment(service.id!, content); }}
                  onDeleteComment={deleteComment}
                  saved={savedIds.has(String(service.id))}
                  onToggleSaved={() => toggleSaved(service.id!)}
                  onOpenCategory={() => openServiceCategory(navigate, location, service, placement)}
                />
              )}
            </article>
          );
        })
      )}

      {visibleCount < feedItems.length && (
        <button type="button" className="w-full rounded-xl border border-[var(--border)] p-3 font-bold text-[var(--text-primary)]" onClick={() => setVisibleCount(count => count + 12)}>
          عرض المزيد
        </button>
      )}
      {showAddButton && onAddService && <button
        type="button"
        onClick={onAddService}
        aria-label="إضافة خدمة"
        title="إضافة خدمة"
        className="fixed bottom-4 left-3 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_0_20px_var(--glow)] transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] sm:bottom-8 sm:left-8"
        style={{ backgroundColor: 'var(--accent-primary)' }}
      >
        <Plus className="h-8 w-8" />
      </button>}
    </section>
  );
}
export default memo(SocialFeed);
