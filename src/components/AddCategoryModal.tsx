import React, { useState } from 'react';
import { X, Plus, Image as ImageIcon, Type } from 'lucide-react';
import { colorMap } from '../data/categories';
import { CATEGORY_ICON_MAP, CATEGORY_ICON_NAMES } from '../data/categoryIcons';

import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface Props {
  onClose: () => void;
  onAdd: (category: any) => Promise<void>;
}

export default function AddCategoryModal({ onClose, onAdd }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    icon: 'Folder',
    color: 'green',
    image: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const generatedSlug = formData.name.toLowerCase().replace(/\s+/g, '-');
      await onAdd({
        slug: generatedSlug,
        name: formData.name,
        icon: formData.icon,
        color: formData.color,
        image: formData.image,
      });
      onClose();
    } catch (error) {
      console.error("Failed to add category", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className={`w-full max-w-2xl border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-8 bg-[var(--surface-elevated)] border-[var(--border)]`}>
        <div className={`p-4 border-b flex items-center justify-between sticky top-0 z-10 bg-[var(--surface-elevated)] border-[var(--border)]`}>
          <h2 className={`text-lg font-bold flex items-center gap-2 text-[var(--text-primary)]`}>
            <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent-primary)]">
              <Plus className="w-4 h-4" />
            </div>
            {t('add_new_section')}
          </h2>
          <button onClick={onClose} className={`p-1 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-soft)]`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className={`text-sm font-bold text-[var(--text-secondary)]`}>{t('section_name_label')}</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--accent-primary)] transition-all font-bold bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]`}
                  placeholder={t('section_name_placeholder')}
                />
              </div>

              {/* Color */}
              <div className="space-y-1.5">
                <label className={`text-sm font-bold text-[var(--text-secondary)]`}>{t('neon_color_label')}</label>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(colorMap).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: key })}
                      className={`w-full aspect-square rounded-lg border-2 transition-all ${value.bg} ${formData.color === key ? 'border-white scale-110' : 'border-transparent hover:scale-105 opacity-50 hover:opacity-100'}`}
                      title={key}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Icon Selector */}
            <div className="space-y-1.5">
              <label className={`text-sm font-bold text-[var(--text-secondary)]`}>{t('section_icon_label')}</label>
              <div className={`border rounded-xl p-3 h-[280px] overflow-y-auto grid grid-cols-5 gap-2 bg-[var(--bg-secondary)] border-[var(--border)]`}>
                {CATEGORY_ICON_NAMES.map(iconName => {
                  const IconComponent = CATEGORY_ICON_MAP[iconName];
                  if (!IconComponent) return null;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: iconName })}
                      className={`p-2 rounded-lg flex items-center justify-center transition-all ${formData.icon === iconName ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}
                      title={iconName}
                    >
                      <IconComponent className="w-6 h-6" />
                    </button>
                  );
                })}
                {/* Image Picker Icon */}
                <label
                  className={`p-2 rounded-lg flex items-center justify-center cursor-pointer transition-all border text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)] border-transparent`}
                  title="Upload Image"
                >
                  <ImageIcon className="w-6 h-6" />
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setFormData({ ...formData, image: reader.result as string });
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className={`flex gap-3 pt-4 border-t border-[var(--border)]`}>
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 font-bold py-3.5 rounded-xl transition-all bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]`}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
                            className="flex-1 app-btn-accent font-bold py-3.5 rounded-xl transition-all disabled:opacity-50"
            >
              {isSubmitting ? t('saving') : t('add_section')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
