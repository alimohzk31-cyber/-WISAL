import { useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, LayoutGrid, MapPin, MessageCircle, Plus } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
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
import { getBrowseDescriptionPreview } from '../lib/browseServiceCard';

interface SocialFeedProps {
  onAddService: () => void;
}

function getBrowseImages(service: { image?: string; images?: string[] }): string[] {
  return Array.from(new Set([service.image, ...(service.images ?? [])]
    .filter((image): image is string => typeof image === 'string' && image.trim().length > 0)));
}

function SocialFeed({ onAddService }: SocialFeedProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { publicServices } = useServices();
  const { categories } = useCategories();
  const { sections, locateService } = useCategoryDirectory(categories, publicServices);

  // التصفح الاجتماعي يعرض الخدمات المعتمدة للجميع، بالإضافة إلى الخدمات التي
  // أضافها هذا الجهاز وما زالت قيد المراجعة (تظهر له فوراً بعد الإضافة
  // دون تحديث الصفحة، مع شارة «قيد المراجعة» — لا تُرى للأجهزة الأخرى).
  // ملاحظة أداء/صحة: نسخة قبل الفرز (spread) — الفرز مكانياً (mutate) كان
  // يعيد ترتيب مصفوفة publicServices المشتركة مع باقي الصفحات ويُبطل الكاش.
  const feedItems = useMemo(() => {
    return [...publicServices]
      .sort((a, b) => getServicePublicationTimestamp(b) - getServicePublicationTimestamp(a));
  }, [publicServices]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(() => new Set());
  const visibleItems = useMemo(() => feedItems.slice(0, visibleCount), [feedItems, visibleCount]);

  const toggleDetails = (serviceKey: string) => {
    setExpandedServices(current => {
      const next = new Set(current);
      if (next.has(serviceKey)) next.delete(serviceKey);
      else next.add(serviceKey);
      return next;
    });
  };

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
    <section className="relative z-10 mx-auto max-w-2xl space-y-5" aria-label="التصفح">
      {feedItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-16 text-center">
          <MessageCircle className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">لا توجد منشورات للعرض حاليًا</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">ستظهر هنا الخدمات المعتمدة عند توفرها.</p>
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
          const serviceKey = String(service.id ?? service.slug);
          const expanded = expandedServices.has(serviceKey);
          const description = getBrowseDescriptionPreview(service.experience);

          return (
            <article key={serviceKey} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)]">
              <div className="flex items-center gap-3 px-3.5 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#D90429] bg-white">
                  <Icon className="h-5 w-5 text-[#D90429]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-bold text-[var(--text-secondary)]">{categoryName}</p>
                    {service.status === 'pending' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        قيد المراجعة
                      </span>
                    )}
                  </div>
                </div>
                <ServicePublicationTime service={service} className="shrink-0 text-xs text-[var(--text-muted)]" />
              </div>

              <LazyServiceGallery service={service} images={browseImages} />

              <div className="space-y-2.5 px-3.5 pb-3 pt-3">
                <h2 className="text-base font-bold text-[var(--text-primary)]">{service.name}</h2>

                {(service.profession || service.location) && (
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-[var(--text-muted)]">
                    {service.profession && <><Briefcase className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" /><span className="truncate">{service.profession}</span></>}
                    {service.profession && service.location && <span aria-hidden="true">•</span>}
                    {service.location && <><MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" /><span className="truncate">{service.location}</span></>}
                  </p>
                )}

                {description.text && (
                  <p id={`browse-details-${serviceKey}`} className="text-sm leading-6 text-[var(--text-muted)]">
                    <span className="transition-opacity duration-150">
                      {expanded ? service.experience?.trim() : description.text}
                    </span>{' '}
                    {description.truncated && (
                      <button
                        type="button"
                        onClick={() => toggleDetails(serviceKey)}
                        aria-expanded={expanded}
                        aria-controls={`browse-details-${serviceKey}`}
                        className="inline rounded px-1 font-bold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                      >
                        {expanded ? 'عرض أقل' : 'المزيد'}
                      </button>
                    )}
                  </p>
                )}
              </div>

              {/* شريط التفاعل والتعليقات — مباشرة أسفل صورة المنشور */}
              {service.id !== undefined && (
                <PostInteractions
                  serviceId={service.id}
                  summary={summaries[String(service.id)] ?? { total: 0, byType: {}, top: null }}
                  myReaction={myReactions[String(service.id)] ?? null}
                  comments={commentsByService[String(service.id)] ?? []}
                  onToggleReaction={(type) => toggleReaction(service.id!, type)}
                  onAddComment={async (content) => { await addComment(service.id!, content); }}
                  onDeleteComment={deleteComment}
                />
              )}

              <div className="border-t border-[var(--border)] px-3.5 py-3">
                <button type="button" onClick={() => openServiceCategory(navigate, location, service, placement)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-soft)] px-4 py-2.5 text-sm font-bold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-light)]">
                  <LayoutGrid className="h-4 w-4" /> الدخول إلى القسم
                </button>
              </div>
            </article>
          );
        })
      )}

      {visibleCount < feedItems.length && (
        <button type="button" className="w-full rounded-xl border border-[var(--border)] p-3 font-bold text-[var(--text-primary)]" onClick={() => setVisibleCount(count => count + 12)}>
          عرض المزيد
        </button>
      )}
      <button
        type="button"
        onClick={onAddService}
        aria-label="إضافة خدمة"
        title="إضافة خدمة"
        className="fixed bottom-8 left-8 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_0_20px_var(--glow)] transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
        style={{ backgroundColor: 'var(--accent-primary)' }}
      >
        <Plus className="h-8 w-8" />
      </button>
    </section>
  );
}
export default memo(SocialFeed);
