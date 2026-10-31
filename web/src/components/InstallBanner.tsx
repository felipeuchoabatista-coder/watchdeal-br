import { useEffect, useState } from 'react';
import { Icon } from './Icon.tsx';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'wd:install-dispensado';

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Convite para instalar o app: botão nativo no Android/Chrome, instruções no iPhone. */
export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (dismissed || isStandalone()) return null;
  const ios = isIos();
  if (!promptEvent && !ios) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignora */
    }
  };

  return (
    <aside className="install" aria-label="Instalar o app">
      <Icon name="download" size={22} />
      <div className="install__text">
        <b>Instale o WatchDeal no celular</b>
        {ios ? (
          <span>No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</span>
        ) : (
          <span>Abre em tela cheia, como um app, direto da tela inicial.</span>
        )}
      </div>
      {promptEvent && (
        <button
          type="button"
          className="btn btn--primary"
          onClick={async () => {
            await promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            if (choice.outcome === 'accepted') dismiss();
            setPromptEvent(null);
          }}
        >
          Instalar
        </button>
      )}
      <button type="button" className="install__close" onClick={dismiss} aria-label="Dispensar">×</button>
    </aside>
  );
}
