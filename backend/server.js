import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data', 'documentSchema.json');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get('/api/document', async (req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load document' });
  }
});

app.post('/api/document', async (req, res) => {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save document' });
  }
});

// Return layout hints such as page size and margin classes.
// The current implementation is a placeholder that simply echoes
// default values. In a real system this would analyze the document
// structure to determine appropriate layout instructions.
app.post('/api/layout', (req, res) => {
  try {
    const { document } = req.body || {};
    // Basic example hints; ignore document for now.
    res.json({
      pageHeight: 1056,
      pageGap: 32,
      marginClass: 'p-10',
      pageBreaks: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process layout hints' });
  }
});

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

// Stream AI-generated edits for a given instruction and selection.
// The client sends the user's instruction along with the currently
// selected text. The endpoint streams back the revised text which can
// be applied on the client to update the document model.
app.post('/api/commands', async (req, res) => {
  const { instruction, selectedText = '' } = req.body || {};
  if (!instruction) {
    return res.status(400).json({ error: 'instruction is required' });
  }

  const prompt = `You are a helpful document editor. The user has selected the following text:\n\n${selectedText}\n\nInstruction: ${instruction}\n\nReturn the updated selection text:`;

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const part of stream) {
      const token = part.choices[0]?.delta?.content || '';
      if (token) {
        res.write(token);
      }
    }

    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Command processing failed' });
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
