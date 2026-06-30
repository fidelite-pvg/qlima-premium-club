import { useEffect, useState } from "react";

const STORAGE_KEY = "qlima-cookie-consent";

function loadConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConsent(analytics) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics, savedAt: Date.now() }));
}

function applyConsent(analytics) {
  if (typeof window.gtag !== "function") return;
  window.gtag("consent", "update", {
    analytics_storage: analytics ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [panel, setPanel] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(false);

  useEffect(() => {
    const stored = loadConsent();
    if (!stored) {
      setVisible(true);
    } else {
      applyConsent(stored.analytics);
    }
  }, []);

  const acceptAll = () => {
    saveConsent(true);
    applyConsent(true);
    setVisible(false);
    setPanel(false);
  };

  const refuseAll = () => {
    saveConsent(false);
    applyConsent(false);
    setVisible(false);
    setPanel(false);
  };

  const saveSelection = () => {
    saveConsent(analyticsChecked);
    applyConsent(analyticsChecked);
    setVisible(false);
    setPanel(false);
  };

  const openManager = () => {
    const stored = loadConsent();
    setAnalyticsChecked(stored?.analytics ?? false);
    setPanel(true);
    setVisible(true);
  };

  if (!visible) {
    return (
      <button
        className="cookie-manage-btn"
        onClick={openManager}
        aria-label="Gérer mes cookies"
      >
        🍪
      </button>
    );
  }

  return (
    <div className="cookie-overlay" role="dialog" aria-modal="true" aria-label="Gestion des cookies">
      <div className="cookie-banner">
        {!panel ? (
          <>
            <div className="cookie-banner-body">
              <p className="cookie-title">Ce site utilise des cookies.</p>
              <p className="cookie-desc">
                Nous utilisons Google Analytics pour mesurer l'audience de ce site de façon anonyme.
                Vous pouvez accepter ou refuser ces cookies. Votre choix est sauvegardé et modifiable à tout moment.
              </p>
            </div>
            <div className="cookie-banner-actions">
              <button className="cookie-btn cookie-btn-accept" onClick={acceptAll}>
                Tout accepter
              </button>
              <button className="cookie-btn cookie-btn-secondary" onClick={() => { setAnalyticsChecked(false); setPanel(true); }}>
                Personnaliser
              </button>
              <button className="cookie-btn cookie-btn-refuse" onClick={refuseAll}>
                Refuser
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="cookie-banner-body">
              <p className="cookie-title">Gérer mes préférences cookies</p>

              <div className="cookie-category">
                <div className="cookie-category-header">
                  <span>
                    <strong>Nécessaires</strong>
                    <span className="cookie-badge">Toujours actifs</span>
                  </span>
                  <span className="cookie-toggle cookie-toggle-locked" aria-disabled="true" />
                </div>
                <p className="cookie-category-desc">
                  Ces cookies sont indispensables au fonctionnement du site (session, authentification). Ils ne peuvent pas être désactivés.
                </p>
              </div>

              <div className="cookie-category">
                <div className="cookie-category-header">
                  <span>
                    <strong>Statistiques</strong>
                    <span className="cookie-badge cookie-badge-count">Google Analytics</span>
                  </span>
                  <label className="cookie-toggle-label">
                    <input
                      type="checkbox"
                      checked={analyticsChecked}
                      onChange={(e) => setAnalyticsChecked(e.target.checked)}
                    />
                    <span className="cookie-toggle-track" />
                  </label>
                </div>
                <p className="cookie-category-desc">
                  Nous permettent de mesurer l'audience du site de manière anonyme (pages visitées, durée de session). Ces données restent agrégées et ne permettent pas de vous identifier.
                </p>
              </div>
            </div>

            <div className="cookie-banner-actions">
              <button className="cookie-btn cookie-btn-accept" onClick={acceptAll}>
                Tout accepter
              </button>
              <button className="cookie-btn cookie-btn-secondary" onClick={saveSelection}>
                Enregistrer ma sélection
              </button>
              <button className="cookie-btn cookie-btn-refuse" onClick={refuseAll}>
                Tout refuser
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
