import express from 'express';
import cors from 'cors';
import { readFile } from 'fs/promises';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let documents = {};
try {
  const data = await readFile(new URL('./data/documents.json', import.meta.url), 'utf-8');
  documents = JSON.parse(data);
} catch (err) {
  console.error('Could not load documents:', err);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/analyze', async (req, res) => {
  const { documentId, highlightedText, query } = req.body;
  if (!highlightedText || !query) {
    return res.status(400).json({ error: 'highlightedText and query are required' });
  }
  try {
    const prompt = `You are assisting with document editing. The user highlighted: "${highlightedText}". They ask: "${query}". Respond with JSON {"response": <answer>, "suggestedEdit": <new text or null>}.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }]
    });
    let ai = completion.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(ai);
    } catch (e) {
      parsed = { response: ai, suggestedEdit: null };
    }
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
