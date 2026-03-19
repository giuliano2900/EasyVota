// Questa è la funzione serverless per Cloudflare Pages
// Verrà eseguita sull'infrastruttura edge di Cloudflare quando chiami /api/generate
export async function onRequestPost(context: any) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const prompt = body.prompt;

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key missing in Cloudflare" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Usiamo fetch nativo invece dell'SDK per garantire la compatibilità al 100% 
    // con l'ambiente Edge di Cloudflare (che non supporta tutte le librerie Node.js)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      throw new Error(data.error?.message || "Errore dall'API di Gemini");
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(JSON.stringify({ text }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
