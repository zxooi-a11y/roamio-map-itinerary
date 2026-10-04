import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});
const TOAST_MS = 6000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list, { id, msg }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), TOAST_MS);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toasts.map((t) => (
        <div key={t.id} className="toast" role="alert">{t.msg}</div>
      ))}
    </ToastContext.Provider>
  );
}

/** Returns show(message): a short-lived message at the bottom of the screen. */
export const useToast = () => useContext(ToastContext);
