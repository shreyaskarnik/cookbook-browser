import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  build: { target: "esnext", chunkSizeWarningLimit: 4000 },
  worker: { format: "es" },
});
