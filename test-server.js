import express from 'express';
import handler from './api/ask-ai.js';

const app = express();
app.use(express.json());

// Wrapper to convert Vercel handler to Express
app.post('/api/ask-ai', async (req, res) => {
  // Mock Vercel's req/res objects
  const mockReq = {
    method: 'POST',
    body: req.body
  };
  
  const mockRes = {
    status: (code) => ({
      json: (data) => res.status(code).json(data),
      end: () => res.status(code).end()
    }),
    json: (data) => res.json(data),
    setHeader: (name, value) => res.setHeader(name, value)
  };
  
  await handler(mockReq, mockRes);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Test server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/ask-ai`);
});
