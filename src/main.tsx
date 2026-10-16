import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";

const rootEl = document.getElementById("root")!;

// Show any crash on screen instead of a blank page
const showError = (msg: string) => {
  rootEl.innerHTML = "";
  const pre = document.createElement("pre");
  pre.style.cssText = "padding:16px;white-space:pre-wrap;color:#dc2626";
  pre.textContent = "Error: " + msg;
  rootEl.appendChild(pre);
};
window.addEventListener("error", (e) => showError(e.message));
window.addEventListener("unhandledrejection", (e) => showError(String(e.reason)));

try {
  createRoot(rootEl).render(<App />);
} catch (e) {
  showError(String(e));
}
