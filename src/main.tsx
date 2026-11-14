import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { registerServiceWorker } from "./notifications/client";
// Listens for the browser's install events from the very first moment (they can fire before React mounts).
import "./pwa/install";
import "./styles/global.css";
import "./styles/dashboard.css";
import "./styles/art.css";

// The service worker makes the site an installable app that opens offline. Real builds only — on the dev server
// it's registered on demand (alerts) and never caches.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void registerServiceWorker());
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
