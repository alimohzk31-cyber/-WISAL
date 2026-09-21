import { Search } from 'lucide-react';

interface CategoryToolbarProps {
  searchTerm: string;
  onSearchTerm: (value: string) => void;
  placeholder: string;
}

/** Search-only toolbar. It filters the real services already loaded for this section. */
export default function CategoryToolbar({ searchTerm, onSearchTerm, placeholder }: CategoryToolbarProps) {
  return (
    <div dir="rtl" className="flex w-full justify-start">
      <label className="relative block h-[66px] w-full sm:w-[min(42vw,480px)]">
        <Search className="absolute right-5 top-1/2 h-7 w-7 -translate-y-1/2 text-[#263e60]" strokeWidth={2.4} aria-hidden="true" />
        <input
          type="search"
          value={searchTerm}
          onChange={event => onSearchTerm(event.target.value)}
          placeholder={placeholder}
          className="h-full w-full rounded-[24px] border-2 border-[#dce7f2] bg-white px-5 pr-[62px] text-right text-base font-medium text-[#263e60] shadow-[0_7px_20px_rgba(47,85,126,0.08)] outline-none placeholder:text-[#8192a9] focus:border-[#b6d6f5] focus:ring-2 focus:ring-[#2582ed]/10 sm:text-lg"
        />
      </label>
    </div>
  );
}
