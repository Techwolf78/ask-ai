import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config(); // Load .env in Vercel environment

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  console.log("Incoming request:", req.method, req.body); // Debug log

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;
    if (!prompt) throw new Error("Prompt is required");

    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    const reply = chatCompletion.choices[0].message.content;
    return res.status(200).json({ response: reply });

  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ 
      error: err.message || 'Server error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}