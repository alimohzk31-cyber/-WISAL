import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Layers, Plus } from 'lucide-react';
import type { DirectoryChild } from '../data/categoryDirectory';
import type { CategoryVisual } from '../data/categoryVisuals';
import CategoryPhoto from './CategoryPhoto';

export function serviceCountLabel(count: number): string {
  if (count === 1) return 'خدمة واحدة متاحة';
  if (count === 2) return 'خدمتان متاحتان';
  return `${count} ${count >= 3 && count <= 10 ? 'خدمات' : 'خدمة'} متاحة`;
}

interface CategoryPageHeroProps {
  sectionName: string;
  childName?: string;
  visual: CategoryVisual;
  count: number;
  children?: DirectoryChild[];
  activeChildSlug?: string;
  hideAll?: boolean;
  onChildSelect?: (slug?: string) => void;
  onBack: () => void;
  onAdd: () => void;
}

export default function CategoryPageHero({
  sectionName, childName, visual, count, children = [], activeChildSlug,
  hideAll = false, onChildSelect, onBack, onAdd,
}: CategoryPageHeroProps) {
  const [isChildMenuOpen, setIsChildMenuOpen] = useState(false);
  const childMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isChildMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!childMenuRef.current?.contains(event.target as Node)) setIsChildMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isChildMenuOpen]);

  const chooseChild = (slug?: string) => {
    onChildSelect?.(slug);
    setIsChildMenuOpen(false);
  };

  return (
    <section dir="rtl" className="relative isolate h-[470px] min-w-0 overflow-hidden rounded-[30px] border border-[#d7e6f5] bg-[#f7fbff] shadow-[0_12px_32px_rgba(45,87,130,0.09)] md:h-[300px] md:rounded-[38px]">
      <div className="absolute inset-x-0 top-0 h-[238px] overflow-hidden md:inset-y-0 md:left-0 md:right-auto md:h-full md:w-[55%]">
        <CategoryPhoto
          key={visual.photoUrl}
          visual={visual}
          alt={childName ? `${sectionName} - ${childName}` : sectionName}
          eager
          className="h-full w-full object-cover"
          objectPosition="center 34%"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#f7fbff] via-[#f7fbff]/10 to-transparent md:bg-gradient-to-r md:from-transparent md:via-[#f7fbff]/10 md:to-[#f7fbff]" />
      </div>

      <svg aria-hidden="true" viewBox="0 0 1000 300" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 hidden h-full w-full md:block">
        <path d="M536 0c22 94 48 195 93 300h371V0z" fill="#f7fbff" fillOpacity=".86" />
        <path d="M533 0c23 98 48 200 96 300" fill="none" stroke="#2582ed" strokeWidth="15" />
      </svg>

      <button
        type="button"
        onClick={onBack}
        aria-label={childName ? `الرجوع إلى ${sectionName}` : 'الرجوع'}
        className="absolute right-3 top-3 z-30 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#dceaf7] bg-white/95 text-[#172b4d] shadow-sm transition hover:bg-white md:right-4 md:top-7 md:h-[86px] md:w-[86px]"
      >
        <ArrowRight className="h-8 w-8 md:h-10 md:w-10" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onAdd}
        aria-label="إضافة خدمة"
        className="absolute left-4 top-3 z-30 flex h-[70px] w-[70px] items-center justify-center rounded-full bg-[#0878ed] text-white shadow-[0_12px_24px_rgba(8,120,237,0.22)] transition hover:scale-[1.02] active:scale-95 md:left-8 md:top-3 md:h-[102px] md:w-[102px]"
      >
        <Plus className="h-10 w-10 md:h-14 md:w-14" strokeWidth={3.5} aria-hidden="true" />
      </button>
      <span className="absolute left-3 top-[82px] z-30 rounded-2xl border border-[#e7edf4] bg-white/95 px-3 py-1.5 text-sm font-black text-[#172b4d] shadow-[0_5px_15px_rgba(37,61,91,0.12)] md:left-4 md:top-[121px] md:px-4 md:py-2 md:text-lg">إضافة خدمة</span>

      <div className="absolute left-4 right-4 top-[250px] z-20 min-w-0 text-right md:left-auto md:right-[11%] md:top-[62px] md:w-[41%]">
        <div className="relative inline-block max-w-full" ref={childMenuRef}>
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsChildMenuOpen(open => !open)}
              aria-expanded={isChildMenuOpen}
              aria-haspopup="menu"
              aria-label={childName ? `التخصص الحالي: ${childName}. تغيير التخصص` : `تخصصات قسم ${sectionName}`}
              className="flex max-w-full items-center gap-1 text-right"
            >
              <h1 className="break-words text-[clamp(1.45rem,3.1vw,2.55rem)] font-black leading-tight text-[#172b4d]">
                {sectionName}
                {childName && <><span className="mx-2 text-[#637894]">/</span><span className="text-[#0878ed]">{childName}</span></>}
              </h1>
              <ChevronDown className="h-5 w-5 shrink-0 text-[#637894]" aria-hidden="true" />
            </button>
          ) : (
            <h1 className="break-words text-[clamp(1.45rem,3.1vw,2.55rem)] font-black leading-tight text-[#172b4d]">
              {sectionName}
              {childName && <><span className="mx-2 text-[#637894]">/</span><span className="text-[#0878ed]">{childName}</span></>}
            </h1>
          )}
          {isChildMenuOpen && children.length > 0 && (
            <div role="menu" className="absolute right-0 top-full z-50 mt-2 max-h-[55dvh] w-max min-w-[220px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-[#dce7f2] bg-white p-2 text-[#263e60] shadow-[0_18px_40px_rgba(37,61,91,0.18)]">
              {!hideAll && (
                <button type="button" role="menuitem" disabled={!activeChildSlug} onClick={() => chooseChild(undefined)} className={`block w-full rounded-xl px-4 py-3 text-right text-sm font-bold ${activeChildSlug ? 'hover:bg-[#eff7ff]' : 'text-[#0878ed]'}`}>
                  كل التخصصات
                </button>
              )}
              {children.map(child => (
                <button key={child.slug} type="button" role="menuitem" onClick={() => chooseChild(child.slug)} className={`block w-full rounded-xl px-4 py-3 text-right text-sm font-bold hover:bg-[#eff7ff] ${activeChildSlug === child.slug ? 'text-[#0878ed]' : ''}`}>
                  {child.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mt-2 text-[clamp(1rem,1.8vw,1.45rem)] font-bold text-[#7487a0] md:mt-4">
          قسم {childName ?? sectionName} يرحب بكم
        </p>
        <span aria-hidden="true" className="mt-4 block h-[5px] w-[54px] rounded-full bg-[#0878ed] md:mt-7" />
      </div>

      <div className="absolute bottom-3 left-3 z-20 flex h-[56px] max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-full border border-white bg-white/95 px-4 text-[#2860a0] shadow-[0_8px_22px_rgba(52,101,157,0.14)] md:bottom-6 md:left-4 md:h-[72px] md:min-w-[256px] md:gap-4 md:px-6">
        <Layers className="h-6 w-6 shrink-0 fill-[#2860a0] text-[#2860a0] md:h-8 md:w-8" aria-hidden="true" />
        <bdi className="text-base font-black md:text-2xl">{serviceCountLabel(count)}</bdi>
      </div>
    </section>
  );
}
