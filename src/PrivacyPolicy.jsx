import { Link } from "react-router-dom";
import "./App.css";

export default function PrivacyPolicy() {
  return (
    <div className="page">
      <section className="hero-shell" style={{ paddingBottom: 80 }}>
        <div className="hero-brandbar">
          <Link to="/" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            ← Retour au site
          </Link>
        </div>

        <img src="/qlima-logo.png" alt="Qlima" className="hero-logo" />

        <div className="hero-shape">
          <h1>Politique de confidentialité</h1>
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
                  Le site peut utiliser des cookies ou des outils d’analyse pour mesurer
                  l’audience et améliorer l’expérience utilisateur. Leur utilisation est
                  réalisée dans le respect du cadre réglementaire applicable, notamment en
                  matière de consentement.
                </p>
              </div>

              <div className="feature-card">
                <h3>6. Coordonnées</h3>
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
