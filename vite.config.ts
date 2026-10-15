import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BASE: "/" for pages.dev/netlify, "/<repo>/" for GitHub Pages
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
});
