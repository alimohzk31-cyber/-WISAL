import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import wisalMenuBanner from '../assets/wisal-admin-banner.png';

/** This component lives only in the open main menu. PIN characters never enter the DOM. */
export default function MenuWisalAccess() {
  const { beginAdminPinAttempt, loginWithPin } = useAuth();
  const navigate = useNavigate();
  const [armed, setArmed] = useState(false);
  const clicks = useRef(0);
  const pin = useRef('');
  const busy = useRef(false);
  const attempt = useRef(0);
  const deadline = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTemporaryInput = useCallback(() => {
    attempt.current++;
    clicks.current = 0;
    pin.current = '';
    deadline.current = 0;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (inputTimer.current) clearTimeout(inputTimer.current);
    clickTimer.current = inputTimer.current = null;
  }, []);

  const cancel = useCallback(() => {
    clearTemporaryInput();
    setArmed(false);
  }, [clearTemporaryInput]);

  useEffect(() => clearTemporaryInput, [clearTemporaryInput]);

  const handleClick = () => {
    if (armed || busy.current) return;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clicks.current++;
    if (clicks.current === 5) {
      clearTemporaryInput();
      beginAdminPinAttempt();
      deadline.current = Date.now() + 10_000;
      setArmed(true);
      inputTimer.current = setTimeout(cancel, 10_000);
    } else {
      clickTimer.current = setTimeout(() => { clicks.current = 0; }, 2000);
    }
  };

  useEffect(() => {
    if (!armed) return;
    const submit = async () => {
      if (busy.current || pin.current.length !== 6) return;
      busy.current = true;
      const currentAttempt = attempt.current;
      const submittedPin = pin.current;
      pin.current = '';
      if (inputTimer.current) clearTimeout(inputTimer.current);
      inputTimer.current = null;
      try {
        const result = await loginWithPin(submittedPin);
        if (currentAttempt !== attempt.current) {
          // Closing the menu or leaving the tab cannot grant access later.
          if (result.ok) beginAdminPinAttempt();
          return;
        }
        cancel();
        if (result.ok) navigate('/admin');
      } catch {
        if (currentAttempt === attempt.current) cancel();
      } finally {
        busy.current = false;
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      if (!/^[0-9]$/.test(event.key) && !['Backspace', 'Delete', 'Escape', 'Enter'].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Escape') { cancel(); return; }
      if (busy.current || event.repeat) return;
      if (Date.now() >= deadline.current) { cancel(); return; }
      if (event.key === 'Backspace') pin.current = pin.current.slice(0, -1);
      else if (event.key === 'Delete') pin.current = '';
      else if (/^[0-9]$/.test(event.key)) {
        pin.current += event.key;
        if (pin.current.length === 6) void submit();
      }
    };
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [armed, beginAdminPinAttempt, cancel, loginWithPin, navigate]);

  return <div className="flex w-full flex-col items-center gap-2 pb-2">
    <button type="button" aria-label="WISAL" onClick={handleClick}
      className="block w-full overflow-hidden rounded-xl">
      <img src={wisalMenuBanner} width={1672} height={941}
        alt="" className="block h-auto w-full rounded-xl object-contain" draggable={false} />
    </button>
    {armed && <p className="text-center text-[11px] font-bold text-[var(--text-primary)]">وصال | كل الخدمات في مكان واحد</p>}
  </div>;
}
