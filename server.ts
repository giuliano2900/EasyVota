import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware per il parsing del JSON
  app.use(express.json());

  // =========================================================================
  // SIMULAZIONE FUNZIONI CLOUDFLARE (Solo per l'ambiente di sviluppo locale)
  // =========================================================================
  app.post("/api/generate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY non è configurata nelle variabili d'ambiente.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const { prompt } = req.body;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Errore API Generate:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // =========================================================================
  // CONFIGURAZIONE VITE (Frontend)
  // =========================================================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
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
