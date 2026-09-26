const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'src', 'pages', 'CategoryPage.tsx');
const raw = fs.readFileSync(p, 'utf8');

const idx1 = raw.indexOf('      {/* Header */}');
const idx2 = raw.indexOf('      {/* Services List', idx1);
if (idx1 === -1 || idx2 === -1) { console.error('Markers not found'); process.exit(1); }
let endPos = idx2;
while (endPos > idx1 && raw[endPos] !== '<') endPos--;
if (raw.substring(endPos, endPos + 6) !== '</div>') { console.error('No </div> found'); process.exit(1); }

const L = [
  '      {/* Hero Card — بطاقة القسم الرئيسية قبل البحث والفلاتر */}',
  '      <CategoryPageHero',
  '        title={titleJSX}',
  '        subTitle={category.subTitle}',
  '        locationLabel={category.fields?.locationLabel}',
  '        onBack={goBack}',
  '        onAdd={() => setIsAddingService(true)}',
  '        icon={Icon}',
  '        colorClass={iconColors.text}',
  "        count={categoryServices.filter(s => s.status === 'approved').length}",
  '      />',
  '',
  '      {/* قائمة الأقسام الفرعية — بين بطاقة القسم وشريط البحث */}',
  '      {category.children.length > 0 && (',
  '        <div className="relative w-full min-w-0" ref={subcategoryMenuRef}>',
  '          <button',
  '            type="button"',
  '            onClick={() => setIsSubcategoryMenuOpen(open => !open)}',
  '            aria-expanded={isSubcategoryMenuOpen}',
  '            aria-controls="subcategory-menu"',
  '            aria-label="عرض الأقسام الفرعية"',
  '            className="flex w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--accent-soft)]"',
  '          >',
  '            <Menu className="h-5 w-5 text-[var(--accent-primary)]" aria-hidden="true" />',
  "            <span className=\"max-w-32 truncate\">{activeChild?.name ?? 'كل الأقسام'}</span>",
  '          </button>',
  '',
  '          <AnimatePresence>',
  '            {isSubcategoryMenuOpen && (',
  '              <motion.div',
  '                id="subcategory-menu"',
  '                role="menu"',
  '                initial={{ opacity: 0, y: -6, scale: 0.98 }}',
  '                animate={{ opacity: 1, y: 0, scale: 1 }}',
  '                exit={{ opacity: 0, y: -6, scale: 0.98 }}',
  '                transition={{ duration: 0.16 }}',
  '                className="absolute inset-x-0 top-full z-30 mt-2 max-h-[60dvh] w-full min-w-0 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2 shadow-[var(--shadow-lg)] sm:left-auto sm:right-0 sm:w-64 sm:max-w-[calc(100vw-2rem)]"',
  '              >',
  '                <button',
  '                  type="button"',
  '                  role="menuitemradio"',
  "                  aria-checked={activeSubCategory === 'all'}",
  "                  onClick={() => chooseSubCategory('all')}",
  '                  className={itemClassAll}',
  '                >',
  '                  <span className="min-w-0 break-words">كل الأقسام</span>',
  "                  {activeSubCategory === 'all' && <span className=\"h-2 w-2 shrink-0 rounded-full bg-current\" aria-hidden=\"true\" />}",
  '                </button>',
  '                {subCategories.map(sub => {',
  '                  const isActive = activeSubCategory === sub.slug;',
  '                  return (',
  '                    <button',
  '                      key={sub.slug}',
  '                      type="button"',
  '                      role="menuitemradio"',
  '                      aria-checked={isActive}',
  '                      onClick={() => chooseSubCategory(sub.slug)}',
  '                      className={itemClassSub}',
  '                    >',
  '                      <span className="min-w-0 break-words">{sub.name}</span>',
  '                      {isActive && <span className="h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden="true" />}',
  '                    </button>',
  '                  );',
  '                })}',
  '              </motion.div>',
  '            )}',
  '          </AnimatePresence>',
  '        </div>',
  '      )}',
];

const newRaw =
  raw.substring(0, idx1) +
  L.map(line =>
    line
      .replace('titleJSX', '`${category.name}${activeChild ? ` / ${activeChild.name}` : ``}`')
      .replace('itemClassAll', '`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-right text-sm font-bold transition-colors ${activeSubCategory === \'all\' ? \'bg-[var(--accent-soft)] text-[var(--text-primary)]\' : \'text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]\'`}')
      .replace('itemClassSub', '`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-right text-sm font-bold transition-colors ${isActive ? `${colors.bg} text-[var(--accent-contrast)]` : \'text-[var(--text-primary)] hover:bg-[var(--accent-soft)]\'}`}')
  ).join('\n') +
  '\n' +
  raw.substring(endPos);

fs.writeFileSync(p, newRaw, 'utf8');
console.log('Done');
