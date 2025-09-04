import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/analyze', async (req, res) => {
  const { documentText, highlightedText, userQuery } = req.body;
  if (!highlightedText || !userQuery) {
    return res.status(400).json({ error: 'highlightedText and userQuery are required' });
  }
  try {
    const prompt = `You are assisting with document editing.\nDocument: "${documentText}"\nHighlighted: "${highlightedText}"\nUser asks: "${userQuery}"\nRespond with JSON {"response": <answer>, "suggestedEdit": <new text or null>}.`;
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
