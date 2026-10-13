import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

const EVENT = 'sv:toast';

/** Show a short confirmation message, e.g. after adding to cart. */
export function toast(message) {
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
  } catch {
    /* noop */
  }
}

export default function Toast() {
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let timer;
    const onToast = (e) => {
      setMsg({ text: e.detail, key: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2600);
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {msg && (
        <div className="toast" key={msg.key}>
          <CheckCircle2 size={18} aria-hidden="true" />
          {msg.text}
        </div>
      )}
    </div>
  );
}
