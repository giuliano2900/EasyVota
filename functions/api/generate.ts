import { GoogleGenAI } from "@google/genai";

// Questa è la funzione serverless per Cloudflare Pages
// Verrà eseguita sull'infrastruttura edge di Cloudflare quando chiami /api/generate
export async function onRequestPost(context: any) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const prompt = body.prompt;

    // Inizializza Gemini usando la chiave segreta salvata nelle variabili d'ambiente di Cloudflare
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return new Response(JSON.stringify({ text: response.text }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
