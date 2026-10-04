import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import React, { useState, useRef } from 'react';
import { X, Upload, MapPin, Phone, Type, LayoutGrid, Briefcase, Clock, Navigation, Image as ImageIcon } from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { useServices, getOwnerId } from '../context/ServicesContext';
import { getInitialProfession, getServiceFormConfig } from '../lib/serviceFormConfig';
import type { Section, ServiceRegistrationAttachment, ServiceRegistrationDraft } from '../types/models';
import ServiceRegistrationFields from './ServiceRegistrationFields';
import ServiceImagePicker from './ServiceImagePicker';

import { useLanguage } from '../context/LanguageContext';

import ServiceModalShell from './ServiceModalShell';
import { useToast } from './ToastProvider';
import { getCurrentPositionReliable } from '../lib/geolocation';
import { SocialContactFields } from './ServiceSocialContacts';
import { invalidSocialContact } from '../lib/serviceSocialLinks';
import { optimizeImageToDataUrl } from '../lib/imageOptimization';
import { resolveServiceCategory, type ServiceJoinTarget } from '../lib/serviceCategorySelection';
import { getMissingServiceFields } from '../lib/serviceFormValidation';

interface Props {
  onClose: () => void;
  initialCategorySlug?: string;
  initialProfession?: string;
  /** سياق الانضمام ثابت؛ الإضافة العامة تبقى بنفس النموذج مع اختيار القسم. */
  joinSection?: Pick<Section, 'slug' | 'name'> & { childSlug?: string; childName?: string };
  /** هوية القسم/الفرع الصريحة من صفحة القسم: تُغني عن إعادة البحث بالـ slug. */
  initialCategory?: ServiceJoinTarget;
  /** معاينة محلية فقط لحين اعتماد التخزين؛ لا تستدعي addService أو أي حفظ. */
  registrationPreview?: { onSubmit: (draft: ServiceRegistrationDraft) => void };
  isAdmin?: boolean;
  /** يُستدعى بعد نجاح حفظ الخدمة في Supabase (يستخدمه الأدمن لتحديث قائمة «الخدمات المضافة حديثًا»). */
  onSaved?: () => void;
}

