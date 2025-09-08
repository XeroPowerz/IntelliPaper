const provider = (process.env.MODEL_PROVIDER || 'openai').toLowerCase();

function getLLM(){
  if (provider === 'openai') return require('./providers/openai');
  // Future providers (anthropic, etc.)
  return require('./providers/openai');
}

module.exports = getLLM();

