// Simple local test server
import express from 'express';
import handler from './api/ask-ai.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Simulate Vercel's request/response structure
app.post('/api/ask-ai', (req, res) => {
  handler(req, res);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 Test endpoint: http://localhost:${PORT}/api/ask-ai`);
});
