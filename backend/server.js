import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/ai', async (req, res) => {
  const { documentText, command } = req.body;
  if (!command) {
    return res.status(400).json({ error: 'command is required' });
  }

  const prompt = buildPrompt(documentText || '', command);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 120,
    });
    const suggestion = completion.choices[0].message.content.trim();
    res.json({ suggestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

function buildPrompt(text, command) {
  switch (command) {
    case 'summarize':
      return `Summarize the following text:\n\n${text}\n\nSummary:`;
    case 'expand':
      return `Expand on the following text:\n\n${text}\n\nExpansion:`;
    case 'rewrite':
      return `Rewrite the following text to improve clarity:\n\n${text}\n\nRewrite:`;
    case 'autocomplete':
    default:
      return `Continue the following text:\n\n${text}\n\nContinuation:`;
  }
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});