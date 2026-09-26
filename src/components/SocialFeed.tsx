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
import { ServiceSocialLinks } from './ServiceSocialContacts';
import { useSavedServices } from '../hooks/useSavedServices';
import type { Service } from '../types/models';
import { getGoogleMapsUrl, getServiceCoordinates, getServiceLocationParts, getWazeUrl } from '../lib/serviceLocation';
import { sanitizeExternalUrl, sanitizeTelUrl } from '../lib/externalUrl';

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
          const extraImages = getBrowseExtraImages(service).map(image => sanitizeExternalUrl(image)).filter((image): image is string => Boolean(image));
          const videoUrl = sanitizeExternalUrl(service.video);
          const phoneUrl = sanitizeTelUrl(service.phone);
          const serviceKey = String(service.id ?? service.slug);
          const detailsOpen = isDetailsExpanded(serviceKey);
          const description = getBrowseDescriptionPreview(service.experience);
          const coordinates = getServiceCoordinates(service);
          const profession = service.profession?.trim();
          const locationParts = getServiceLocationParts(service.location);
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

                {(profession || locationParts.length > 0) && (
                  <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-5 text-[var(--text-muted)]">
                    {profession && (
                      <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
                        <span className="break-words">{profession}</span>
                      </span>
                    )}
                    {profession && locationParts.length > 0 && <span aria-hidden="true">•</span>}
                    {locationParts.map((part, index) => (
                      <span key={`${part}-${index}`} className="inline-flex min-w-0 max-w-full items-center gap-1">
                        {index > 0 && <span aria-hidden="true">•</span>}
                        {index === 0 && <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />}
                        <span className="break-words">{part}</span>
                      </span>
                    ))}
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

                  {phoneUrl && (
                    <a
                      href={phoneUrl}
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

                  {coordinates && (
                    <div className="flex flex-wrap gap-2">
                      <a href={getGoogleMapsUrl(coordinates)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-bold text-[var(--accent-primary)] hover:bg-[var(--accent-light)] transition-colors">
                        <MapPin className="h-3 w-3" /> خرائط جوجل
                      </a>
                      <a href={getWazeUrl(coordinates)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--accent-soft)] transition-colors">
                        <Navigation className="h-3 w-3" /> ويز
                      </a>
                    </div>
                  )}

                  {/* وسائل التواصل الاجتماعي — أيقونات صغيرة فقط للحسابات التي أضافها صاحب الخدمة فعليًا،
                      مع تحقق وتطبيع للروابط (socialContactUrl) وفتح واتساب برقم مطبَّع صحيح. */}
                  <ServiceSocialLinks service={service} compact title="تواصل معنا" />

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
                  {videoUrl && (
                    <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-[var(--bg-secondary)] px-4 py-3 transition-colors hover:bg-[var(--accent-soft)]">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white">
                        <Video className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[var(--text-muted)]">شاهد الفيديو</p>
                        <p className="text-sm font-bold text-blue-500 truncate">{videoUrl}</p>
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
