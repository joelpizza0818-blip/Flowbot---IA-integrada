import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para procesar JSON en el cuerpo de las peticiones
app.use(express.json());

// Servir archivos estáticos desde la carpeta 'dist'
app.use(express.static(path.join(__dirname, 'dist')));

// Proxy para la API de Gemini (Mantiene la API KEY segura en el servidor)
app.post('/api/flowbot-proxy', async (req, res) => {
  const { userMessage, systemPrompt } = req.body;
  const API_KEY = process.env.VITE_GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'System error: API Key not configured on server.' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Gemini API Error');

    res.json(data);
  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Manejar todas las rutas enviando el index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 FlowBot Server running on http://localhost:${PORT}`);
});
