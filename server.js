/**
 * Matchday AI — minimal proxy server.
 *
 * Purpose: keep the LLM API key server-side (in an environment variable /
 * .env file, never in the browser) instead of relying only on the
 * bring-your-own-key client-side flow. The browser calls POST /api/llm and
 * this server forwards the request to the configured OpenAI-compatible
 * endpoint, injecting the key itself.
 *
 * Run:
 *   npm install
 *   cp .env.example .env   # then fill in OPENAI_API_KEY
 *   npm start
 *   open http://localhost:3000
 */

const path = require('path');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

// Lets the frontend know whether the server has a key configured, without
// ever exposing the key itself.
app.get('/api/llm/status', (req, res) => {
  res.json({ configured: !!OPENAI_API_KEY, model: LLM_MODEL });
});

app.post('/api/llm', async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'Server has no LLM API key configured. Add OPENAI_API_KEY to a .env file and restart the server, or switch to Direct Browser mode in Settings.',
    });
  }

  const { messages, temperature } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Request body must include a messages array.' });
  }

  try {
    const upstream = await fetch(LLM_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        temperature: temperature != null ? temperature : 0.4,
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Upstream LLM error: ' + JSON.stringify(data).slice(0, 300) });
    }

    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) {
      return res.status(502).json({ error: 'LLM returned an empty response.' });
    }
    res.json({ content: content.trim() });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach LLM endpoint: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log('Matchday AI server running at http://localhost:' + PORT);
  console.log('LLM key configured server-side: ' + (OPENAI_API_KEY ? 'yes' : 'no (set OPENAI_API_KEY in .env)'));
});
