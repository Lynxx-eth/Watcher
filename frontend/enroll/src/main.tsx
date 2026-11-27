import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@watcher/ui";
import { EnrollPage } from "./EnrollPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EnrollPage />
  </StrictMode>,
);
