import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import PrivacyPolicy from "./PrivacyPolicy.jsx";
import CookieConsent from "./CookieConsent.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      </Routes>
      <CookieConsent />
    </BrowserRouter>
  </StrictMode>,
);
