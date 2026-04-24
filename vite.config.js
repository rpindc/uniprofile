import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { app: "./app.html" },
      output: { entryFileNames: "assets/[name]-[hash].js", chunkFileNames: "assets/[name]-[hash].js", assetFileNames: "assets/[name]-[hash][extname]" }
    },
    outDir: "dist"
  }
})
