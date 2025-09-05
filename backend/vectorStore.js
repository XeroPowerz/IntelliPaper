import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function init() {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS block_embeddings (
        block_id TEXT PRIMARY KEY,
        embedding vector(1536)
      )
    `);
  } catch (err) {
    console.error('Failed to initialize vector store', err);
  }
}

init();

function toPgVector(arr) {
  return `[${arr.join(',')}]`;
}

export async function upsertEmbedding(blockId, embedding) {
  const vector = toPgVector(embedding);
  await pool.query(
    `INSERT INTO block_embeddings (block_id, embedding)
     VALUES ($1, $2::vector)
     ON CONFLICT (block_id) DO UPDATE SET embedding = $2::vector`,
    [blockId, vector]
  );
}

export async function searchEmbeddings(embedding, limit = 5) {
  const vector = toPgVector(embedding);
  const { rows } = await pool.query(
    `SELECT block_id, embedding <-> $1::vector AS distance
     FROM block_embeddings
     ORDER BY embedding <-> $1::vector
     LIMIT $2`,
    [vector, limit]
  );
  return rows;
}

export default pool;
