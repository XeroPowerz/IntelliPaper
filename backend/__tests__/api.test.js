import request from 'supertest';
import { promises as fs } from 'fs';

const mockCreate = jest.fn(params => {
  if (params.stream) {
    return {
      [Symbol.asyncIterator]: async function* () {
        yield { choices: [{ delta: { content: 'Hello' } }] };
        yield { choices: [{ delta: { content: ' World' } }] };
      },
    };
  }
  return {
    choices: [{ message: { content: 'Mock suggestion' } }],
  };
});

await jest.unstable_mockModule('openai', () => ({
  default: function () {
    return { chat: { completions: { create: mockCreate } } };
  },
}));

const { app, server } = await import('../server.js');

afterAll(() => {
  server.close();
});

describe('/api/document', () => {
  it('returns document content', async () => {
    const data = { hello: 'world' };
    const readSpy = jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify(data));
    const res = await request(app).get('/api/document');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(data);
    readSpy.mockRestore();
  });

  it('saves document content', async () => {
    const writeSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue();
    const payload = { foo: 'bar' };
    const res = await request(app).post('/api/document').send(payload);
    expect(res.status).toBe(200);
    expect(writeSpy).toHaveBeenCalledWith(expect.any(String), JSON.stringify(payload, null, 2));
    writeSpy.mockRestore();
  });
});

describe('/api/plugins/:plugin/:action', () => {
  it('invokes plugin action', async () => {
    const res = await request(app)
      .post('/api/plugins/uppercase/shout')
      .send({ text: 'hello' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: 'HELLO' });
  });
});

describe('OpenAI dependent endpoints', () => {
  it('/api/ai returns suggestion', async () => {
    const res = await request(app)
      .post('/api/ai')
      .send({ documentText: 'text', command: 'summarize' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suggestion: 'Mock suggestion' });
  });

  it('/api/commands streams response', async () => {
    const res = await request(app)
      .post('/api/commands')
      .send({ instruction: 'do', selectedText: 'test' });
    expect(res.status).toBe(200);
    expect(res.text).toBe('Hello World');
  });
});
