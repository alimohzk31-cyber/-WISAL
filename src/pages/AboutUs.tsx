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
    <div className="max-w-4xl mx-auto space-y-12 py-8">
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
          className="text-4xl md:text-5xl font-black"
        >
          {t('about_us')}
        </motion.h1>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto"
        >
          {t('project_description')}
        </motion.p>
      </div>

      {/* Goal & Team Grid */}
      <div className="grid md:grid-cols-2 gap-8">
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="p-8 rounded-3xl border bg-[var(--card)] border-[var(--border)] shadow-[var(--shadow-lg)]"
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
          className="p-8 rounded-3xl border bg-[var(--card)] border-[var(--border)] shadow-[var(--shadow-lg)]"
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
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all hover:scale-105"
          style={{ backgroundColor: primaryColor, color: '#fff' }}
        >
          <ArrowRight className="w-5 h-5" />
          {t('back_to_app')}
        </Link>
      </div>
    </div>
  );
}
