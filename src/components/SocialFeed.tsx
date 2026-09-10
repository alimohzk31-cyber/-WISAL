import { useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, MapPin, MessageCircle, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useServices } from '../context/ServicesContext';
import { useCategories } from '../hooks/useCategories';
import { useFeedInteractions } from '../hooks/useFeedInteractions';
import { getServiceIcon } from '../data/serviceIcons';
import SafeImage from './SafeImage';
import PostInteractions from './PostInteractions';
import { openServiceDetails } from '../lib/directoryNavigation';
import { useCategoryDirectory } from '../hooks/useCategoryDirectory';
import ServicePublicationTime from './ServicePublicationTime';
import { getServicePublicationTimestamp } from '../lib/servicePublicationTime';

interface SocialFeedProps {
  onAddService: () => void;
}

export default function SocialFeed({ onAddService }: SocialFeedProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { publicServices } = useServices();
  const { categories } = useCategories();
  const { locateService } = useCategoryDirectory(categories, publicServices);

  // التصفح الاجتماعي يعرض الخدمات المعتمدة للجميع، بالإضافة إلى الخدمات التي
  // أضافها هذا الجهاز وما زالت قيد المراجعة (تظهر له فوراً بعد الإضافة
  // دون تحديث الصفحة، مع شارة «قيد المراجعة» — لا تُرى للأجهزة الأخرى).
  // ملاحظة أداء/صحة: نسخة قبل الفرز (spread) — الفرز مكانياً (mutate) كان
  // يعيد ترتيب مصفوفة publicServices المشتركة مع باقي الصفحات ويُبطل الكاش.
  const feedItems = useMemo(() => {
    return [...publicServices]
      .sort((a, b) => getServicePublicationTimestamp(b) - getServicePublicationTimestamp(a));
  }, [publicServices]);

  // نظام التفاعلات والتعليقات (service_reactions / service_comments)
  const {
    summaries,
    myReactions,
    commentsByService,
    toggleReaction,
    addComment,
    deleteComment,
  } = useFeedInteractions(feedItems.map((s) => s.id).filter((id) => id !== undefined));

  return (
    <section className="relative z-10 mx-auto max-w-2xl space-y-5" aria-label="التصفح">
      {feedItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-16 text-center">
          <MessageCircle className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">لا توجد منشورات للعرض حاليًا</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">ستظهر هنا الخدمات المعتمدة عند توفرها.</p>
        </div>
      ) : (
        feedItems.map((service) => {
          const Icon = getServiceIcon(service.categorySlug);
          const categoryName = categories.find((category) => category.slug === service.categorySlug)?.name ?? service.categorySlug;

          return (
            <article key={String(service.id ?? service.slug)} className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)]">
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#D90429] bg-white">
                  <Icon className="h-5 w-5 text-[#D90429]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[var(--text-primary)]">{service.name}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-[var(--text-muted)]">{categoryName}</p>
                    {service.status === 'pending' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        قيد المراجعة
                      </span>
                    )}
                  </div>
                </div>
                <ServicePublicationTime service={service} className="shrink-0 text-xs text-[var(--text-muted)]" />
              </div>

              {service.image && (
                <SafeImage src={service.image} alt={service.name} className="h-40 w-full object-cover sm:h-48" />
              )}

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

              <div className="space-y-3 p-4">
                {service.profession && (
                  <p className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><Briefcase className="h-4 w-4 text-[var(--accent-primary)]" />{service.profession}</p>
                )}
                {service.location && (
                  <p className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><MapPin className="h-4 w-4 text-[var(--accent-primary)]" />{service.location}</p>
                )}
                {service.experience && <p className="line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">{service.experience}</p>}
                <button type="button" disabled={!Number.isSafeInteger(Number(service.id)) || Number(service.id) <= 0} onClick={() => openServiceDetails(navigate, location, service, locateService(service))} className="inline-flex rounded-xl bg-[var(--accent-soft)] px-4 py-2 text-sm font-bold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-light)]">
                  معاينة الخدمة
                </button>
              </div>
            </article>
          );
        })
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
