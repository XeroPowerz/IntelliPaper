import OpenAI from 'openai';
import { upsertEmbedding, searchEmbeddings } from './vectorStore.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function embedText(text) {
  const result = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return result.data[0].embedding;
}

export async function saveBlockEmbedding(blockId, text) {
  const embedding = await embedText(text);
  await upsertEmbedding(blockId, embedding);
}

export async function searchBlockEmbeddings(query, limit = 5) {
  const embedding = await embedText(query);
  return await searchEmbeddings(embedding, limit);
}
