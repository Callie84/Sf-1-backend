import request from 'supertest';
import express from 'express';

const app = express();
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

describe('Health endpoint', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
