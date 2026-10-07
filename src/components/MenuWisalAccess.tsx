import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import wisalMenuBanner from '../assets/wisal-admin-banner.png';

/** Only the open menu receives input; the keyboard receiver is cleared immediately. */
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
  const keyboardReceiver = useRef<HTMLInputElement>(null);

  const clearTemporaryInput = useCallback(() => {
    attempt.current++;
    clicks.current = 0;
    pin.current = '';
    if (keyboardReceiver.current) {
      keyboardReceiver.current.value = '';
      keyboardReceiver.current.blur();
    }
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
      // Focus synchronously inside the fifth user tap: iOS will not reliably
      // open its keyboard when focus is deferred to an effect or timer.
      if (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0) {
        const receiver = keyboardReceiver.current;
        if (receiver) {
          receiver.disabled = false;
          receiver.focus({ preventScroll: true });
        }
      }
    } else {
      clickTimer.current = setTimeout(() => { clicks.current = 0; }, 2000);
    }
  };

  const submit = useCallback(async () => {
      if (busy.current || Array.from(pin.current).length !== 6) return;
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
  }, [beginAdminPinAttempt, cancel, loginWithPin, navigate]);

  const receiveText = useCallback((text: string) => {
    if (!armed || busy.current) return;
    if (Date.now() >= deadline.current) { cancel(); return; }
    pin.current = Array.from(pin.current + text).slice(0, 6).join('');
    if (Array.from(pin.current).length === 6) void submit();
  }, [armed, cancel, submit]);

  useEffect(() => {
    if (!armed) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const printable = Array.from(event.key).length === 1;
      if (!printable && !['Backspace', 'Delete', 'Escape', 'Enter'].includes(event.key)) return;
      // Mobile keyboards/IME may emit only an input event (keydown can be
      // "Unidentified" or keyCode 229). Let the receiver handle printable text.
      if (printable && event.target === keyboardReceiver.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Escape') { cancel(); return; }
      if (busy.current || event.repeat) return;
      if (Date.now() >= deadline.current) { cancel(); return; }
      if (event.key === 'Backspace') pin.current = Array.from(pin.current).slice(0, -1).join('');
      else if (event.key === 'Delete') pin.current = '';
      else if (printable) receiveText(event.key);
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
  }, [armed, cancel, receiveText]);

  return <div className="relative flex w-full flex-col items-center gap-1 pb-1">
    <button type="button" aria-label="WISAL" onClick={handleClick}
      className="flex w-full items-center justify-center overflow-hidden rounded-lg border-0 bg-transparent p-0 shadow-none">
      <img src={wisalMenuBanner} width={1672} height={941}
        alt="" className="block h-auto w-[92%] rounded-lg border-0 object-contain shadow-none" draggable={false} />
    </button>
    {armed && <p className="text-center text-[11px] font-bold text-[var(--text-primary)]">وصال | كل الخدمات في مكان واحد</p>}
    <input ref={keyboardReceiver} data-keyboard-receiver type="text" inputMode="text"
      disabled={!armed} tabIndex={-1} aria-hidden="true" autoComplete="off"
      autoCapitalize="none" autoCorrect="off" spellCheck={false}
      style={{ position: 'absolute', left: 0, bottom: 0, width: 1, height: 1, opacity: 0,
        pointerEvents: 'none', caretColor: 'transparent', color: 'transparent',
        fontSize: 16, border: 0, padding: 0, outline: 'none' }}
      onInput={event => {
        const text = event.currentTarget.value;
        event.currentTarget.value = '';
        receiveText(text);
      }}
      onBeforeInput={event => {
        if ((event.nativeEvent as InputEvent).inputType === 'deleteContentBackward') {
          event.preventDefault();
          pin.current = Array.from(pin.current).slice(0, -1).join('');
        }
      }} />
  </div>;
}
