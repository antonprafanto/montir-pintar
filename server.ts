import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "50mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get('/api/config.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
      window.process = window.process || {};
      window.process.env = window.process.env || {};
      window.process.env.GEMINI_API_KEY = ${JSON.stringify(process.env.GEMINI_API_KEY || '')};
      window.process.env.GOOGLE_MAPS_PLATFORM_KEY = ${JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || '')};
    `);
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
