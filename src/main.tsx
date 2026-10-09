import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App";
import { ToastProvider } from "./components/ui/Toast";

if (import.meta.env.DEV) {
  const inspectorUrl = "/wf-inspector.js";
  import(/* @vite-ignore */ inspectorUrl);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
