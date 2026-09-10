import { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

const pad = (value: number) => String(value).padStart(2, '0');

function AnalogClock({ now }: { now: Date }) {
  const milliseconds = now.getMilliseconds();
  const seconds = now.getSeconds() + milliseconds / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  return (
    <div className="wisal-analog-clock shrink-0" aria-hidden="true">
      <div className="wisal-clock-face">
        {Array.from({ length: 12 }, (_, index) => (
          <i key={index} className="wisal-clock-mark" style={{ transform: `rotate(${index * 30}deg)` }} />
        ))}
        <span className="wisal-clock-hand wisal-hour-hand" style={{ transform: `rotate(${hours * 30}deg)` }} />
        <span className="wisal-clock-hand wisal-minute-hand" style={{ transform: `rotate(${minutes * 6}deg)` }} />
        <span className="wisal-clock-hand wisal-second-hand" style={{ transform: `rotate(${seconds * 6}deg)` }} />
        <span className="wisal-clock-pin" />
      </div>
    </div>
  );
}

export default function HeaderClock() {
  const [now, setNow] = useState(() => new Date());
  const [showClock, setShowClock] = useState(false);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 100);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    // دورة ثابتة تضمن العودة إلى الهوية وعدم توقف التناوب بعد أول انتقال.
    const alternate = window.setInterval(() => setShowClock(current => !current), 6000);
    return () => window.clearInterval(alternate);
  }, []);

  const hour = now.getHours() % 12 || 12;
  const period = now.getHours() >= 12 ? 'م' : 'ص';
  const date = useMemo(() => new Intl.DateTimeFormat('ar-IQ', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(now), [now.getDate(), now.getMonth(), now.getFullYear()]);

  return (
    <div className="relative flex h-16 w-[218px] max-w-[58vw] items-center justify-center sm:w-[270px]" aria-live="off">
      <AnimatePresence initial={false} mode="wait">
        {!showClock ? (
          <motion.div
            key="brand"
            initial={{ opacity: 0, filter: 'blur(2px) brightness(0.8)' }}
            animate={{ opacity: 1, filter: 'blur(0px) brightness(1)' }}
            exit={{ opacity: 0, filter: 'blur(2px) brightness(0.8)' }}
            transition={{ duration: 0.65, ease: 'easeInOut' }}
            className="wisal-header-identity relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl"
            aria-label="وصال، كل الخدمات في مكان واحد"
          >
            <span className="wisal-logo-aurora" aria-hidden="true" />
            <img
              src={`${(import.meta as any).env.BASE_URL}assets/wisal-header-brand-animated.png`}
              alt="وصال — WISAL — كل الخدمات في مكان واحد"
              className="wisal-living-logo relative z-10 max-h-[58px] max-w-full object-contain"
              draggable={false}
            />
            <span className="wisal-logo-shine" aria-hidden="true" />
          </motion.div>
        ) : (
          <motion.div
            key="clock"
            role="timer"
            aria-label={`${pad(hour)}:${pad(now.getMinutes())} ${period}، ${date}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: 'easeInOut' }}
            className="wisal-header-clock flex w-full items-center justify-center gap-2 rounded-2xl px-2 py-1.5 sm:gap-3"
            dir="ltr"
          >
            <AnalogClock now={now} />
            <div className="min-w-0 text-center leading-none" dir="rtl">
              <div className="wisal-digital-time whitespace-nowrap font-black tabular-nums" dir="ltr">
                {pad(hour)}:{pad(now.getMinutes())} <span>{period}</span>
              </div>
              <div className="mt-1 flex items-center justify-center gap-1 whitespace-nowrap text-[9px] font-bold text-slate-300 sm:text-[11px]">
                <CalendarDays className="h-3 w-3 shrink-0 text-violet-300" />
                <span>{date}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
