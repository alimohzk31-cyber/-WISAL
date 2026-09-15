import { useMemo } from 'react';
import ContentSlider from '../../components/ContentSlider';
import { buildJobContentSlides, DEMO_JOB_SLIDES, SLIDER_DEMO_MODE } from '../../lib/contentSlides';
import { JOB_SLIDER_SETTINGS_DEFAULTS, type JobSliderSettings } from './jobSlideMeta';
import type { Job } from './types';

export default function JobsSlider({ jobs = [], settings = JOB_SLIDER_SETTINGS_DEFAULTS, loading = false }: { jobs?: Job[]; settings?: JobSliderSettings; loading?: boolean }) {
  const slides = useMemo(() => SLIDER_DEMO_MODE ? DEMO_JOB_SLIDES : buildJobContentSlides(jobs), [jobs]);
  // صور الوظائف عمودية/مربعة/أفقية: تُعرض كاملة (contain) فوق طبقة مموّهة
  // تملأ الفراغات — بدل قص أعلى/أسفل الصورة بـ object-cover.
  return <ContentSlider slides={slides} loading={loading} label="الوظائف المعتمدة" testId="jobs-slider" imageFit="contain"
    autoplay={settings.autoplay} durationSeconds={settings.durationSeconds} loop={settings.loop} touchDrag={settings.touchDrag} />;
}
