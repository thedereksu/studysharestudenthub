import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Service Worker update detection and auto-reload
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    // Check for updates every 30 seconds
    setInterval(() => {
      registration.update();
    }, 30000);

    // Listen for new Service Worker waiting
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // New service worker is ready, skip waiting and reload
            newWorker.postMessage({ type: "SKIP_WAITING" });
            // Reload after a short delay to ensure the new SW takes over
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }
        });
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
