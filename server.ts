import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { analyzeVehicleImagesBackend } from "./src/server/geminiService.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  app.post("/api/gemini", async (req, res) => {
    try {
      const { images, manualHistory } = req.body;
      const result = await analyzeVehicleImagesBackend(images, manualHistory);
      res.json(result);
    } catch (e: any) {
      console.error("Backend Error:", e);
      let errorMsg = e.message;
      if (typeof errorMsg === 'string' && (errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("400"))) {
        errorMsg = "API Key tidak valid! Jika Anda baru saja mengubahnya di menu Secrets, coba muat ulang halamannya. Jika tetap error saat di-\"Share\", pastikan Anda menggunakan mode Free Tier.";
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // ESM compatibility
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
