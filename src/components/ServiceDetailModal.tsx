import React, { memo, useLayoutEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Phone, MapPin, Navigation, Briefcase, ExternalLink, Hourglass, XCircle } from 'lucide-react';
import { Service } from '../hooks/useServices';
import { serviceStatusOverlayClass } from '../types/models';
import { useLanguage } from '../context/LanguageContext';
import { getServiceIcon } from '../data/serviceIcons';
import SafeImage from './SafeImage';
import ServiceStatusBadge from './ServiceStatusBadge';
import { useServiceVisits } from '../hooks/useServiceVisits';
import ServicePublicationTime from './ServicePublicationTime';
import { ServiceSocialLinks } from './ServiceSocialContacts';

interface ServiceDetailModalProps {
  service: Service;
  onClose: () => void;
  theme: string;
  colors: {
    bg: string;
    text: string;
    shadow: string;
  };
}

const visitNumber = new Intl.NumberFormat('en-US');

const ServiceVisitCount = memo(function ServiceVisitCount({ service }: { service: Service }) {
  const visits = useServiceVisits(service);
  return (
    <p className="pt-4 border-t border-[var(--border)] text-sm font-medium text-[var(--text-primary)]" aria-label="عدد زيارات الخدمة" aria-live="polite">
      <span aria-hidden="true">👁 </span>
      {visits === undefined ? 'عدد الزيارات غير متاح' : <><bdi>{visitNumber.format(visits)}</bdi> {visits >= 3 && visits <= 10 ? 'زيارات' : 'زيارة'}</>}
    </p>
  );
});

export default function ServiceDetailModal({ service, onClose, theme, colors }: ServiceDetailModalProps) {
  const { t } = useLanguage();
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [service.id, service.slug]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60"
        />

        {/* Modal Content */}
        <motion.div
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          aria-label={service.name}
          initial={{ opacity: 0, y: 12 }}
          animate={{ 
            opacity: 1, 
            y: 0,
            transition: { duration: 0.18, ease: 'easeOut' }
          }}
          exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}
          className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl shadow-[var(--shadow-lg)] bg-[var(--surface-elevated)] [contain:layout_paint]"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="الرجوع إلى القسم"
            className="absolute top-4 right-4 z-10 p-2 rounded-full backdrop-blur-md transition-colors bg-[var(--accent-soft)] hover:bg-[var(--accent-light)] text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Hero Image */}
          <div className="relative h-64 md:h-80 overflow-hidden">
            <SafeImage
              src={service.image}
              alt={service.name}
              className={`w-full h-full object-cover ${serviceStatusOverlayClass(service.status)}`}
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${
              'from-black/40'
            } to-transparent`} />

            {/* Status Badge Overlay — مكوّن موحد ServiceStatusBadge */}
            <ServiceStatusBadge status={service.status ?? 'approved'} variant="detail" />

            <div className="absolute bottom-6 left-6 right-6">
              {/* أيقونة نوع الخدمة — من النظام المركزي serviceIcons (نفس الأيقونة في كل التطبيق) */}
              {(() => {
                const CategoryIcon = getServiceIcon(service.categorySlug);
                return (
                  <div className="w-12 h-12 rounded-full bg-white border-2 border-[#D90429] shadow-md flex items-center justify-center mb-3">
                    <CategoryIcon className="w-6 h-6 text-[#D90429]" />
                  </div>
                );
              })()}
              <h2 className="text-3xl font-bold text-white mb-1 drop-shadow-lg">
                {service.name}
              </h2>
              {service.profession && (
                <p className="text-white/80 font-medium flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  {service.profession}
                </p>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-6">
            <ServicePublicationTime service={service} className="text-sm font-medium text-[var(--text-muted)]" />
            {/* Status Messages */}
            {service.status === 'pending' && (
              <div className={`flex items-center gap-3 p-4 rounded-2xl border border-yellow-500/30 bg-yellow-50`}>
                <div className="p-2 rounded-xl bg-yellow-500/20 text-yellow-500">
                  <Hourglass className="w-5 h-5" />
                </div>
                <div>
                  <p className={`font-bold text-yellow-600`}>⏳ بانتظار موافقة الإدارة</p>
                  <p className={`text-xs font-medium text-[var(--text-muted)]`}>
                    هذه الخدمة قيد المراجعة من قبل الإدارة وستظهر للجميع بعد الموافقة عليها.
                  </p>
                </div>
              </div>
            )}

            {service.status === 'rejected' && (
              <div className={`flex items-center gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-50`}>
                <div className="p-2 rounded-xl bg-red-500/20 text-red-500">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className={`font-bold text-red-600`}>تم رفض هذه الخدمة</p>
                  {service.rejectionReason ? (
                    <p className={`text-xs font-medium text-[var(--text-muted)]`}>
                      سبب الرفض: {service.rejectionReason}
                    </p>
                  ) : (
                    <p className={`text-xs font-medium text-[var(--text-muted)]`}>
                      لم يتم تحديد سبب الرفض. يرجى التواصل مع الإدارة.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Description/Experience */}
            {service.experience && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('description') || 'التفاصيل'}
                </h3>
                <p className="text-lg leading-relaxed text-[var(--text-primary)]">
                  {service.experience}
                </p>
              </div>
            )}

            {/* Contact & Location Info */}
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)]">
                <div className={`p-3 rounded-xl ${colors.bg}/20 ${colors.text}`}>
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)]">الموقع</p>
                  <p className="font-bold text-[var(--text-primary)]">{service.location}</p>
                </div>
              </div>

              {service.phone && (
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)]">
                  <div className={`p-3 rounded-xl bg-green-500/20 text-green-500`}>
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-muted)]">رقم الهاتف</p>
                    <p dir="ltr" className="font-bold text-[var(--text-primary)]">{service.phone}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions - Only show for approved services */}
            {service.status === 'approved' && (
              <div className="flex flex-col gap-3 pt-4">
                {service.phone && (
                  <a
                    href={`tel:${service.phone}`}
                    className={`flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-lg transition-all ${colors.bg} text-[var(--accent-contrast)] ${colors.shadow} hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    <Phone className="w-5 h-5" />
                    اتصال الآن
                  </a>
                )}

                {service.latitude && service.longitude && (
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${service.latitude},${service.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all bg-[var(--bg-secondary)] hover:bg-[var(--accent-soft)] text-[var(--text-primary)]"
                    >
                      <MapPin className="w-4 h-4" />
                      خرائط جوجل
                    </a>
                    <a
                      href={`https://waze.com/ul?ll=${service.latitude},${service.longitude}&navigate=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)] text-[var(--accent-primary)]`}
                    >
                      <Navigation className="w-4 h-4" />
                      ويز
                    </a>
                  </div>
                )}
              </div>
            )}
            <ServiceSocialLinks service={service} />
            <ServiceVisitCount service={service} />
          </div>
        </motion.div>
    </div>
  );
}
