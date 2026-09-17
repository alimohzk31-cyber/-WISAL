import { motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme, getPrimaryColor } from '../context/ThemeContext';
import { Info, Target, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AboutUs() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const primaryColor = getPrimaryColor(theme);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-12 py-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-6"
          style={{ backgroundColor: `${primaryColor}20`, border: `1px solid ${primaryColor}40` }}
        >
          <Info className="w-10 h-10" style={{ color: primaryColor }} />
        </motion.div>
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="break-words text-3xl font-black sm:text-4xl md:text-5xl"
        >
          {t('about_us')}
        </motion.h1>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mx-auto max-w-2xl break-words text-lg text-[var(--text-secondary)] sm:text-xl"
        >
          {t('project_description')}
        </motion.p>
      </div>

      {/* Goal & Team Grid */}
      <div className="grid min-w-0 gap-5 md:grid-cols-2 md:gap-8">
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="min-w-0 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-lg)] sm:p-8"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: `${primaryColor}20` }}>
            <Target className="w-6 h-6" style={{ color: primaryColor }} />
          </div>
          <h2 className="text-2xl font-bold mb-4">{t('about_goal')}</h2>
          <p className="text-[var(--text-muted)] leading-relaxed">
            {t('about_goal_desc')}
          </p>
        </motion.div>

        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="min-w-0 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-lg)] sm:p-8"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: `${primaryColor}20` }}>
            <Users className="w-6 h-6" style={{ color: primaryColor }} />
          </div>
          <h2 className="text-2xl font-bold mb-4">{t('about_team')}</h2>
          <p className="text-[var(--text-muted)] leading-relaxed">
            {t('about_team_desc')}
          </p>
        </motion.div>
      </div>

      {/* Back to Home */}
      <div className="text-center pt-8">
        <Link 
          to="/"
          className="inline-flex max-w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-center font-bold transition-all hover:scale-105 sm:px-8"
          style={{ backgroundColor: primaryColor, color: '#fff' }}
        >
          <ArrowRight className="w-5 h-5" />
          {t('back_to_app')}
        </Link>
      </div>
    </div>
  );
}
