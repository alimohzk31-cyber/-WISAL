import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, LayoutGrid, Activity, Eye, Plus, Edit, Trash2, ChevronLeft, MapPin, Phone, Shield, TrendingUp, FolderOpen, Bell, Check, X, ArrowRightLeft, Image as ImageIcon, XCircle, Hourglass, Lightbulb, Equal, Compass, BriefcaseBusiness, CheckCheck, AlertTriangle, Ban, Download } from 'lucide-react';
import { useServices } from '../context/ServicesContext';
import { isValidServiceId, Service } from '../hooks/useServices';
import { serviceStatusLabel, serviceStatusBadgeClass } from '../types/models';
import { adminApproveService, adminRejectService } from '../services/adminServiceActions';
import { useAdminServiceLists } from '../hooks/useAdminServiceLists';
import { useCategories } from '../hooks/useCategories';
import { colorMap } from '../data/categories';
import { resolveCategoryIcon, getIconColorStyles, FALLBACK_SERVICE_ICON } from '../data/serviceIcons';
import { useStats } from '../hooks/useStats';
import { useAdminDashboardCounts } from '../hooks/useAdminDashboardCounts';
import EditServiceModal from '../components/EditServiceModal';
import AddServiceModal from '../components/AddServiceModal';
import AddCategoryModal from '../components/AddCategoryModal';
import SliderManager from '../components/SliderManager';
import JobsAdminPanel from '../features/jobs/admin/JobsAdminPanel';
import MessagesManager from '../components/MessagesManager';
import NotificationsManager from '../components/NotificationsManager';

import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

