import "./App.css";

export default function PrivacyPolicy() {
  return (
    <div className="page">
      <section className="hero-shell" style={{ paddingBottom: 80 }}>
        <a href="https://fidelite.qlima.fr" style={{ position: "static" }}>
          <img src="/qlima-logo.png" alt="Qlima" className="hero-logo" />
        </a>

        <div className="hero-shape">
          <h1 style={{ fontSize: "clamp(22px, 4.5vw, 42px)" }}>Politique de<br />confidentialité</h1>
          <p>Qlima Premium Club</p>
        </div>

        <div className="hero-content" style={{ gridTemplateColumns: "1fr", maxWidth: 980 }}>
          <div className="intro-card" style={{ padding: 32 }}>
            <h2>Protection des données personnelles</h2>
            <p>
              Cette politique de confidentialité explique comment Qlima collecte, utilise,
              stocke et protège les données personnelles des utilisateurs du site Qlima
              Premium Club.
            </p>

            <div className="feature-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="feature-card">
                <h3>1. Données collectées</h3>
                <p>
                  Nous collectons les informations nécessaires à la création de compte,
                  à la gestion du programme de fidélité et au traitement des demandes de
                  points ou de récompenses, telles que le prénom, le nom, l’adresse
                  e-mail, le numéro de téléphone, l’adresse postale, les informations de
                  connexion, les justificatifs fournis et les données de navigation, le cas
                  échéant.
                </p>
              </div>

              <div className="feature-card">
                <h3>2. Finalités du traitement</h3>
                <p>
                  Les données sont utilisées pour gérer les comptes utilisateurs, permettre
                  l’accès au programme de fidélité, traiter les demandes de points et de
                  récompenses, vérifier les justificatifs transmis, améliorer le site et
                  répondre aux obligations légales applicables.
                </p>
              </div>

              <div className="feature-card">
                <h3>3. Stockage et hébergement</h3>
                <p>
                  Les données sont stockées dans l’infrastructure de Supabase, avec un choix
                  de région cohérent avec l’Union européenne. Les documents joints (factures,
                  tickets de caisse, RIB, etc.) sont également stockés dans cet
                  environnement.
                </p>
              </div>

              <div className="feature-card">
                <h3>4. Droits des utilisateurs</h3>
                <p>
                  Conformément au Règlement général sur la protection des données, chaque
                  utilisateur peut exercer ses droits d’accès, de rectification, d’effacement,
                  d’opposition, de limitation, de portabilité et de retrait du consentement,
                  le cas échéant. Pour toute demande, vous pouvez nous contacter à
                  contact@pvg.eu.
                </p>
              </div>

              <div className="feature-card">
                <h3>5. Cookies et outils de mesure</h3>
                <p>
                  Ce site utilise deux types de cookies :
                </p>
                <p style={{ marginTop: 10 }}>
                  <strong>Cookies nécessaires (toujours actifs)</strong><br />
                  Des cookies de session sont déposés pour assurer votre authentification et
                  maintenir votre connexion à votre espace fidélité. Ces cookies expirent
                  à la fin de votre session ou au plus tard après 7 jours. Ils ne peuvent
                  pas être refusés car ils sont strictement nécessaires au fonctionnement
                  du service.
                </p>
                <p style={{ marginTop: 10 }}>
                  <strong>Cookies de statistiques (soumis à consentement)</strong><br />
                  Avec votre accord, Google Analytics mesure l’audience du site de façon
                  anonyme. Les données collectées (pages visitées, durée de session) sont
                  agrégées et ne permettent pas de vous identifier personnellement.
                  Ces cookies ont une durée de vie de 13 mois. Vous pouvez accepter ou
                  refuser leur dépôt via la bannière affichée lors de votre première visite,
                  et modifier votre choix à tout moment via le bouton 🍪 présent en bas
                  à gauche de chaque page.
                </p>
              </div>

              <div className="feature-card">
                <h3>6. Transferts de données hors Union européenne</h3>
                <p>
                  Google Analytics transfère certaines données vers des serveurs situés aux
                  États-Unis. Ces transferts sont encadrés par le cadre de protection des
                  données UE–États-Unis (EU-US Data Privacy Framework), auquel Google LLC a
                  adhéré, conformément à la décision d’adéquation de la Commission européenne
                  du 10 juillet 2023. L’adresse IP est anonymisée avant tout traitement.
                </p>
                <p style={{ marginTop: 10 }}>
                  Supabase héberge les données dans l’Union européenne (région West EU).
                  Aucun transfert vers des pays tiers n’est effectué pour le stockage
                  des données personnelles.
                </p>
              </div>

              <div className="feature-card">
                <h3>7. Coordonnées</h3>
                <p>
                  Qlima<br />
                  200 Avenue de la Mare Sansoure<br />
                  Immeuble B2<br />
                  76650 Petit-Couronne<br />
                  E-mail : contact@pvg.eu
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