export default function AddServiceModal({ onClose, initialCategorySlug, initialProfession, joinSection, initialCategory, registrationPreview, onSaved }: Props) {

  const { addService } = useServices();
  const { categories } = useCategories();
  const { t } = useLanguage();
  const pushToast = useToast();
    const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    profession: '',
    experience: '',
    phone: '',
    whatsappPhone: '',
    facebookUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    location: '', // This will be the Area Name
    coordinatesInput: '', // Manual coordinates input
    image: '',
    categorySlug: initialCategorySlug ?? '',
  });

  const selectableCategories = React.useMemo(
    () => categories.filter((category: any) => category.dbId !== undefined && category.dbId !== null),
    [categories]
  );

  // A section entry can arrive before its DB-backed source category is known
  // (notably for child routes such as home-services/carpenter). Resolve the
  // source by its directory placement as a fallback so the INSERT receives a
  // real categories.id instead of an empty/parent slug.
  // القسم الحالي معروف من صفحة القسم (initialCategory): يفوز دائمًا على أي
  // بحث داخل قائمة الأقسام العامة قد تكون لم تُحمّل بعد أو تحتوي slug مختلفًا.
  // وإذا لم يوجد صف DB مطابق نبني الخيار التركيبي من هوية القسم نفسها حتى لا
  // يتعطل الحفظ — مسار الحفظ (useServices → ensureSectionCategoryRow) هو
  // الذي يجهّز صف categories المطابق للـ FK. بهذا يتزامن مصدر القسم بين
  // حقول النموذج (categorySlug/categorySource) وزر الحفظ (canSubmit):
  // مصدر واحد بدل مصدرين متناقضين.
  const selectedCategory =
    resolveServiceCategory(selectableCategories, initialCategorySlug, joinSection, initialCategory) ??
    (initialCategory
      ? { slug: initialCategory.slug, name: initialCategory.name, dbId: initialCategory.dbId }
      : undefined);
  const categorySlug = joinSection ? selectedCategory?.slug ?? initialCategorySlug ?? '' : formData.categorySlug;
  const categorySource = selectedCategory ?? categories.find(category => category.slug === categorySlug);
  const fieldConfig = getServiceFormConfig(
    categorySource ?? { slug: categorySlug, name: joinSection?.name ?? '' },
    joinSection?.slug,
    joinSection?.childSlug,
  );
  const allowCustomSpecialty = fieldConfig.allowCustomSpecialty !== false;
  const registration = registrationPreview ? fieldConfig.registration : undefined;
  const [registrationDetails, setRegistrationDetails] = useState<Record<string, string>>({});
  const [registrationImages, setRegistrationImages] = useState<string[]>([]);
  const [registrationAttachment, setRegistrationAttachment] = useState<ServiceRegistrationAttachment>();
  const [registrationError, setRegistrationError] = useState('');
  const [imagesBusy, setImagesBusy] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const missingRequiredFields = getMissingServiceFields({ registration, registrationDetails, registrationImages, name: formData.name, phone: formData.phone, categorySelected: Boolean(selectedCategory), profession: formData.profession, experience: formData.experience, location: formData.location });
  const missingFieldsMessage = missingRequiredFields.length ? '\u0623\u0643\u0645\u0644 \u0627\u0644\u062d\u0642\u0648\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629: ' + missingRequiredFields.join('\u060c ') : '';
  React.useEffect(() => { if (!missingRequiredFields.length) setRegistrationError(''); }, [missingRequiredFields.join('|')]);

    // Sync categorySlug if categories load after modal opens
  React.useEffect(() => {
    if (joinSection) return;
    const requested = selectableCategories.find((category: any) => category.slug === initialCategorySlug);
    const currentIsValid = selectableCategories.some((category: any) => category.slug === formData.categorySlug);
    // A display-only section has no stored category to preselect. Leave the
    // placeholder selected instead of silently submitting to an unrelated field.
    const nextSlug = currentIsValid ? formData.categorySlug : requested?.slug ?? (initialCategorySlug === '' ? '' : selectableCategories[0]?.slug ?? '');
    if (nextSlug !== formData.categorySlug) {
      setFormData(prev => ({ ...prev, categorySlug: nextSlug }));
    }
  }, [selectableCategories, initialCategorySlug, formData.categorySlug, joinSection]);

  // حالة اختيار التخصص في قائمة المهن (chosen / custom)
  const [professionSelectMode, setProfessionSelectMode] = useState<'chosen' | 'custom'>('chosen');

  // عند تغيير القسم: عبئ المهنة تلقيقاً من إعدادات القسم لضمان أن بيانات القسم السابقة لا تظهر
  React.useEffect(() => {
      const profession = getInitialProfession(fieldConfig, initialProfession);
      setFormData((f) => ({ ...f, profession }));
      setProfessionSelectMode('chosen'); // نعيد الوضع الافتراضي للقسم الجديد
  }, [categorySlug, fieldConfig, initialProfession]);




  const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert(t('image_too_large'));
        return;
      }
      try {
        const optimized = await optimizeImageToDataUrl(file, 1280, 1280, 0.78);
        setFormData(prev => ({ ...prev, image: optimized }));
      } catch {
        alert('تعذر تجهيز الصورة. يرجى اختيار صورة أخرى.');
      }
    }
  };

  const handleGetLocation = async () => {
    setIsLocating(true);
    try {
      const position = await getCurrentPositionReliable();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const coordsStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setCoordinates({ lat, lng });
      setFormData(prev => ({ ...prev, coordinatesInput: coordsStr }));
    } catch (error) {
      const geoError = error as GeolocationPositionError;
      if ((error as Error)?.message === 'GEOLOCATION_UNSUPPORTED') alert(t('browser_no_location'));
      else if (geoError.code === geoError.PERMISSION_DENIED) alert(t('location_denied'));
      else if (geoError.code === geoError.TIMEOUT) alert(t('location_timeout'));
      else alert(t('location_error'));
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const invalidSocial = invalidSocialContact(formData);
    if (invalidSocial) {
      alert('تحقق من رقم واتساب وروابط حسابات التواصل قبل الحفظ.');
      return;
    }

    if (registrationPreview) {
      if (!registration || imagesBusy || attachmentBusy) return;
      if (missingRequiredFields.length) { setRegistrationError(missingFieldsMessage); return; }
      setRegistrationError('');
      registrationPreview.onSubmit({
        name: formData.name.trim(), phone: formData.phone.trim(),
        whatsappPhone: formData.whatsappPhone.trim() || undefined,
        facebookUrl: formData.facebookUrl.trim() || undefined,
        instagramUrl: formData.instagramUrl.trim() || undefined,
        tiktokUrl: formData.tiktokUrl.trim() || undefined,
        categorySlug, categoryId: selectedCategory?.dbId,
        details: Object.fromEntries(Object.entries(registrationDetails).map(([key, value]) => [key, value.trim()])),
        images: registrationImages, credential: registrationAttachment,
        status: 'pending',
      });
      return;
    }

    if (missingRequiredFields.length) { setRegistrationError(missingFieldsMessage); return; }

    if (!selectedCategory) {
      alert(joinSection ? 'تعذر تجهيز الانضمام إلى هذا القسم حاليًا. أغلق النافذة وحاول مجددًا بعد تحميل الأقسام.' : 'يرجى اختيار قسم صالح قبل إرسال الخدمة.');
      return;
    }
    if (!formData.profession.trim() || (fieldConfig.specialties.length > 0 &&
      (!allowCustomSpecialty || professionSelectMode === 'chosen') && !fieldConfig.specialties.includes(formData.profession))) {
      alert('يرجى تحديد التخصص أو نوع الخدمة قبل الإرسال.');
      return;
    }
    
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    // Generate a more robust slug that works with Arabic and is unique
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 7);
    const nameSlug = formData.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\u0600-\u06FFa-z0-9-]/g, '') // Keep Arabic characters, a-z, 0-9 and hyphens
      .substring(0, 50);
    
    const slug = `${nameSlug || 'service'}-${timestamp}-${randomStr}`;

    // Parse coordinates if manually entered
    let finalCoords = coordinates;
    if (formData.coordinatesInput && !finalCoords) {
      const parts = formData.coordinatesInput.split(',').map(p => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        finalCoords = { lat: parts[0], lng: parts[1] };
      }
    }


    // Resolve the REAL categories.id of the currently selected section.
    // This is the value saved into services.category_id (FK) - never null
    // while the section is known. The slug alone is NOT enough because a DB
    // trigger derives category_slug from category_id on INSERT.
    try {
      await addService({
        slug,
        name: formData.name,
        profession: formData.profession,
        experience: formData.experience,
        phone: formData.phone,
        whatsappPhone: formData.whatsappPhone.trim() || undefined,
        facebookUrl: formData.facebookUrl.trim() || undefined,
        instagramUrl: formData.instagramUrl.trim() || undefined,
        tiktokUrl: formData.tiktokUrl.trim() || undefined,
        location: formData.location,
        latitude: finalCoords?.lat,
        longitude: finalCoords?.lng,
        image: formData.image || 'https://images.unsplash.com/photo-1556761175-5973dc0f32b7?w=800&q=80',
        categorySlug: selectedCategory.slug,
        categoryId: selectedCategory.dbId,
        // القاعدة الأساسية: أي خدمة جديدة تكون pending دائماً
        // (حتى المضافة من لوحة الإدارة) ولا تظهر للعامة إلا بعد موافقة المدير.
        status: 'pending',
        ownerId: getOwnerId(),
      });
      
      pushToast('success', 'تم حفظ خدمتك بنجاح، وهي الآن بانتظار موافقة الإدارة');
      // إعلام المتصل بالنجاح (لوحة الإدارة تحدّث بها قائمة «الخدمات المضافة حديثًا» فورًا
      // دون انتظار إعادة تحميل الصفحة أو إعادة تشغيل التطبيق).
      onSaved?.();
      onClose();
    } catch (error: any) {
      // Surface the REAL Supabase error - never pretend the save succeeded
      console.error("Error adding service:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      alert(
        `تعذر حفظ الخدمة في قاعدة البيانات.\n` +
        `السبب: ${error?.message || 'خطأ غير معروف'}` +
        (error?.code ? `\nرمز الخطأ: ${error.code}` : '') +
        (error?.hint ? `\nتلميح: ${error.hint}` : '')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ServiceModalShell
      title={joinSection ? `انضم إلى قسم ${joinSection.name} وكن واحدًا من مقدمي خدماته في وصال` : t('add_new_service')}
      wrapTitle={Boolean(joinSection)}
      icon={<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)]"><Upload className="h-4 w-4" /></div>}
      onClose={onClose}
    >
        <form onSubmit={handleSubmit} className="min-h-0 min-w-0 space-y-4 overflow-y-auto overscroll-contain p-4 sm:space-y-5 sm:p-5">
          {registration && <p className="rounded-xl bg-[var(--accent-soft)] p-3 text-xs leading-6 text-[var(--text-primary)]">معاينة النموذج الجديد — الإرسال الفعلي ينتظر اعتماد التخزين. الحقول المعلّمة بـ * مطلوبة.</p>}
          {/* Category */}
          {!joinSection && <div className="space-y-1.5">
            <label htmlFor="service-category" className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
              <LayoutGrid className="w-4 h-4" /> {t('section')}
            </label>
            <select
              id="service-category"
              value={formData.categorySlug}
              onChange={(e) => setFormData({ ...formData, categorySlug: e.target.value })}
              className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all appearance-none font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
            >
              <option value="" disabled>اختر قسمًا</option>
              {selectableCategories.map((cat: any) => (
                <option key={cat.slug} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
          </div>}

          {joinSection && !selectedCategory && !registration && (
            <p role="status" className="rounded-xl bg-[var(--accent-soft)] p-3 text-sm text-[var(--text-primary)]">
              الانضمام إلى هذا القسم غير متاح حاليًا. حاول مجددًا بعد تحميل الأقسام.
            </p>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label htmlFor="service-name" className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
                          <Type className="w-4 h-4" /> {fieldConfig.nameLabel || t('service_name_label')} {registration && <span aria-hidden="true">*</span>}
            </label>
            <input
              id="service-name"
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
              placeholder={fieldConfig.namePlaceholder || t('service_name_placeholder')}
            />
          </div>

          {registration && <ServiceRegistrationFields config={registration} values={registrationDetails} onChange={setRegistrationDetails} attachment={registrationAttachment} onAttachment={setRegistrationAttachment} onBusy={setAttachmentBusy} />}

          {!registration && <>
                    {/* Profession / التخصص — يصبح ديناميكياً حسب القسم */}
          <div className="space-y-1.5">
            <label className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
              <Briefcase className="w-4 h-4" /> {fieldConfig.professionLabel || (fieldConfig.specialties.length ? 'التخصص / نوع الخدمة' : t('profession_label'))}
            </label>
            {fieldConfig.specialties.length > 0 ? (
              // إذا كان للقسم تخصصات محددة: قائمة اختيار مع خيار "أخرى" يفتح حقل نص
              <>
                <select
                  required
                  aria-label={fieldConfig.professionLabel || 'التخصص / نوع الخدمة'}
                  value={professionSelectMode === 'custom' ? '__custom__' : formData.profession}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      setProfessionSelectMode('custom');
                      setFormData({ ...formData, profession: '' });
                    } else {
                      setFormData({ ...formData, profession: val });
                      setProfessionSelectMode('chosen');
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)] appearance-none`}
                >
                  <option value="" disabled hidden>اختر التخصص</option>
                  {fieldConfig.specialties.map((sp, i) => (
                    <option key={i} value={sp}>{sp}</option>
                  ))}
                  {allowCustomSpecialty && <option value="__custom__">أخرى...</option>}
                </select>
                {allowCustomSpecialty && professionSelectMode === 'custom' && (
                  <input
                    required
                    aria-label="تخصص آخر"
                    type="text"
                    value={formData.profession}
                    onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                    className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)] mt-2`}
                    placeholder={t('profession_placeholder')}
                  />
                )}
              </>
            ) : (
              // بدون تخصصات محددة: حقل نص حر (سلوك النظام القديم)
              <input
                required
                type="text"
                value={formData.profession}
                onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
                placeholder={t('profession_placeholder')}
              />
            )}
          </div>


          {/* Experience */}
          <div className="space-y-1.5">
            <label className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
              <Clock className="w-4 h-4" /> {fieldConfig.experienceLabel || 'نبذة عن الخدمة والخبرات'}
            </label>
            <textarea
              required
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all min-h-[80px] resize-y font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
              placeholder={fieldConfig.experiencePlaceholder || 'عرّف بخدماتك وخبراتك وأبرز التفاصيل التي يحتاجها المستفيد.'}
            />
          </div>

          {/* Area Name */}
          <div className="space-y-1.5">
            <label className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
              <MapPin className="w-4 h-4" /> {fieldConfig.locationLabel || t('location_label')}
            </label>
            <input
              required
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
              placeholder={fieldConfig.locationPlaceholder || t('location_placeholder')}
            />
          </div>

          {/* Coordinates */}
          <div className="space-y-1.5">
            <label className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
              <Navigation className="w-4 h-4" /> {t('coordinates_label')}
            </label>
            <div className="flex min-w-0 gap-2">
              <input
                type="text"
                value={formData.coordinatesInput}
                onChange={(e) => setFormData({ ...formData, coordinatesInput: e.target.value })}
                className={`min-w-0 flex-1 border rounded-xl px-3 sm:px-4 py-3 focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all text-sm font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
                placeholder={t('coordinates_placeholder')}
                dir="ltr"
              />
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={isLocating}
                className={`border rounded-xl px-4 flex items-center justify-center transition-all disabled:opacity-50 bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:border-[var(--border-strong)]`}
                title={t('get_current_location')}
              >
                <Navigation className={`w-5 h-5 ${isLocating ? 'animate-pulse text-[var(--accent-primary)]' : ''}`} />
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 font-bold">
              {t('coordinates_help')}
            </p>
          </div>

          {/* Phone (Optional) */}
          </>}
          <div className="space-y-1.5">
            <label htmlFor="service-phone" className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
              <Phone className="w-4 h-4" /> {registration ? 'رقم الهاتف' : fieldConfig.phoneLabel || t('phone_label')} {registration?.phoneRequired ? <span aria-hidden="true">*</span> : <span className="text-[var(--text-secondary)] text-xs font-bold">({t('optional')})</span>}
            </label>
            <input
              id="service-phone"
              required={registration?.phoneRequired}
              minLength={registration ? 7 : undefined}
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all text-left font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
              placeholder="07X XXXX XXXX"
              dir="ltr"
            />
          </div>

          <SocialContactFields values={formData} onChange={(field, value) => setFormData(current => ({ ...current, [field]: value }))} />

          {/* Image Upload */}
          {registration ? <ServiceImagePicker images={registrationImages} onChange={setRegistrationImages} onBusy={setImagesBusy} /> : <div className="space-y-1.5">
            <label className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
              <ImageIcon className="w-4 h-4" /> {t('service_image_label')}
            </label>
            <div className="flex flex-col gap-3">
              {formData.image ? (
                <div className={`relative flex min-h-48 max-h-[32rem] w-full items-center justify-center overflow-hidden rounded-xl border bg-[var(--bg-secondary)] group border-[var(--border)]`}>
                  <img src={formData.image} alt="Preview" className="block h-auto max-h-[32rem] w-full object-contain object-center" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-[var(--accent-primary)] hover:text-white transition-all"
                      title={t('change_image')}
                    >
                      <Upload className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                      className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-red-500 transition-all"
                      title={t('delete_image')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group bg-[var(--bg-secondary)] border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)]`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all bg-[var(--surface-elevated)] group-hover:bg-[var(--accent-soft)] group-hover:scale-110`}>
                    <ImageIcon className={`w-7 h-7 transition-colors text-[var(--text-muted)] group-hover:text-[var(--text-primary)]`} />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-bold text-[var(--text-primary)]`}>{t('add_image_help')}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 font-bold">{t('image_quality_help')}</p>
                  </div>
                </button>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          }
          {/* Action Buttons */}
          {(registrationError || missingFieldsMessage) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{registrationError || missingFieldsMessage}</p>}
          <div className={`sticky bottom-0 z-10 -mx-4 -mb-4 mt-4 flex shrink-0 flex-col gap-2 border-t border-[var(--border)] bg-[var(--surface-elevated)] p-3 min-[360px]:flex-row sm:-mx-5 sm:-mb-5 sm:gap-3 sm:p-4`}>
            <button
              type="button"
              onClick={onClose}
              className={`w-full min-w-0 flex-1 rounded-xl bg-[var(--surface-elevated)] py-3.5 font-bold text-[var(--text-primary)] transition-all hover:bg-[var(--bg-secondary)]`}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || imagesBusy || attachmentBusy || missingRequiredFields.length > 0}
                            className="app-btn-accent flex w-full min-w-0 flex-1 items-center justify-center gap-2 rounded-xl py-3.5 font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  {t('saving')}
                </>
              ) : (
                registration || joinSection ? '\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645' : t('save_data')
              )}
            </button>
          </div>
        </form>
    </ServiceModalShell>
  );
}
