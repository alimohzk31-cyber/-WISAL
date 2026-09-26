import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleHelp,
  ChevronLeft,
  FolderOpen,
  Grid2X2,
  LayoutGrid,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { Service } from '../types/models';

export type AdminOverviewTab = 'overview' | 'pending' | 'rejected' | 'slider' | 'services' | 'browse' | 'messages' | 'notifications' | 'jobs';

interface AdminOverviewDashboardProps {
  services: Service[];
  categories: any[];
  visits: number;
}

type PulsePoint = {
  label: string;
  date: Date;
  added: number;
  approved: number;
  rejected: number;
};

const COLORS = ['cyan', 'gold', 'green', 'blue', 'pink', 'violet'];

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function getIcon(category: any) {
  return category?.icon || FolderOpen;
}

function buildLinePath(points: number[], maxValue: number, width = 720, height = 220) {
  const padX = 18;
  const padY = 16;
  const usableWidth = width - padX * 2;
  const usableHeight = height - padY * 2;
  const denominator = Math.max(maxValue, 1);
  return points.map((value, index) => {
    const x = padX + (usableWidth / Math.max(points.length - 1, 1)) * index;
    const y = height - padY - (value / denominator) * usableHeight;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function getPointPosition(index: number, value: number, maxValue: number, width = 720, height = 220) {
  const padX = 18;
  const padY = 16;
  const usableWidth = width - padX * 2;
  const usableHeight = height - padY * 2;
  return {
    x: padX + (usableWidth / 6) * index,
    y: height - padY - (value / Math.max(maxValue, 1)) * usableHeight,
  };
}

function OverviewStat({
  label,
  value,
  accent,
  icon: Icon,
  meta,
}: {
  label: string;
  value: string;
  accent: string;
  icon: typeof Activity;
  meta?: string;
}) {
  return (
    <article className={`wisal-stat-card wisal-stat-card--${accent}`}>
      <div className="wisal-stat-card__icon"><Icon size={23} strokeWidth={2.2} /></div>
      <div className="wisal-stat-card__content">
        <span>{label}</span>
        <strong dir="ltr">{value}</strong>
        {meta && <small>{meta}</small>}
      </div>
      <span className="wisal-stat-card__spark" aria-hidden="true" />
    </article>
  );
}

function DonutChart({ approved, pending, rejected }: { approved: number; pending: number; rejected: number }) {
  const total = approved + pending + rejected;
  const approvedPct = total ? (approved / total) * 100 : 0;
  const pendingPct = total ? (pending / total) * 100 : 0;
  const rejectedPct = total ? (rejected / total) * 100 : 0;
  const approvedEnd = approvedPct;
  const pendingEnd = approvedPct + pendingPct;
  const gradient = total
    ? `conic-gradient(var(--neon-cyan) 0 ${approvedEnd}%, var(--neon-gold) ${approvedEnd}% ${pendingEnd}%, var(--neon-pink) ${pendingEnd}% 100%)`
    : 'conic-gradient(rgba(255,255,255,.12) 0 100%)';

  const rows = [
    { label: 'مقبولة', value: approved, pct: approvedPct, color: 'cyan' },
    { label: 'قيد المراجعة', value: pending, pct: pendingPct, color: 'gold' },
    { label: 'مرفوضة', value: rejected, pct: rejectedPct, color: 'pink' },
  ];

  return (
    <div className="wisal-donut-layout">
      <div className="wisal-donut" style={{ background: gradient }} aria-label={`إجمالي الخدمات ${formatNumber(total)}`}>
        <div className="wisal-donut__hole">
          <strong dir="ltr">{formatNumber(total)}</strong>
          <span>إجمالي الخدمات</span>
        </div>
      </div>
      <div className="wisal-legend">
        {rows.map(row => (
          <div className="wisal-legend__row" key={row.label}>
            <div className="wisal-legend__label"><i className={`wisal-dot wisal-dot--${row.color}`} />{row.label}</div>
            <strong dir="ltr">{formatNumber(row.value)}</strong>
            <span dir="ltr">{Math.round(row.pct)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PulseChart({ services }: { services: Service[] }) {
  const [activePoint, setActivePoint] = useState(6);
  const points = useMemo<PulsePoint[]>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      const dayServices = services.filter(service => {
        const created = new Date(service.createdAt);
        return created.getFullYear() === date.getFullYear()
          && created.getMonth() === date.getMonth()
          && created.getDate() === date.getDate();
      });
      return {
        date,
        label: new Intl.DateTimeFormat('ar-IQ', { weekday: 'short' }).format(date),
        added: dayServices.length,
        approved: dayServices.filter(service => service.status === 'approved').length,
        rejected: dayServices.filter(service => service.status === 'rejected').length,
      };
    });
  }, [services]);

  const maxValue = Math.max(1, ...points.flatMap(point => [point.added, point.approved, point.rejected]));
  const series = [
    { key: 'added' as const, label: 'المضافة', color: 'cyan', values: points.map(point => point.added) },
    { key: 'approved' as const, label: 'المقبولة', color: 'gold', values: points.map(point => point.approved) },
    { key: 'rejected' as const, label: 'المرفوضة', color: 'pink', values: points.map(point => point.rejected) },
  ];
  const selected = points[activePoint];

  return (
    <div className="wisal-pulse-chart">
      <div className="wisal-pulse-chart__legend">
        {series.map(item => <span key={item.key}><i className={`wisal-dot wisal-dot--${item.color}`} />{item.label}</span>)}
      </div>
      <div className="wisal-pulse-chart__canvas">
        <svg viewBox="0 0 720 220" role="img" aria-label="نبض الخدمات خلال آخر سبعة أيام" preserveAspectRatio="none">
          {[0, 1, 2, 3, 4].map(line => {
            const y = 16 + ((220 - 32) / 4) * line;
            const labelValue = Math.round(maxValue - (maxValue / 4) * line);
            return <g key={line}><line x1="18" x2="702" y1={y} y2={y} className="wisal-chart-grid" /><text x="2" y={y + 4} className="wisal-chart-axis">{labelValue}</text></g>;
          })}
          {series.map(item => (
            <g key={item.key} className={`wisal-line wisal-line--${item.color}`}>
              <path d={buildLinePath(item.values, maxValue)} />
              {item.values.map((value, index) => {
                const position = getPointPosition(index, value, maxValue);
                return <circle key={`${item.key}-${index}`} cx={position.x} cy={position.y} r="4.8" onClick={() => setActivePoint(index)}><title>{`${points[index].label}: ${formatNumber(value)}`}</title></circle>;
              })}
            </g>
          ))}
          {points.map((point, index) => {
            const position = getPointPosition(index, 0, maxValue);
            return <text key={point.date.toISOString()} x={position.x} y="214" textAnchor="middle" className="wisal-chart-label">{point.label}</text>;
          })}
        </svg>
        {selected && (
          <button className="wisal-chart-tooltip" onClick={() => setActivePoint((activePoint + 1) % points.length)} type="button">
            <strong>{selected.label}</strong>
            <span>المضافة {formatNumber(selected.added)} · المقبولة {formatNumber(selected.approved)} · المرفوضة {formatNumber(selected.rejected)}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminOverviewDashboard({
  services,
  categories,
  visits,
}: AdminOverviewDashboardProps) {
  const approved = services.filter(service => service.status === 'approved').length;
  const pending = services.filter(service => service.status === 'pending').length;
  const rejected = services.filter(service => service.status === 'rejected').length;
  const categoryStats = useMemo(() => categories.map(category => ({
    ...category,
    count: services.filter(service => service.categorySlug === category.slug).length,
  })).sort((a, b) => b.count - a.count), [categories, services]);
  const topCategories = categoryStats.filter(category => category.count > 0).slice(0, 6);
  const maxCategoryCount = Math.max(1, ...topCategories.map(category => category.count));

  return (
    <div className="wisal-overview__content wisal-overview__content--embedded">
          <div className="wisal-overview__heading">
            <div><p>لوحة المتابعة وإحصائيات منصة وصال</p><h1>نظرة عامة</h1></div>
            <button className="wisal-date-filter" type="button"><Activity size={17} />هذا الأسبوع<ChevronLeft size={15} /></button>
          </div>

          <section className="wisal-stats-grid" aria-label="الإحصائيات الرئيسية">
            <OverviewStat label="إجمالي الخدمات" value={formatNumber(services.length)} accent="cyan" icon={LayoutGrid} meta="الخدمات المسجلة" />
            <OverviewStat label="الأقسام" value={formatNumber(categories.length)} accent="gold" icon={Grid2X2} meta="الأقسام النشطة" />
            <OverviewStat label="الزيارات" value={formatNumber(visits)} accent="green" icon={TrendingUp} meta="إجمالي الزيارات" />
            <OverviewStat label="قيد المراجعة" value={formatNumber(pending)} accent="pink" icon={CircleHelp} meta="طلبات تحتاج مراجعة" />
          </section>

          <section className="wisal-chart-grid">
            <article className="wisal-panel wisal-panel--donut">
              <div className="wisal-panel__heading"><div><h2>حالة الخدمات</h2><p>نسبة القبول والمراجعة والرفض</p></div><CheckCircle2 size={21} /></div>
              <DonutChart approved={approved} pending={pending} rejected={rejected} />
            </article>
            <article className="wisal-panel wisal-panel--pulse">
              <div className="wisal-panel__heading"><div><h2>نبض الخدمات</h2><p>الحركة خلال آخر 7 أيام</p></div><Activity size={21} /></div>
              <PulseChart services={services} />
            </article>
          </section>

          <section className="wisal-panel wisal-panel--categories">
            <div className="wisal-panel__heading"><div><h2>الأقسام الأكثر نشاطاً</h2><p>حسب عدد الخدمات المسجلة</p></div><TrendingUp size={21} /></div>
            {topCategories.length > 0 ? (
              <div className="wisal-category-grid">
                {topCategories.map((category, index) => {
                  const Icon = getIcon(category);
                  const percentage = Math.round((category.count / maxCategoryCount) * 100);
                  return (
                    <div className="wisal-category-row" key={category.slug || index}>
                      <div className="wisal-category-title"><span className={`wisal-category-icon wisal-category-icon--${COLORS[index]}`}><Icon size={18} /></span><strong>{category.name}</strong></div>
                      <strong className={`wisal-category-count wisal-text--${COLORS[index]}`} dir="ltr">{formatNumber(category.count)}</strong>
                      <div className="wisal-progress"><span className={`wisal-progress__fill wisal-progress__fill--${COLORS[index]}`} style={{ width: `${percentage}%` }} /></div>
                      <span className="wisal-category-percentage" dir="ltr">{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="wisal-empty-state">لا توجد خدمات مسجلة في الأقسام بعد</div>
            )}
          </section>

          <div className="wisal-overview__footnote"><Users size={16} /> البيانات المعروضة مأخوذة من السجلات الحالية في قاعدة البيانات</div>
    </div>
  );
}
