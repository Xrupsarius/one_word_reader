import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';
import { ru as t } from '../i18n/ru';

export function Offline({ onUpdate }: { onUpdate(): void }) {
  const [ready, setReady] = useState(false);
  const [update, setUpdate] = useState(false);
  const [error, setError] = useState(false);
  const apply = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    apply.current = registerSW({
      onOfflineReady: () => setReady(true),
      onNeedRefresh: () => setUpdate(true),
      onRegisterError: () => setError(true),
    });
  }, []);
  if (!ready && !update && !error) return null;
  return (
    <aside className="offline" aria-label={t.appStatus}>
      {ready && <p role="status">{t.offlineReady}</p>}
      {error && <p role="status">{t.offlineError}</p>}
      {update && (
        <button
          onClick={() => {
            onUpdate();
            void apply.current?.(true);
          }}
        >
          {t.updateApp}
        </button>
      )}
    </aside>
  );
}
