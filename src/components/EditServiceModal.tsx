import React, { useState } from 'react';
import { X, Upload, MapPin, Phone, Type, LayoutGrid, Briefcase, Clock, Navigation } from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { useServices } from '../context/ServicesContext';
import { Service, isValidServiceId } from '../hooks/useServices';

import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import ServiceModalShell from './ServiceModalShell';
import { getCurrentPositionReliable } from '../lib/geolocation';

interface Props {
  service: Service;
  onClose: () => void;
  onSaved?: () => void;
}

export default function EditServiceModal({ service, onClose, onSaved }: Props) {
  const { theme } = useTheme();
  const { editService } = useServices();
  const { categories } = useCategories();
  const { t } = useLanguage();
  const [isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: service.name,
    profession: service.profession || '',
    experience: service.experience || '',
    phone: service.phone || '',
    location: service.location,
    image: service.image,
    categorySlug: service.categorySlug,
  });
  const [latitude, setLatitude] = useState<number | undefined>(service.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(service.longitude);

  const handleGetLocation = async () => {
    setIsLocating(true);
    try {
      const position = await getCurrentPositionReliable();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setLatitude(lat);
      setLongitude(lng);
      setFormData(prev => ({ ...prev, location: prev.location || `${lat.toFixed(5)}, ${lng.toFixed(5)}` }));
    } catch (error) {
      const geoError = error as GeolocationPositionError;
      if ((error as Error)?.message === 'GEOLOCATION_UNSUPPORTED') alert(t('browser_no_location'));
      else if (geoError.code === geoError.PERMISSION_DENIED) alert(t('location_denied'));
      else if (geoError.code === geoError.TIMEOUT) alert(t('location_timeout'));
      else if (geoError.code === geoError.POSITION_UNAVAILABLE) alert(t('location_unavailable'));
      else alert(t('location_error'));
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Strict validation: only the real numeric id from Supabase may be used.
    // Never fall back to slug - an UPDATE by slug would target the wrong row or none at all.
    if (!isValidServiceId(service.id)) {
      const msg = `لا يمكن حفظ التعديلات: الخدمة لا تحتوي على معرّف (id) رقمي صالح من قاعدة البيانات (القيمة المستلمة: ${JSON.stringify(service.id)}).`;
      console.error('[EditServiceModal]', msg);
      alert(msg);
      return;
    }

    if (isSaving) return; // prevent double-submit while the UPDATE is running
    setIsSaving(true);

    try {
      console.log('[EditServiceModal] Saving edits for service.id =', service.id);
      // ONE single UPDATE by services.id. The original categoryId is passed through
      // so that when the admin did NOT change the section, the exact same
      // category_id currently stored in the database is sent back - never a default.
      await editService(service.id, {
        ...formData,
        categoryId: service.categoryId ?? undefined,
        latitude,
        longitude
      });
      // Notify the parent (Admin Panel) so it re-fetches its lists straight from Supabase
      onSaved?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to update service:', error);
      alert(error?.message || 'تعذر حفظ التعديلات. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ServiceModalShell
      title={t('edit_service')}
      icon={<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400"><Type className="h-4 w-4" /></div>}
      onClose={onClose}
    >
        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-5 space-y-4 sm:space-y-5">
          {/* Category */}
          <div className="space-y-1.5">
            <label className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
              <LayoutGrid className="w-4 h-4" /> {t('section')}
            </label>
            <select
              value={formData.categorySlug}
              onChange={(e) => setFormData({ ...formData, categorySlug: e.target.value })}
              className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all appearance-none font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
            >
              {categories.map((cat: any) => (
                <option key={cat.slug} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
              <Type className="w-4 h-4" /> {t('service_name_label')}
            </label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
            />
          </div>

          {/* Profession */}
          <div className="space-y-1.5">
            <label className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
              <Briefcase className="w-4 h-4" /> {t('profession_label')}
            </label>
            <input
              required
              type="text"
              value={formData.profession}
              onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
              className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
            />
          </div>

          {/* Experience */}
          <div className="space-y-1.5">
            <label className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
              <Clock className="w-4 h-4" /> {t('experience_label')}
            </label>
            <textarea
              required
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all min-h-[80px] resize-y font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
            />
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <label className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
              <MapPin className="w-4 h-4" /> {t('location_label')}
            </label>
            <div className="flex min-w-0 gap-2">
              <input
                required
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className={`min-w-0 flex-1 border rounded-xl px-3 sm:px-4 py-3 focus:outline-none focus:border-blue-500 focus:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
              />
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={isLocating}
                className={`border rounded-xl px-4 flex items-center justify-center transition-all disabled:opacity-50 bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:border-[var(--border-strong)]`}
                title={t('get_current_location')}
              >
                <Navigation className={`w-5 h-5 ${isLocating ? 'animate-pulse text-blue-500' : ''}`} />
              </button>
            </div>
            {latitude && longitude && (
              <p className="text-xs text-blue-500 mt-1 font-bold" dir="ltr">
                📍 {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </p>
            )}
          </div>

          {/* Phone (Optional) */}
          <div className="space-y-1.5">
            <label className={`text-sm flex items-center gap-2 font-bold text-[var(--text-secondary)]`}>
              <Phone className="w-4 h-4" /> {t('phone_label')} <span className="text-[var(--text-secondary)] text-xs font-bold">({t('optional')})</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all text-left font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
              dir="ltr"
            />
          </div>
          
          {/* Action Buttons */}
          <div className={`sticky bottom-0 z-10 -mx-4 -mb-4 mt-4 flex shrink-0 gap-2 border-t border-[var(--border)] bg-[var(--surface-elevated)] p-3 sm:-mx-5 sm:-mb-5 sm:gap-3 sm:p-4`}>
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 font-bold py-3.5 rounded-xl transition-all bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:bg-[var(--accent-light)]`}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:shadow-[0_0_25px_rgba(59,130,246,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جارٍ الحفظ...
                </>
              ) : (
                t('save_changes')
              )}
            </button>
          </div>
        </form>
    </ServiceModalShell>
  );
}