// شارة نوع الخدمة الموحّدة (لوحة الإدارة): تستخدم النظام المركزي serviceIcons
// بحيث تظهر كل فئة بأيقونتها ولونها في كل مكان تعرض فيه الخدمة.
function ServiceCategoryChip({ category, label }: { category: any; label: string }) {
  const resolved = resolveCategoryIcon(category);
  const styles = getIconColorStyles(category?.color ?? resolved.color);
  const Icon = resolved.icon || FALLBACK_SERVICE_ICON;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg font-bold bg-[var(--surface-elevated)] text-[var(--text-secondary)]`}>
      <Icon className={`w-3.5 h-3.5 shrink-0 ${styles.text}`} />
      {label}
    </span>
  );
}

function AdminCountBadge({ count }: { count: number | null | undefined }) {
  if (count === null || count === undefined || count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black leading-none text-white">
      {label}
    </span>
  );
}

export default function AdminDashboard() {
  const { services, publicServices, deleteService, editService, applyServiceUpdate, fetchAllPendingServices, fetchAllRejectedServices, refreshServices } = useServices();
  const {
    pending: allPendingServices, rejected: allRejectedServices,
    reload: reloadAdminLists,
  } = useAdminServiceLists(fetchAllPendingServices, fetchAllRejectedServices, refreshServices);
  const { categories, addCategory, deleteCategory, editCategory } = useCategories();
  const [adminCategories, setAdminCategories] = useState<any[]>(categories);
  const { stats } = useStats();
  const { pendingJobs, messages, notifications } = useAdminDashboardCounts();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'rejected' | 'slider' | 'services' | 'browse' | 'messages' | 'notifications' | 'jobs'>('overview');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Toggle إظهار/إخفاء أيقونات القائمة (UI فقط — لا يمس أي وظيفة)
  const [showIcons, setShowIcons] = useState<boolean>(() => localStorage.getItem('admin_show_icons') !== '0');
  useEffect(() => {
    localStorage.setItem('admin_show_icons', showIcons ? '1' : '0');
  }, [showIcons]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedServiceSlug, setExpandedServiceSlug] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<any>(null);
  const [isAddingService, setIsAddingService] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [movingServiceId, setMovingServiceId] = useState<string | null>(null);
  // Track which service is currently being processed (approve/reject) so the
  // buttons show a spinner, are disabled (no double-click), and the action
  // returns instantly instead of waiting for a full page reload.
  const [processingId, setProcessingId] = useState<string | null>(null);
  // تحديد خدمات «مكتبة الخدمات» لتنفيذ موافقة/حذف جماعي. التحديد يعتمد على
  // المعرّف الرقمي الحقيقي (id) فقط — لا اسم ولا slug.
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  useEffect(() => {
    setAdminCategories(prev => {
      const same = prev.length === categories.length && prev.every((item: any, index: number) => item.slug === categories[index]?.slug);
      return same ? prev : categories;
    });
  }, [categories]);

  // Admin Panel reads pending/rejected services from Supabase ONLY.
  // Local/offline data is never presented as real database rows here.
  const pendingServices = allPendingServices;
  const rejectedServices = allRejectedServices;
  const approvedServices = publicServices;
  // The service library combines the same real sources already used by this
  // dashboard: public approved services plus the existing pending/rejected
  // admin lists. Deduplication is by the database primary key.
  const allServices = Array.from(new Map(
    [...approvedServices, ...pendingServices, ...rejectedServices]
      .map(service => [String(service.id ?? service.slug), service])
  ).values()).sort((a, b) => b.createdAt - a.createdAt);

  const totalServices = approvedServices.length;
  const totalCategories = adminCategories.length;

  // Calculate real stats for categories
  const categoryStats = adminCategories.map((cat: any) => {
    const count = approvedServices.filter(s => s.categorySlug === cat.slug).length;
    return { ...cat, count };
  }).sort((a, b) => b.count - a.count); // Sort by most popular

  const activeCategory = selectedCategory ? adminCategories.find((c: any) => c.slug === selectedCategory) : null;
  const activeCategoryServices = selectedCategory ? approvedServices.filter(s => s.categorySlug === selectedCategory) : [];

  const servicesByCategory = adminCategories.map((category: any) => ({
    category,
    services: allServices.filter(service => service.categorySlug === category.slug),
  })).filter(group => group.services.length > 0);

  const browseServicesByCategory = adminCategories.map((category: any) => ({
    category,
    services: approvedServices.filter(service => service.categorySlug === category.slug),
  })).filter(group => group.services.length > 0);

  // Resolve the section name from the service's REAL category_id first,
  // then fall back to the slug match. Never shows "قسم غير معروف" while the
  // service has a valid category_id.
  const findCategoryForService = (service: Service): any =>
    adminCategories.find((c: any) =>
      (service.categoryId !== undefined && service.categoryId !== null &&
        c.dbId !== undefined && String(c.dbId) === String(service.categoryId)) ||
      c.slug === service.categorySlug
    );

  // Reuse recent lists; committed changes, Realtime and focus keep them fresh.
  const goToTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === 'pending' || tab === 'rejected'
        || tab === 'slider' || tab === 'services'
        || tab === 'browse') {
      reloadAdminLists(false);
    }
  };

  const handleApprove = async (id: string | number | undefined) => {
    // Diagnostic: print the exact id that will be used in the UPDATE statement
    console.log('[AdminDashboard] Approve requested with service.id =', id);

    // Strict validation: only the real numeric id from Supabase may be used - never a slug
    if (!isValidServiceId(id)) {
      const msg = `لا يمكن الموافقة: الخدمة لا تحتوي على معرّف (id) رقمي صالح من قاعدة البيانات (القيمة المستلمة: ${JSON.stringify(id)}).`;
      console.error('[AdminDashboard]', msg);
      alert(msg);
      return;
    }

    // Prevent double-click / duplicate UPDATE while this row is being processed
    if (processingId !== null) return;
    setProcessingId(String(id));

    try {
      // الموافقة تمر عبر طبقة الخدمات adminServiceActions (الاستدعاء الوحيد
      // لـ admin_set_service_status في التطبيق) ويعيد الصف المؤكد من الخادم.
      const updated = await adminApproveService(id);

      // Apply only the row confirmed by the server. This removes it immediately
      // from pending and prepends it to browse using its new reviewed_at value.
      applyServiceUpdate(updated);

    } catch (error: any) {
      console.error('[AdminDashboard] Approve failed for id =', id, ':', {
        message: error?.message, code: error?.code, details: error?.details, hint: error?.hint,
      });
      alert(`فشلت عملية الموافقة: ${error?.message || 'خطأ غير معروف'}`);
    } finally {
      setProcessingId(null);
    }
  };

  // REJECT: عبر طبقة الخدمات adminServiceActions — UPDATE ضد public.services
  // باستخدام ONLY الـ id الرقمي الحقيقي من Supabase. لا slug، لا اعتماد على
  // الكاش المحلي، ولا إخفاء لأخطاء Supabase (PGRST116 = صفر صفوف: معرّف خطأ
  // أو رفض من صلاحيات RLS).
  const handleReject = async (service: Service) => {
    // Strict validation: refuse to run the UPDATE without the real numeric id
    if (!isValidServiceId(service.id)) {
      const msg = 'لا يمكن تنفيذ العملية: معرّف الخدمة غير موجود.';
      console.error('[AdminDashboard] Reject blocked - service.id is missing/invalid:', {
        receivedId: service.id,
        slug: service.slug,
        name: service.name,
      });
      alert(msg);
      return;
    }

    // Prevent double-click / duplicate UPDATE while this row is being processed
    if (processingId !== null) return;
    setProcessingId(String(service.id));

    try {
      console.log("[AdminDashboard] Rejecting service: UPDATE public.services SET status='rejected' WHERE id =", service.id);

      const updated = await adminRejectService(service.id);

      console.log('[AdminDashboard] Reject succeeded:', {
        id: service.id,
        status: updated.status,
      });

      applyServiceUpdate(updated);

    } catch (e: any) {
      console.error(`[AdminDashboard] Reject failed for service.id = ${JSON.stringify(service.id)}:`, e);
      alert(`فشلت عملية الرفض: ${e?.message || 'خطأ غير معروف'}${e?.code ? ` (${e.code})` : ''}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteService = async (id: string | number | undefined) => {
    // Diagnostic: print the exact id that will be used in the DELETE statement
    console.log('[AdminDashboard] Delete requested with service.id =', id);

    if (!isValidServiceId(id)) {
      const msg = `لا يمكن الحذف: الخدمة لا تحتوي على معرّف (id) رقمي صالح من قاعدة البيانات (القيمة المستلمة: ${JSON.stringify(id)}).`;
      console.error('[AdminDashboard]', msg);
      alert(msg);
      return;
    }

    // منع تكرار الطلبات عند النقر المتكرر (نفس آلية الموافقة/الرفض)
    if (processingId !== null) return;
    setProcessingId(String(id));

    try {
      await deleteService(id);
      // The committed delete event removes this row from both lists.

    } catch (error: any) {
      console.error('[AdminDashboard] Delete failed for id =', id, ':', {
        message: error?.message, code: error?.code, details: error?.details, hint: error?.hint,
      });
      alert(`فشل الحذف: ${error?.message || 'خطأ غير معروف'}`);
    } finally {
      setProcessingId(null);
    }
  };

  // -------------------------------------------------------------------------
  // مكتبة الخدمات: تحديد + موافقة جماعية + حذف جماعي (كلها بالـ id الرقمي فقط)
  // -------------------------------------------------------------------------
  const serviceRowKey = (service: Service): string => (isValidServiceId(service.id) ? String(service.id) : '');
  const selectableServiceIds = Array.from(new Set(allServices.map(serviceRowKey).filter(Boolean)));
  const allServicesSelected = selectableServiceIds.length > 0
    && selectableServiceIds.every(id => selectedServiceIds.includes(id));
  const selectedServiceRows = allServices.filter(
    service => isValidServiceId(service.id) && selectedServiceIds.includes(String(service.id))
  );

  const toggleServiceSelection = (id: string) => {
    setSelectedServiceIds(current => current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id]);
  };

  const toggleSelectAllServices = () => {
    setSelectedServiceIds(allServicesSelected ? [] : selectableServiceIds);
  };

  const handleDeleteServiceWithConfirm = async (service: Service) => {
    if (!confirm(`تأكيد حذف الخدمة "${service.name}" نهائيًا من قاعدة البيانات؟`)) return;
    await handleDeleteService(service.id);
    setSelectedServiceIds(current => current.filter(id => id !== serviceRowKey(service)));
  };

  const handleBulkApproveSelected = async () => {
    if (isBulkProcessing || processingId !== null) return;
    const pendingTargets = selectedServiceRows.filter(service => service.status !== 'approved');
    if (pendingTargets.length === 0) {
      alert('الخدمات المحددة معتمدة بالفعل وتظهر في أقسامها. حدّد خدمات قيد المراجعة أو مرفوضة فقط.');
      return;
    }
    setIsBulkProcessing(true);
    let approvedCount = 0;
    const failures: string[] = [];
    for (const service of pendingTargets) {
      try {
        // الموافقة تمر عبر نفس طبقة الخدمات adminServiceActions وتعيد الصف المؤكد.
        const updated = await adminApproveService(service.id!);
        applyServiceUpdate(updated);
        approvedCount += 1;
      } catch (error: any) {
        console.error('[AdminDashboard] Bulk approve failed for id =', service.id, error);
        failures.push(`${service.name}: ${error?.message || 'خطأ غير معروف'}`);
      }
    }
    setSelectedServiceIds([]);
    setIsBulkProcessing(false);
    alert(failures.length === 0
      ? `تمت الموافقة على ${approvedCount} خدمة وظهرت في أقسامها.`
      : `تمت الموافقة على ${approvedCount} خدمة، وفشلت ${failures.length}:\n${failures.join('\n')}`);
  };

  const handleBulkDeleteSelected = async () => {
    if (isBulkProcessing || processingId !== null) return;
    if (selectedServiceRows.length === 0) return;
    if (!confirm(`تأكيد حذف ${selectedServiceRows.length} خدمة نهائيًا من قاعدة البيانات؟`)) return;
    setIsBulkProcessing(true);
    let deletedCount = 0;
    const failures: string[] = [];
    for (const service of selectedServiceRows) {
      try {
        await deleteService(service.id!);
        deletedCount += 1;
      } catch (error: any) {
        console.error('[AdminDashboard] Bulk delete failed for id =', service.id, error);
        failures.push(`${service.name}: ${error?.message || 'خطأ غير معروف'}`);
      }
    }
    setSelectedServiceIds([]);
    setIsBulkProcessing(false);
    alert(failures.length === 0
      ? `تم حذف ${deletedCount} خدمة.`
      : `تم حذف ${deletedCount} خدمة، وفشل حذف ${failures.length}:\n${failures.join('\n')}`);
  };

  const handleEditCategory = (category: any) => {
    const updatedName = window.prompt('تعديل اسم القسم', category.name);
    if (!updatedName || !updatedName.trim()) return;

    const nextName = updatedName.trim();

    if (category.isCustom === true) {
      editCategory(category.slug, { name: nextName });
      return;
    }

    setAdminCategories(prev => prev.map(c => c.slug === category.slug ? { ...c, name: nextName } : c));
  };

  const handleDeleteCategory = async (category: any) => {
    const name = category?.name || category?.slug || 'القسم';

    // Basic sections are hardcoded into the app (data/categories.ts) and, even
    // when a row exists, they are re-merged on every refresh. They cannot be
    // deleted permanently, so we never silently hide-and-restore.
    if (category?.isCustom !== true) {
      alert(`"${name}" من الأقسام الأساسية المدمجة في التطبيق ولا يمكن حذفه بشكل دائم.`);
      return;
    }

    if (!confirm(`هل تريد حذف القسم "${name}" بشكل دائم من قاعدة البيانات؟`)) return;

    try {
      await deleteCategory(category);
      // Remove immediately from the local list for a responsive UI; the data
      // source (useCategories) is already updated on success.
      setAdminCategories(prev => prev.filter(c => c.slug !== category.slug));
      alert(`تم حذف القسم "${name}" بنجاح.`);
    } catch (error: any) {
      console.error('[AdminDashboard] Delete category failed:', {
        message: error?.message, code: error?.code, details: error?.details, hint: error?.hint,
      });
      alert(`فشل حذف القسم "${name}": ${error?.message || 'خطأ غير معروف'}`);
    }
  };

  // فئة أيقونات القائمة: تنضم/تنسحب بسلاسة عند التبديل، وعند الإخفاء
  // يتقلص العرض إلى صفر فلا تبقى مساحة فارغة (النص يأخذ مكانها تلقائياً).
  const navIconCls = `shrink-0 overflow-hidden transition-all duration-200 ${showIcons ? 'w-4 h-4 opacity-100' : 'w-0 opacity-0'}`;

  const openServiceEditor = (service: Service) => {
    if (!isValidServiceId(service.id)) {
      alert('لا يمكن فتح الخدمة: المعرّف الحقيقي للخدمة غير متوفر.');
      return;
    }
    setEditingService(service);
  };

  // serviceStatusLabel و serviceStatusBadgeClass مُوحَّدتان من types/models
  // (المصدر الوحيد لتسميات الحالات وأصناف شاراتها في التطبيق كله).

  return (
    <div className="relative flex min-h-[80vh] w-full min-w-0 max-w-full flex-col gap-4 md:flex-row md:gap-5" dir="rtl">
      {/* Ambient Background Lights */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[20%] -left-[10%] w-[40%] h-[40%] rounded-full bg-[var(--accent-soft)] blur-[120px]" />
        <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-[var(--accent-primary)]/5 blur-[120px]" />
      </div>

      {/* Sidebar */}
      <div className="w-full md:w-52 shrink-0 space-y-3">
        <div className={`bg-[var(--card)] border-[var(--border)] shadow-sm border rounded-2xl p-4 text-center`}>
          <div className="w-12 h-12 mx-auto bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-hover)] rounded-full flex items-center justify-center mb-2 shadow-[0_0_20px_var(--glow)]">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className={`font-bold text-base text-[var(--text-primary)]`}>{t('admin_panel')}</h2>
          <p className="text-xs text-[var(--accent-primary)] mt-0.5 font-bold">{t('full_permissions')}</p>
        </div>

        <div className={`bg-[var(--card)] border-[var(--border)] shadow-sm border rounded-2xl p-2.5 space-y-1`}>
          <button
            onClick={() => { goToTab('overview'); setSelectedCategory(null); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-bold text-sm ${activeTab === 'overview' && !selectedCategory ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]' : `hover:bg-[var(--accent-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}`}
          >
            <Activity className={navIconCls} />
            <span>{t('overview')}</span>
          </button>

          <button
            onClick={() => { goToTab('pending'); setSelectedCategory(null); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all font-bold text-sm ${activeTab === 'pending' ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : `hover:bg-[var(--accent-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}`}
          >
            <div className="flex items-center gap-2">
              <Bell className={navIconCls} />
              <span>{t('new_services_review')}</span>
            </div>
            <AdminCountBadge count={pendingServices.length} />
          </button>

          <button
            onClick={() => { goToTab('rejected'); setSelectedCategory(null); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all font-bold text-sm ${activeTab === 'rejected' ? 'bg-red-500/10 text-red-400' : `hover:bg-[var(--accent-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}`}
          >
            <span>الخدمات المرفوضة</span>
            <AdminCountBadge count={rejectedServices.length} />
          </button>

          <button
            onClick={() => { goToTab('slider'); setSelectedCategory(null); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-bold text-sm ${activeTab === 'slider' ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : `hover:bg-[var(--accent-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}`}
          >
            <ImageIcon className={navIconCls} />
            <span>{t('slider_management')}</span>
          </button>

          <button
            onClick={() => { goToTab('services'); setSelectedCategory(null); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-bold text-sm ${activeTab === 'services' ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : `hover:bg-[var(--accent-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}`}
          >
            <FolderOpen className={navIconCls} />
            <span>الخدمات</span>
          </button>

          <button onClick={() => { goToTab('jobs'); setSelectedCategory(null); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all font-bold text-sm ${activeTab === 'jobs' ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'hover:bg-[var(--accent-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
            <div className="flex items-center gap-2"><BriefcaseBusiness className={navIconCls} /><span>الوظائف</span></div>
            <AdminCountBadge count={pendingJobs} />
          </button>

          <button
            onClick={() => { goToTab('browse'); setSelectedCategory(null); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-bold text-sm ${activeTab === 'browse' ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : `hover:bg-[var(--accent-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}`}
          >
            <Compass className={navIconCls} />
            <span>التصفح</span>
          </button>

          <button
            onClick={() => setIsCategoryManagerOpen(true)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-bold text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]`}
          >
            <FolderOpen className={navIconCls} />
            <span>إدارة الأقسام</span>
          </button>

          <button
            onClick={() => { goToTab('messages'); setSelectedCategory(null); }}
            title="اقتراحات المستخدمين"
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all font-bold text-sm ${activeTab === 'messages' ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'}`}
          >
            <div className="flex items-center gap-2">
              <Lightbulb className={navIconCls} style={{ filter: `drop-shadow(0 0 5px rgba(0,207,255,0.4))` }} />
              <span>اقتراحات المستخدمين</span>
            </div>
            <AdminCountBadge count={messages} />
          </button>
          
          <button type="button" onClick={() => { goToTab('notifications'); setSelectedCategory(null); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all font-bold text-sm ${activeTab === 'notifications' ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]'}`}>
            <span>إدارة الإشعارات</span>
            <AdminCountBadge count={notifications} />
          </button>

          <div className={`pt-1.5 mt-1.5 border-t border-[var(--border)]`}>
            <Link to="/" className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-bold text-sm hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}>
              <ArrowRight className={navIconCls} />
              <span>{t('back_to_app')}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`relative min-w-0 flex-1 overflow-hidden rounded-3xl border bg-[var(--bg-secondary)] border-[var(--border)]`}>
        <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
          {/* زر إظهار/إخفاء أيقونات القائمة (UI فقط) */}
          <button 
            onClick={() => setShowIcons(v => !v)}
            title={showIcons ? 'إخفاء الأيقونات' : 'إظهار الأيقونات'}
            aria-pressed={showIcons}
            className={`p-2 rounded-lg border transition-all bg-[var(--card)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--accent-soft)]`}
          >
            <Equal className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => { goToTab('pending'); setSelectedCategory(null); }}
            className={`relative p-2 rounded-lg border transition-all bg-[var(--card)] border-[var(--border)] text-[var(--text-primary)]`}
            aria-label={t('new_services_review')}
          >
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1.5 -left-1.5">
              <AdminCountBadge count={pendingServices.length} />
            </span>
          </button>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-2 rounded-lg border transition-all bg-[var(--card)] border-[var(--border)] text-[var(--text-primary)]`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Overlay */}
        {isMenuOpen && (
          <div className={`absolute top-16 right-4 z-50 border rounded-xl p-2 w-48 shadow-2xl bg-[var(--surface-elevated)] border-[var(--border)]`}>
            <button onClick={() => { goToTab('overview'); setSelectedCategory(null); setIsMenuOpen(false); }} className={`w-full text-right p-2 rounded-lg flex items-center gap-2 font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]`}>
              <Activity className={navIconCls} /> {t('overview')}
            </button>
            <button onClick={() => { goToTab('pending'); setSelectedCategory(null); setIsMenuOpen(false); }} className={`w-full text-right p-2 rounded-lg flex items-center justify-between font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]`}>
              <div className="flex items-center gap-2">
                <Bell className={navIconCls} /> {t('pending_requests')}
              </div>
              <AdminCountBadge count={pendingServices.length} />
            </button>
            <button onClick={() => { goToTab('rejected'); setSelectedCategory(null); setIsMenuOpen(false); }} className={`w-full text-right p-2 rounded-lg flex items-center justify-between font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]`}>
                الخدمات المرفوضة
              <AdminCountBadge count={rejectedServices.length} />
            </button>
            <button onClick={() => { goToTab('slider'); setSelectedCategory(null); setIsMenuOpen(false); }} className={`w-full text-right p-2 rounded-lg flex items-center gap-2 font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]`}>
              <ImageIcon className={navIconCls} /> {t('slider_management')}
            </button>
            <button onClick={() => { goToTab('services'); setSelectedCategory(null); setIsMenuOpen(false); }} className={`w-full text-right p-2 rounded-lg flex items-center gap-2 font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]`}>
              <FolderOpen className={navIconCls} /> الخدمات
            </button>
            <button onClick={() => { goToTab('jobs'); setSelectedCategory(null); setIsMenuOpen(false); }} className={`w-full text-right p-2 rounded-lg flex items-center justify-between font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]`}>
              <span className="flex items-center gap-2"><BriefcaseBusiness className={navIconCls} /> الوظائف</span>
              <AdminCountBadge count={pendingJobs} />
            </button>
            <button onClick={() => { goToTab('browse'); setSelectedCategory(null); setIsMenuOpen(false); }} className={`w-full text-right p-2 rounded-lg flex items-center gap-2 font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]`}>
              <Compass className={navIconCls} /> التصفح
            </button>
            <button onClick={() => { setIsCategoryManagerOpen(true); setIsMenuOpen(false); }} className={`w-full text-right p-2 rounded-lg flex items-center gap-2 font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]`}>
              <FolderOpen className={navIconCls} /> إدارة الأقسام
            </button>
            <button onClick={() => { goToTab('messages'); setSelectedCategory(null); setIsMenuOpen(false); }} className={`w-full text-right p-2 rounded-lg flex items-center justify-between font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]`}>
              <span className="flex items-center gap-2"><Lightbulb className={navIconCls} /> اقتراحات المستخدمين</span>
              <AdminCountBadge count={messages} />
            </button>
          </div>
        )}

        {activeTab === 'notifications' ? (
          <NotificationsManager />
        ) : activeTab === 'messages' ? (
          <MessagesManager />
        ) : activeTab === 'pending' ? (
          // Pending Services View
          <div className="h-full min-w-0 space-y-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className={`flex items-center gap-3 border-b pb-4 border-[var(--border)]`}>
              <Bell className="w-6 h-6 text-[var(--accent-primary)]" />
              <h2 className={`text-2xl font-bold text-[var(--text-primary)]`}>{t('pending_requests')}</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {pendingServices.length === 0 ? (
                <div className={`text-center py-16 rounded-2xl border text-[var(--text-muted)] bg-[var(--card)] border-[var(--border)]`}>
                  <Check className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-bold">{t('no_pending_requests')}</p>
                </div>
              ) : (
                pendingServices.map(service => {
                  const cat = findCategoryForService(service);
                  return (
                    <div key={service.slug} className={`border rounded-2xl p-4 flex flex-col sm:flex-row gap-4 transition-colors bg-[var(--card)] border-[var(--border)] hover:border-[var(--border-strong)] shadow-sm`}>
                      <img src={service.image} alt={service.name} loading="lazy" decoding="async" className="w-full sm:w-32 h-32 rounded-xl object-cover shrink-0" />
                      <div className="flex-1 space-y-2 min-w-0 py-1">
                        <div className="flex justify-between items-start">
                          <h3 className={`font-bold text-lg text-[var(--text-primary)]`}>{service.name}</h3>
                          <ServiceCategoryChip category={cat} label={cat?.name || t('unknown_section')} />
                        </div>
                        <div className={`text-sm space-y-1.5 text-[var(--text-secondary)]`}>
                          {service.profession && <p><strong className={'text-[var(--text-primary)]'}>{t('profession')}:</strong> {service.profession}</p>}
                          {service.experience && <p className="line-clamp-2"><strong className={'text-[var(--text-primary)]'}>{t('experience')}:</strong> {service.experience}</p>}
                          <div className="flex items-center gap-1.5 truncate font-medium"><MapPin className="w-3.5 h-3.5 shrink-0 text-[var(--accent-primary)]"/> <span className="truncate">{service.location}</span></div>
                          {service.phone && <div className="flex items-center gap-1.5 font-bold"><Phone className="w-3.5 h-3.5 shrink-0 text-[var(--accent-primary)]"/> <span dir="ltr">{service.phone}</span></div>}
                          <p className="text-xs opacity-80">
                            صاحب الخدمة: {service.ownerId || (service.userId ? `مستخدم #${service.userId}` : 'زائر')}
                            {' • '}تاريخ الإضافة: {new Date(service.createdAt).toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex sm:flex-col gap-2 shrink-0 justify-center">
                        <button onClick={() => handleApprove(service.id)}
                          disabled={processingId !== null}
                          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors font-bold disabled:opacity-60 disabled:cursor-not-allowed ${processingId === String(service.id) ? 'bg-[var(--accent-soft)]' : 'bg-[var(--accent-soft)] text-[var(--accent-primary)] hover:bg-[var(--accent-soft)]'}`}>
                          {processingId === String(service.id) ? (
                            <span className="w-4 h-4 border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)] rounded-full animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )} {t('approve')}
                        </button>
                        <button onClick={() => handleReject(service)}
                          disabled={processingId !== null}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors font-bold disabled:opacity-60 disabled:cursor-not-allowed">
                          {processingId === String(service.id) ? (
                            <span className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )} {t('reject')}
                        </button>
                        <button onClick={() => {
                          if (!isValidServiceId(service.id)) {
                            console.error('[AdminDashboard] Edit blocked - service.id is missing/invalid:', {
                              receivedId: service.id,
                              slug: service.slug,
                              name: service.name,
                            });
                            alert('لا يمكن تنفيذ العملية: معرّف الخدمة غير موجود.');
                            return;
                          }
                          setEditingService(service);
                        }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl transition-colors font-bold">
                          <Edit className="w-4 h-4" /> {t('edit')}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : activeTab === 'rejected' ? (
          // Rejected Services View
          <div className="h-full min-w-0 space-y-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className={`flex items-center gap-3 border-b pb-4 border-[var(--border)]`}>
              <XCircle className="w-6 h-6 text-red-500" />
              <h2 className={`text-2xl font-bold text-[var(--text-primary)]`}>الخدمات المرفوضة</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {rejectedServices.length === 0 ? (
                <div className={`text-center py-16 rounded-2xl border text-[var(--text-muted)] bg-[var(--card)] border-[var(--border)]`}>
                  <Check className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-bold">لا توجد خدمات مرفوضة</p>
                </div>
              ) : (
                rejectedServices.map(service => {
                  const cat = findCategoryForService(service);
                  return (
                    <div key={service.slug} className={`border rounded-2xl p-4 flex flex-col sm:flex-row gap-4 transition-colors bg-[var(--card)] border-[var(--border)] hover:border-[var(--border-strong)] shadow-sm`}>
                      <img src={service.image} alt={service.name} loading="lazy" decoding="async" className="w-full sm:w-32 h-32 rounded-xl object-cover shrink-0 opacity-60" />
                      <div className="flex-1 space-y-2 min-w-0 py-1">
                        <div className="flex justify-between items-start">
                          <h3 className={`font-bold text-lg text-[var(--text-primary)]`}>{service.name}</h3>
                          <ServiceCategoryChip category={cat} label={cat?.name || t('unknown_section')} />
                        </div>
                        <div className={`text-sm space-y-1.5 text-[var(--text-secondary)]`}>
                          {service.profession && <p><strong className={'text-[var(--text-primary)]'}>{t('profession')}:</strong> {service.profession}</p>}
                          <div className="flex items-center gap-1.5 truncate font-medium"><MapPin className="w-3.5 h-3.5 shrink-0 text-[var(--accent-primary)]"/> <span className="truncate">{service.location}</span></div>
                          {service.phone && <div className="flex items-center gap-1.5 font-bold"><Phone className="w-3.5 h-3.5 shrink-0 text-[var(--accent-primary)]"/> <span dir="ltr">{service.phone}</span></div>}
                          {service.rejectionReason && (
                            <div className="flex items-center gap-1.5 font-bold text-red-500">
                              <XCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>سبب الرفض: {service.rejectionReason}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex sm:flex-col gap-2 shrink-0 justify-center">
                        <button onClick={() => handleApprove(service.id)}
                          disabled={processingId !== null}
                          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors font-bold disabled:opacity-60 disabled:cursor-not-allowed ${processingId === String(service.id) ? 'bg-[var(--accent-soft)]' : 'bg-[var(--accent-soft)] text-[var(--accent-primary)] hover:bg-[var(--accent-soft)]'}`}>
                          {processingId === String(service.id) ? (
                            <span className="w-4 h-4 border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)] rounded-full animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )} {t('approve')}
                        </button>
                        <button onClick={() => {
                          if (processingId !== null) return;
                          if (!isValidServiceId(service.id)) {
                            console.error('[AdminDashboard] Edit blocked - service.id is missing/invalid:', {
                              receivedId: service.id,
                              slug: service.slug,
                              name: service.name,
                            });
                            alert('لا يمكن تنفيذ العملية: معرّف الخدمة غير موجود.');
                            return;
                          }
                          setEditingService(service);
                        }} disabled={processingId !== null} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl transition-colors font-bold disabled:opacity-60 disabled:cursor-not-allowed">
                          <Edit className="w-4 h-4" /> {t('edit')}
                        </button>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteService(service.id);
                        }} disabled={processingId !== null} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors font-bold disabled:opacity-60 disabled:cursor-not-allowed">
                          {processingId === String(service.id) ? (
                            <span className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )} {t('delete')}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : activeTab === 'slider' ? (
          <SliderManager />
        ) : activeTab === 'jobs' ? (
          <div className="h-full min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8"><JobsAdminPanel /></div>
        ) : activeTab === 'services' ? (
          <div className="h-full min-w-0 space-y-7 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="flex items-center gap-3 border-b pb-4 border-[var(--border)]">
              <FolderOpen className="w-6 h-6 text-[var(--accent-primary)]" />
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">مكتبة الخدمات</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">جميع الخدمات الموجودة حاليًا، منظمة حسب القسم.</p>
              </div>
            </div>

            {/* أدوات التحديد الجماعي: تحديد الكل | موافقة على المحدد | حذف المحدد */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)]">
                <CheckCheck className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>تم تحديد {selectedServiceIds.length} من {selectableServiceIds.length} خدمة</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllServices}
                  disabled={selectableServiceIds.length === 0 || isBulkProcessing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--surface-elevated)] px-3 py-2 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-light)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Equal className="h-4 w-4" /> {allServicesSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                </button>
                <button
                  type="button"
                  onClick={handleBulkApproveSelected}
                  disabled={selectedServiceIds.length === 0 || isBulkProcessing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-500 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBulkProcessing ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )} موافقة على المحدد
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteSelected}
                  disabled={selectedServiceIds.length === 0 || isBulkProcessing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" /> حذف المحدد
                </button>
              </div>
            </div>

            {servicesByCategory.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] py-16 text-center text-[var(--text-muted)]">
                <FolderOpen className="mx-auto mb-4 h-11 w-11 opacity-30" />
                <p className="font-bold">لا توجد خدمات لعرضها حاليًا.</p>
              </div>
            ) : servicesByCategory.map(({ category, services: categoryServices }) => (
              <section key={category.slug} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ServiceCategoryChip category={category} label={category.name} />
                    <h3 className="font-bold text-[var(--text-primary)]">{category.name}</h3>
                  </div>
                  <span className="text-xs font-bold text-[var(--text-muted)]">{categoryServices.length} خدمة</span>
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {categoryServices.map(service => {
                    const rowId = serviceRowKey(service);
                    const isSelected = rowId !== '' && selectedServiceIds.includes(rowId);
                    const isApproved = service.status === 'approved';
                    return (
                    <article key={String(service.id ?? service.slug)} className={`flex gap-3 rounded-2xl border bg-[var(--card)] p-3 shadow-sm ${isSelected ? 'border-[var(--accent-primary)]' : 'border-[var(--border)]'}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={rowId === '' || isBulkProcessing}
                        onChange={() => rowId && toggleServiceSelection(rowId)}
                        aria-label={`تحديد الخدمة ${service.name}`}
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-primary)] disabled:opacity-40"
                      />
                      {service.image && <img src={service.image} alt={service.name} loading="lazy" decoding="async" className="h-20 w-20 shrink-0 rounded-xl object-cover" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="truncate font-bold text-[var(--text-primary)]">{service.name}</h4>
                          <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${serviceStatusBadgeClass(service.status)}`}>{serviceStatusLabel(service.status)}</span>
                        </div>
                        {service.profession && <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{service.profession}</p>}
                        {service.location && <p className="mt-1 flex items-center gap-1 truncate text-xs text-[var(--text-muted)]"><MapPin className="h-3 w-3" />{service.location}</p>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openServiceEditor(service)}
                            disabled={processingId !== null || isBulkProcessing}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Edit className="h-3.5 w-3.5" /> تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(service.id)}
                            disabled={processingId !== null || isBulkProcessing || isApproved}
                            title={isApproved ? 'الخدمة معتمدة بالفعل وتظهر في قسمها' : 'اعتماد الخدمة لتظهر في التصفح وقسمها'}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-500 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingId === String(service.id) ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )} موافقة
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteServiceWithConfirm(service)}
                            disabled={processingId !== null || isBulkProcessing}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> حذف
                          </button>
                        </div>
                      </div>
                    </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : activeTab === 'browse' ? (
          <div className="h-full min-w-0 space-y-7 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="flex items-center gap-3 border-b pb-4 border-[var(--border)]">
              <Compass className="w-6 h-6 text-[var(--accent-primary)]" />
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">إدارة التصفح</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">معاينة الخدمات المعتمدة التي تظهر حاليًا في صفحة التصفح.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
              الترتيب الحالي يعتمد على تاريخ إضافة الخدمة من البيانات الموجودة. لا يوجد ترتيب يدوي أو إعدادات عرض قابلة للحفظ في البنية الحالية، لذلك لم تُضف أي قاعدة بيانات أو تخزين جديد.
            </div>

            {browseServicesByCategory.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] py-16 text-center text-[var(--text-muted)]">
                <Compass className="mx-auto mb-4 h-11 w-11 opacity-30" />
                <p className="font-bold">لا توجد خدمات معتمدة تظهر في التصفح حاليًا.</p>
              </div>
            ) : browseServicesByCategory.map(({ category, services: categoryServices }) => (
              <section key={category.slug} className="space-y-3">
                <div className="flex items-center gap-2">
                  <ServiceCategoryChip category={category} label={category.name} />
                  <h3 className="font-bold text-[var(--text-primary)]">{category.name}</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {categoryServices.map(service => (
                    <article key={String(service.id ?? service.slug)} className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm">
                      {service.image && <img src={service.image} alt={service.name} loading="lazy" decoding="async" className="h-20 w-20 shrink-0 rounded-xl object-cover" />}
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-bold text-[var(--text-primary)]">{service.name}</h4>
                        {service.experience && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{service.experience}</p>}
                        <button type="button" onClick={() => openServiceEditor(service)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-bold text-[var(--accent-primary)] hover:bg-[var(--accent-light)]">
                          <Edit className="h-3.5 w-3.5" /> فتح التفاصيل والتعديل
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : selectedCategory ? (
          // Category Management View
          <div className="space-y-6 animate-in fade-in p-6 lg:p-8">
            <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 rounded-2xl border gap-4 bg-[var(--card)] border-[var(--border)] shadow-sm`}>
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedCategory(null)} className={`p-2 rounded-xl transition-colors hover:bg-[var(--surface-elevated)] bg-[var(--bg-secondary)] text-[var(--text-primary)]`}>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  {activeCategory && (
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[activeCategory.color as keyof typeof colorMap]?.bg || 'bg-[var(--bg-secondary)]0'}/10`}>
                      {activeCategory.icon && typeof activeCategory.icon !== 'string' ? (
                        <activeCategory.icon className={`w-6 h-6 ${colorMap[activeCategory.color as keyof typeof colorMap]?.text || 'text-[var(--text-muted)]'}`} />
                      ) : (
                        <FolderOpen className="w-6 h-6 text-[var(--text-muted)]" />
                      )}
                    </div>
                  )}
                  <div>
                    <h2 className={`text-2xl font-bold text-[var(--text-primary)]`}>{activeCategory?.name}</h2>
                    <p className="text-sm text-[var(--text-muted)] mt-1 font-bold">{activeCategoryServices.length} {t('registered_services')}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsAddingService(true)}
                className="flex items-center gap-2 bg-[var(--accent-primary)] text-white px-6 py-3 rounded-xl font-bold hover:shadow-[0_0_20px_var(--glow)] transition-all w-full sm:w-auto justify-center"
              >
                <Plus className="w-5 h-5" /> {t('add_new_service')}
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {activeCategoryServices.length === 0 ? (
                <div className={`col-span-full text-center py-16 rounded-2xl border text-[var(--text-muted)] bg-[var(--card)] border-[var(--border)]`}>
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-bold">{t('no_services_in_section')}</p>
                </div>
              ) : (
                activeCategoryServices.map(service => (
                  <motion.div 
                    key={service.slug} 
                    layout
                    className={`border rounded-2xl p-4 flex flex-col gap-4 transition-colors group cursor-pointer bg-[var(--card)] border-[var(--border)] hover:border-[var(--border-strong)] shadow-sm`}
                    onClick={() => setExpandedServiceSlug(prev => prev === service.slug ? null : service.slug)}
                  >
                    <div className="flex gap-4">
                      <img src={service.image} alt={service.name} loading="lazy" decoding="async" className="w-24 h-24 rounded-xl object-cover shrink-0" />
                      <div className="flex-1 space-y-2 min-w-0 py-1">
                        <h3 className={`font-bold text-lg truncate text-[var(--text-primary)]`}>{service.name}</h3>
                        <div className={`text-sm space-y-1.5 text-[var(--text-secondary)]`}>
                          <div className="flex items-center gap-1.5 truncate font-medium"><MapPin className="w-3.5 h-3.5 shrink-0 text-[var(--accent-primary)]"/> <span className="truncate">{service.location}</span></div>
                          {service.phone && <div className="flex items-center gap-1.5 font-bold"><Phone className="w-3.5 h-3.5 shrink-0 text-[var(--accent-primary)]"/> <span dir="ltr">{service.phone}</span></div>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0 justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setEditingService(service)} className="p-2.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl transition-colors" title={t('edit')}>
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { 
                          e.stopPropagation(); 
                          e.preventDefault();
                          handleDeleteService(service.id);
                        }} className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors" title={t('delete')}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedServiceSlug === service.slug && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className={`overflow-hidden border-t pt-4 mt-2 border-[var(--border)]`}
                        >
                          <div className={`space-y-3 text-sm text-[var(--text-primary)]`}>
                            <p><strong className={'text-[var(--text-primary)]'}>{t('experience')}:</strong> {service.experience || t('no_description')}</p>
                            {service.latitude && service.longitude && (
                              <p><strong className={'text-[var(--text-primary)]'}>{t('coordinates')}:</strong> {service.latitude.toFixed(4)}, {service.longitude.toFixed(4)}</p>
                            )}
                            
                            {/* Move Service Dropdown */}
                            <div className="pt-2">
                              {movingServiceId === service.slug ? (
                                <div className="flex items-center gap-2">
                                  <select
                                    className={`border rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[var(--accent-primary)] bg-[var(--card)] border-[var(--border)] text-[var(--text-primary)]`}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      const nextCategory = e.target.value;
                                      if (service.id === undefined || service.id === null) {
                                        alert('لا يمكن النقل: الخدمة لا تحتوي على معرّف (id) صالح في قاعدة البيانات.');
                                        setMovingServiceId(null);
                                        return;
                                      }
                                      editService(service.id, { categorySlug: nextCategory })
                                        .catch((error: any) => {
                                          console.error('[AdminDashboard] Move service failed:', {
                                            message: error?.message, code: error?.code, details: error?.details, hint: error?.hint,
                                          });
                                          alert(`فشل نقل الخدمة: ${error?.message || 'خطأ غير معروف'}`);
                                        });
                                      setMovingServiceId(null);
                                    }}
                                    defaultValue={service.categorySlug}
                                  >
                                    {categories.map((c: any) => (
                                      <option key={c.slug} value={c.slug}>{c.name}</option>
                                    ))}
                                  </select>
                                  <button onClick={(e) => { e.stopPropagation(); setMovingServiceId(null); }} className="p-1 text-[var(--text-muted)] hover:text-white">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); setMovingServiceId(service.slug); }} className="text-xs text-[var(--accent-primary)] hover:text-white flex items-center gap-1 font-bold">
                                  <ArrowRightLeft className="w-3 h-3" /> {t('move_to_section')}
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        ) : (
          // Main Dashboard View
          <div className="h-full min-w-0 space-y-10 overflow-y-auto p-4 sm:p-6 lg:p-8">
            
            {/* Section 1: General (قسم العامة) */}
            <section className="space-y-6">
              <div className={`flex items-center gap-3 border-b pb-4 border-[var(--border)]`}>
                <Activity className="w-6 h-6 text-[var(--accent-primary)]" />
                <h2 className={`text-2xl font-bold text-[var(--text-primary)]`}>{t('general_section')}</h2>
              </div>
              
              {/* Real Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className={`border rounded-2xl p-6 flex items-center gap-5 bg-[var(--card)] border-[var(--border)] shadow-sm`}>
                  <div className="w-14 h-14 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                    <LayoutGrid className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-sm mb-1 font-bold">{t('app_sections')}</p>
                    <p className={`text-3xl font-bold text-[var(--text-primary)]`}>{totalCategories}</p>
                  </div>
                </div>
                
                <div className={`border rounded-2xl p-6 flex items-center gap-5 bg-[var(--card)] border-[var(--border)] shadow-sm`}>
                  <div className="w-14 h-14 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                    <Activity className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-sm mb-1 font-bold">{t('total_services')}</p>
                    <p className={`text-3xl font-bold text-[var(--text-primary)]`}>{totalServices.toString().padStart(2, '0')}</p>
                  </div>
                </div>

                <div className={`border rounded-2xl p-6 flex items-center gap-5 sm:col-span-2 lg:col-span-1 bg-[var(--card)] border-[var(--border)] shadow-sm`}>
                  <div className="w-14 h-14 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                    <Eye className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-sm mb-1 font-bold">{t('total_visits')}</p>
                    <p className={`text-3xl font-bold text-[var(--text-primary)]`}>{stats.visits}</p>
                  </div>
                </div>
              </div>

              {/* Popular Categories (Real Data) */}
              <div className={`border rounded-2xl p-6 bg-[var(--card)] border-[var(--border)] shadow-sm`}>
                <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 text-[var(--text-primary)]`}>
                  <TrendingUp className="w-5 h-5 text-[var(--accent-primary)]" />
                  {t('most_popular_services')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categoryStats.filter((c: any) => c.count > 0).length > 0 ? (
                    categoryStats.filter((c: any) => c.count > 0).map((cat: any) => {
                      const Icon = cat.icon;
                      return (
                        <div key={cat.slug} className={`flex items-center justify-between p-3 rounded-xl border bg-[var(--bg-secondary)] border-[var(--border)]`}>
                          <div className="flex items-center gap-3">
                            {Icon && typeof Icon !== 'string' && <Icon className={`w-5 h-5 ${colorMap[cat.color as keyof typeof colorMap]?.text || 'text-[var(--text-muted)]'}`} />}
                            <span className={`font-bold text-sm text-[var(--text-primary)]`}>{cat.name}</span>
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--surface-elevated)] text-[var(--text-secondary)]`}>
                            {cat.count} {t('services_count')}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full text-center py-8 text-[var(--text-muted)] text-sm font-bold">
                      {t('no_services_added')}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Section 2: Browse Management (إدارة التصفح) */}
            <section className="space-y-6">
              <div className={`flex items-center justify-between border-b pb-4 border-[var(--border)]`}>
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-6 h-6 text-[var(--accent-primary)]" />
                  <h2 className={`text-2xl font-bold text-[var(--text-primary)]`}>{t('browse_management')}</h2>
                </div>
                <button
                  onClick={() => setIsAddingCategory(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors text-sm font-bold bg-[var(--surface-elevated)] hover:bg-[var(--accent-light)] text-[var(--text-primary)]`}
                >
                  <Plus className="w-4 h-4" /> {t('add_new_section')}
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryStats.map((cat: any) => {
                  const Icon = cat.icon;
                  const isCustom = cat.isCustom === true;

                  return (
                    <div
                      key={cat.slug}
                      className={`relative border rounded-2xl overflow-hidden transition-all group bg-[var(--card)] border-[var(--border)] hover:bg-[var(--bg-secondary)] hover:border-[var(--border-strong)] shadow-sm`}
                    >
                      <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCategory(cat);
                          }}
                          className={`p-1.5 rounded-lg transition-colors bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]`}
                          title="تعديل القسم"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(cat);
                          }}
                          className={`p-1.5 rounded-lg transition-colors bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-red-600`}
                          title="حذف القسم"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedCategory(cat.slug)}
                        className="w-full p-5 flex items-center justify-between transition-all group text-right"
                      >
                        <div className="flex-1 flex items-center gap-4 mr-12">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${colorMap[cat.color as keyof typeof colorMap]?.bg || 'bg-[var(--bg-secondary)]0'}/10`}>
                            {Icon && typeof Icon !== 'string' && <Icon className={`w-6 h-6 ${colorMap[cat.color as keyof typeof colorMap]?.text || 'text-[var(--text-muted)]'}`} />}
                          </div>
                          <div>
                            <h3 className={`font-bold transition-colors text-[var(--text-primary)] group-hover:text-[var(--text-primary)]`}>{cat.name}</h3>
                            <p className="text-sm text-[var(--text-muted)] mt-0.5 font-bold">{cat.count} {t('services_count')}</p>
                          </div>
                        </div>
                        <ChevronLeft className={`w-5 h-5 transition-colors text-[var(--text-muted)] group-hover:text-[var(--text-primary)]`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

          </div>
        )}
      </div>

      {isCategoryManagerOpen && (
        <div className="fixed inset-0 z-50 flex min-w-0 items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4">
          <div className={`w-full min-w-0 max-w-2xl overflow-hidden rounded-2xl border bg-[var(--card)] border-[var(--border)] shadow-2xl`}>
            <div className={`flex min-w-0 items-center justify-between gap-2 border-b border-[var(--border)] p-4`}>
              <h3 className={`min-w-0 break-words text-xl font-bold text-[var(--text-primary)]`}>
                إدارة الأقسام
              </h3>
              <button
                onClick={() => setIsCategoryManagerOpen(false)}
                className={`p-2 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--text-primary)]`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {adminCategories.map((cat: any) => {
                const Icon = cat.icon;
                const isCustom = cat.isCustom === true;

                return (
                  <div key={cat.slug} className={`flex min-w-0 flex-col items-stretch justify-between gap-3 rounded-xl border p-3 min-[420px]:flex-row min-[420px]:items-center bg-[var(--bg-secondary)] border-[var(--border)]`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colorMap[cat.color as keyof typeof colorMap]?.bg || 'bg-[var(--bg-secondary)]0'}/10`}>
                        {Icon && typeof Icon !== 'string' && <Icon className={`w-5 h-5 ${colorMap[cat.color as keyof typeof colorMap]?.text || 'text-[var(--text-muted)]'}`} />}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-bold truncate text-[var(--text-primary)]`}>{cat.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{isCustom ? 'قسم مخصص' : 'قسم أساسي'}</p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditCategory(cat)}
                        className="flex items-center gap-1 rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-bold text-blue-400 hover:bg-blue-500/20"
                      >
                        <Edit className="w-4 h-4" /> تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" /> حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {editingService && (
        <EditServiceModal
          service={editingService}
          onClose={() => setEditingService(null)}
        />
      )}
      {isAddingService && (
        <AddServiceModal
          initialCategorySlug={selectedCategory || undefined}
          onClose={() => setIsAddingService(false)}
          isAdmin={true}
        />
      )}
      {isAddingCategory && (
        <AddCategoryModal onClose={() => setIsAddingCategory(false)} onAdd={async (cat) => { await addCategory(cat); }} />
      )}
    </div>
  );
}
