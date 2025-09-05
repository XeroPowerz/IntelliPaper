import OpenAI from 'openai';

export default function(register) {
  const apiKey = process.env.OPENAI_API_KEY;
  const openai = apiKey ? new OpenAI({ apiKey }) : null;

  register({
    name: 'tutor',
    actions: {
      explain: {
        description: 'Provide step-by-step explanations and quiz questions',
        handler: async ({ text = '' }) => {
          if (!text.trim()) return { steps: [], quiz: [] };

          // Fallback simple explanation if OpenAI is not configured
          if (!openai) {
            const sentences = text
              .split(/\.\s+/)
              .filter(Boolean)
              .map(s => s.trim());
            const steps = sentences.map((s, i) => `${i + 1}. ${s}`);
            return { steps, quiz: [] };
          }

          const prompt = `You are a patient tutor. Explain the following text in clear, numbered steps. Then provide up to three short quiz questions about the material. Respond in JSON with keys "steps" (array of strings) and "quiz" (array of strings).\n\nText:\n${text}\n\nJSON:`;

          try {
            const completion = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 300,
            });
            const content = completion.choices[0].message.content.trim();
            try {
              return JSON.parse(content);
            } catch {
              // If parsing fails, return the raw content as a single step
              return { steps: [content], quiz: [] };
            }
          } catch (err) {
            console.error(err);
            const sentences = text
              .split(/\.\s+/)
              .filter(Boolean)
              .map(s => s.trim());
            const steps = sentences.map((s, i) => `${i + 1}. ${s}`);
            return { steps, quiz: [] };
          }
        },
      },
    },
  });
}
