import { useEffect, useMemo, useState, type MouseEvent, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Activity, BriefcaseBusiness, ChartNoAxesColumnIncreasing, ChevronDown, FileText, FolderOpen, Grid2X2, PieChart, Users, type LucideIcon } from 'lucide-react';
import { serviceStatusLabel, type Service } from '../types/models';
import WisalWMark from './WisalWMark';

export type AdminOverviewTab = 'overview' | 'pending' | 'rejected' | 'slider' | 'services' | 'browse' | 'messages' | 'notifications' | 'jobs';
interface Props { services: Service[]; categories: any[]; visits: number }
const number = (value: number) => new Intl.NumberFormat('en-US').format(value);
const dateLabel = (date: Date) => new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'short', numberingSystem: 'latn' }).format(date);
const accents = ['#2bc2ec', '#288bff', '#ffaa56', '#9e46ff', '#7889c3'];
function Count({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (reduced) { setDisplay(value); return; }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => { const p = Math.min(1, (now - started) / 700); setDisplay(Math.round(value * (1 - (1 - p) ** 3))); if (p < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <strong dir="ltr">{number(display)}</strong>;
}
function coordinates(values: number[], width: number, height: number, padding: number, ceiling?: number) {
  const max = ceiling || Math.max(1, ...values);
  return values.map((value, i) => ({ x: padding + i / Math.max(1, values.length - 1) * (width - padding * 2), y: height - padding - value / max * (height - padding * 2) }));
}
function curve(points: { x: number; y: number }[]) {
  return points.map((p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const previous = points[i - 1], middle = (previous.x + p.x) / 2;
    return `C${middle},${previous.y} ${middle},${p.y} ${p.x},${p.y}`;
  }).join(' ');
}
function Stat({ label, value, color, icon: Icon, history, caption, index }: { label: string; value: number; color: string; icon: LucideIcon; history?: number[]; caption: string; index: number }) {
  const reduced = useReducedMotion();
  return <motion.article className="wisal-stat-card" style={{ '--stat-accent': color } as CSSProperties} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06, duration: .3 }}>
    <div className="wisal-stat-card__icon"><Icon size={30} strokeWidth={1.7}/></div>
    <div className="wisal-stat-card__content"><span>{label}</span><Count value={value}/><small>{caption}</small></div>
    {history && <svg className="wisal-stat-card__sparkline" viewBox="0 0 140 44" role="img" aria-label={caption}><title>{caption}</title><path d={curve(coordinates(history, 140, 44, 5))}/></svg>}
  </motion.article>;
}
function Distribution({ services, categories }: { services: Service[]; categories: any[] }) {
  const [selected, setSelected] = useState('all');
  const rows = useMemo(() => {
    const list = categories.map(c => ({ slug: String(c.slug), name: c.name as string, count: services.filter(s => s.categorySlug === c.slug).length })).filter(c => c.count > 0).sort((a, b) => b.count - a.count);
    const uncategorized = services.filter(s => !categories.some(c => c.slug === s.categorySlug)).length;
    const visible = list.slice(0, 4);
    const other = list.slice(4).reduce((sum, c) => sum + c.count, 0) + uncategorized;
    if (other) visible.push({ slug: '__other', name: 'خدمات أخرى', count: other });
    return visible;
  }, [services, categories]);
  const shown = selected === 'all' ? rows : rows.filter(row => row.slug === selected);
  const total = shown.reduce((sum, row) => sum + row.count, 0);
  let offset = 0;
  const slices = shown.map((row, i) => { const start = offset; offset += total ? row.count / total * 100 : 0; return `${accents[i]} ${start}% ${offset}%`; });
  return <article className="wisal-panel wisal-panel--donut">
    <div className="wisal-panel__heading"><PieChart size={23}/><h2>توزيع الخدمات</h2><label className="wisal-chart-select"><select aria-label="تصفية توزيع الخدمات" value={selected} onChange={e => setSelected(e.target.value)}><option value="all">جميع الخدمات</option>{rows.map(row => <option key={row.slug} value={row.slug}>{row.name}</option>)}</select><ChevronDown size={14}/></label></div>
    <div className="wisal-donut-layout"><div className="wisal-donut" style={{ background: total ? `conic-gradient(${slices.join(',')})` : '#243149' }} role="img" aria-label={`توزيع ${number(total)} خدمة`}><div className="wisal-donut__hole"><strong dir="ltr">{number(total)}</strong><span>خدمة</span></div></div><div className="wisal-legend">{shown.map((row, i) => <div className="wisal-legend__row" key={row.slug}><i style={{ background: accents[i] }}/><span title={row.name}>{row.name}</span><strong dir="ltr">{number(row.count)}</strong></div>)}{!total && <p className="wisal-empty-state">لا توجد خدمات مسجلة</p>}</div></div>
  </article>;
}
function ActivityChart({ services }: { services: Service[] }) {
  const [days, setDays] = useState(30);
  const reduced = useReducedMotion();
  const data = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Array.from({ length: days }, (_, index) => { const date = new Date(today); date.setDate(date.getDate() - days + 1 + index); const next = new Date(date); next.setDate(next.getDate() + 1); return { date, count: services.filter(s => s.createdAt >= date.getTime() && s.createdAt < next.getTime()).length }; });
  }, [services, days]);
  const ceiling = Math.max(4, Math.ceil(Math.max(0, ...data.map(d => d.count)) / 4) * 4);
  const positions = coordinates(data.map(d => d.count), 800, 200, 5, ceiling);
  const line = curve(positions), area = `${line} L795,195 L5,195 Z`;
  return <article className="wisal-panel wisal-panel--pulse">
    <div className="wisal-panel__heading"><ChartNoAxesColumnIncreasing size={23}/><h2>معدل النشاط خلال {days} يوم</h2><label className="wisal-chart-select"><select aria-label="فترة النشاط" value={days} onChange={e => setDays(Number(e.target.value))}><option value={30}>آخر 30 يوم</option><option value={7}>آخر 7 أيام</option></select><ChevronDown size={14}/></label></div>
    <div className="wisal-activity-chart"><div className="wisal-chart-y">{Array.from({ length: 5 }, (_, i) => <span key={i}>{number(ceiling - ceiling / 4 * i)}</span>)}</div><div className="wisal-chart-plot"><svg viewBox="0 0 800 200" preserveAspectRatio="none" role="img" aria-label={`عدد الخدمات المسجلة خلال آخر ${days} يوماً`}><defs><linearGradient id="wisal-line-spectrum"><stop stopColor="#00bfff"/><stop offset="55%" stopColor="#278cff"/><stop offset="100%" stopColor="#aa3fff"/></linearGradient><linearGradient id="wisal-fill-spectrum" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#008be6" stopOpacity=".38"/><stop offset="60%" stopColor="#285ad3" stopOpacity=".32"/><stop offset="100%" stopColor="#9519de" stopOpacity=".38"/></linearGradient></defs>{Array.from({ length: 5 }, (_, i) => <line key={`h${i}`} x1="5" x2="795" y1={5 + i * 47.5} y2={5 + i * 47.5} className="wisal-chart-gridline"/>)}{Array.from({ length: 15 }, (_, i) => <line key={`v${i}`} x1={5 + i / 14 * 790} x2={5 + i / 14 * 790} y1="5" y2="195" className="wisal-chart-gridline wisal-chart-gridline--vertical"/>)}<path d={area} fill="url(#wisal-fill-spectrum)"/><motion.path key={days} d={line} className="wisal-activity-line" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .8 }}/>{positions.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.2" fill="#c8f7ff"><title>{dateLabel(data[i].date)}: {number(data[i].count)} خدمة</title></circle>)}</svg><div className="wisal-chart-x">{data.filter((_, i) => i % Math.ceil((days - 1) / 5) === 0 || i === days - 1).map(d => <span key={d.date.getTime()}>{dateLabel(d.date)}</span>)}</div></div></div>
  </article>;
}
export default function AdminOverviewDashboard({ services, categories, visits }: Props) {
  const reduced = useReducedMotion();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const move = (event: MouseEvent<HTMLDivElement>) => { if (reduced) return; const bounds = event.currentTarget.getBoundingClientRect(); setTilt({ x: ((event.clientY - bounds.top) / bounds.height - .5) * -6, y: ((event.clientX - bounds.left) / bounds.width - .5) * 8 }); };
  const pending = services.filter(s => s.status === 'pending');
  const latest = useMemo(() => [...services].sort((a,b) => b.createdAt - a.createdAt).slice(0,3), [services]);
  const categoryRows = useMemo(() => categories.map(c => ({ ...c, count: services.filter(s => s.categorySlug === c.slug).length })).filter(c => c.count > 0).sort((a,b) => b.count-a.count).slice(0,3), [services,categories]);
  const weekly = useMemo(() => Array.from({ length: 7 }, (_, i) => { const day = new Date(); day.setHours(0,0,0,0); day.setDate(day.getDate()-6+i); const next = new Date(day); next.setDate(next.getDate()+1); return services.filter(s => s.createdAt>=day.getTime() && s.createdAt<next.getTime()).length; }), [services]);
  const pendingWeekly = useMemo(() => Array.from({ length: 7 }, (_, i) => { const day = new Date(); day.setHours(0,0,0,0); day.setDate(day.getDate()-6+i); const next = new Date(day); next.setDate(next.getDate()+1); return services.filter(s => s.status==='pending' && s.createdAt>=day.getTime() && s.createdAt<next.getTime()).length; }), [services]);
  const categoryWeekly = useMemo(() => Array.from({ length: 7 }, (_, i) => { const day = new Date(); day.setHours(0,0,0,0); day.setDate(day.getDate()-6+i); const next = new Date(day); next.setDate(next.getDate()+1); return new Set(services.filter(s => s.createdAt>=day.getTime() && s.createdAt<next.getTime()).map(s => s.categorySlug)).size; }), [services]);
  return <div className="wisal-overview__content">
    <section className="wisal-admin-hero">
      <motion.div className="wisal-admin-hero__logo-stage" onMouseMove={move} onMouseLeave={() => setTilt({ x:0, y:0 })} style={{ rotateX:tilt.x, rotateY:tilt.y }}><WisalWMark size="hero"/></motion.div>
      <div className="wisal-admin-hero__copy"><span className="wisal-admin-hero__eyebrow">مرحباً بك في لوحة إدارة</span><h1 dir="ltr">WISAL</h1><p>كل شيء تحت السيطرة ... لإدارة أفضل وخدمات أوسع</p><i aria-hidden="true"/></div>
    </section>
    <section className="wisal-stats-grid" aria-label="الإحصائيات الرئيسية">
      <Stat label="إجمالي الزيارات" value={visits} color="#2677ff" icon={Users} caption="نشاط الخدمات · 7 أيام" history={weekly} index={0}/>
      <Stat label="إجمالي الخدمات" value={services.length} color="#00d2b3" icon={BriefcaseBusiness} caption="الخدمات المسجلة" history={weekly} index={1}/>
      <Stat label="قيد المراجعة" value={pending.length} color="#a53eff" icon={FileText} caption="خدمات بانتظار المراجعة" history={pendingWeekly} index={2}/>
      <Stat label="إجمالي الأقسام" value={categories.length} color="#ff980b" icon={Grid2X2} caption="أقسام الخدمات الجديدة · 7 أيام" history={categoryWeekly} index={3}/>
    </section>
    <section className="wisal-chart-grid"><ActivityChart services={services}/><Distribution services={services} categories={categories}/></section>
    <section className="wisal-admin-bottom-grid">
      <article className="wisal-panel wisal-table-panel"><div className="wisal-panel__heading"><FileText size={23}/><h2>أحدث الخدمات</h2></div><div className="wisal-admin-table-wrap"><table className="wisal-admin-table"><thead><tr><th>الخدمة</th><th>القسم</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>{latest.map(s => <tr key={s.id || s.slug}><td title={s.name}>{s.name}</td><td>{categories.find(c=>c.slug===s.categorySlug)?.name || s.categorySlug}</td><td><span className={`wisal-status-pill wisal-status-pill--${s.status||'approved'}`}>{serviceStatusLabel(s.status)}</span></td><td><time dateTime={new Date(s.createdAt).toISOString()}>{new Intl.DateTimeFormat('en-GB').format(new Date(s.createdAt))}</time></td></tr>)}</tbody></table>{!latest.length && <p className="wisal-empty-state">لا توجد خدمات مسجلة حالياً</p>}</div></article>
      <article className="wisal-panel wisal-table-panel"><div className="wisal-panel__heading"><FolderOpen size={23}/><h2>الأقسام الأكثر خدمات</h2></div><div className="wisal-admin-table-wrap"><table className="wisal-admin-table"><thead><tr><th>القسم</th><th>الخدمات</th><th>النسبة</th></tr></thead><tbody>{categoryRows.map((c,i) => <tr key={c.slug}><td><span className="wisal-category-name"><i style={{background:accents[i]}}/>{c.name}</span></td><td dir="ltr">{number(c.count)}</td><td dir="ltr">{services.length ? Math.round(c.count/services.length*100) : 0}%</td></tr>)}</tbody></table>{!categoryRows.length && <p className="wisal-empty-state">لا توجد بيانات أقسام حالياً</p>}</div></article>
    </section>
  </div>;
}
