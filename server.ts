import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware per il parsing del JSON
  app.use(express.json());

  // Configurazione Nodemailer
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // =========================================================================
  // API EMAIL
  // =========================================================================
  app.post("/api/send-pin", async (req, res) => {
    const { email, pin, electionTitle, appUrl } = req.body;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(503).json({ 
        error: "Servizio email non configurato. Configura SMTP_USER e SMTP_PASS nelle variabili d'ambiente." 
      });
    }

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: `Il tuo PIN per la votazione: ${electionTitle}`,
        text: `Ciao,\n\nEcco il tuo PIN personale e segreto per partecipare alla votazione "${electionTitle}".\n\nIl tuo PIN è: ${pin}\n\nVai su ${appUrl || process.env.APP_URL || 'http://localhost:3000'} per esprimere il tuo voto.\n\nGrazie.`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #4f46e5;">Votazione Condominiale</h2>
            <p>Ciao,</p>
            <p>Ecco il tuo PIN personale e segreto per partecipare alla votazione <strong>"${electionTitle}"</strong>.</p>
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1e293b;">${pin}</span>
            </div>
            <p>Puoi esprimere il tuo voto visitando il seguente link:</p>
            <p><a href="${appUrl || process.env.APP_URL || 'http://localhost:3000'}" style="color: #4f46e5; text-decoration: underline;">${appUrl || process.env.APP_URL || 'http://localhost:3000'}</a></p>
            <p style="font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              Questo è un messaggio automatico, per favore non rispondere.
            </p>
          </div>
        `,
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Errore invio email:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/send-pins-batch", async (req, res) => {
    const { pins, electionTitle, appUrl } = req.body;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(503).json({ 
        error: "Servizio email non configurato. Configura SMTP_USER e SMTP_PASS nelle variabili d'ambiente." 
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Invio sequenziale per evitare di essere bloccati come spam
    for (const item of pins) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: item.email,
          subject: `Il tuo PIN per la votazione: ${electionTitle}`,
          text: `Ciao,\n\nEcco il tuo PIN personale e segreto per partecipare alla votazione "${electionTitle}".\n\nIl tuo PIN è: ${item.pin}\n\nVai su ${appUrl || process.env.APP_URL || 'http://localhost:3000'} per esprimere il tuo voto.\n\nGrazie.`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #4f46e5;">Votazione Condominiale</h2>
              <p>Ciao,</p>
              <p>Ecco il tuo PIN personale e segreto per partecipare alla votazione <strong>"${electionTitle}"</strong>.</p>
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1e293b;">${item.pin}</span>
              </div>
              <p>Puoi esprimere il tuo voto visitando il seguente link:</p>
              <p><a href="${appUrl || process.env.APP_URL || 'http://localhost:3000'}" style="color: #4f46e5; text-decoration: underline;">${appUrl || process.env.APP_URL || 'http://localhost:3000'}</a></p>
              <p style="font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                Questo è un messaggio automatico, per favore non rispondere.
              </p>
            </div>
          `,
        });
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${item.email}: ${error.message}`);
      }
    }

    res.json(results);
  });

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
