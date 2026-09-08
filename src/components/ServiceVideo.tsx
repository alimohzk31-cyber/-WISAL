import { useState } from 'react';

export default function ServiceVideo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (!src) return null;
  return <div className="space-y-2">
    {failed ? <div role="alert" className="p-4 text-center">
      <p>تعذر تشغيل الفيديو. تحقق من الاتصال أو حاول فتحه مباشرة.</p>
      <button type="button" onClick={() => { setFailed(false); setAttempt(n => n + 1); }} className="underline mx-2">إعادة المحاولة</button>
      <a href={src} target="_blank" rel="noopener noreferrer" className="underline">فتح الفيديو</a>
    </div> : <video key={attempt} src={src} controls playsInline preload="metadata" onError={() => setFailed(true)} className="w-full max-h-80 rounded-xl" aria-label="فيديو الخدمة" />}
  </div>;
}
