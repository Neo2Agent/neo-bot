import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@neo-bot/ui";
import { App } from "./App";
import { ConfirmProvider, ToastHost } from "./feedback";
import { bindVisualViewport } from "./viewport";
import "@neo-bot/ui/styles.css";
import "@neo-bot/ui/buddy.css";
import "./styles.css";

bindVisualViewport(document, window);

const root = document.getElementById("root");
if (!root) {
  throw new Error("missing #root");
}
createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <ConfirmProvider>
        <App />
        <ToastHost />
      </ConfirmProvider>
    </TooltipProvider>
  </StrictMode>,
);
