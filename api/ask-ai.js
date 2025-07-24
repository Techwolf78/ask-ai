import Together from "together-ai";

const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY, // Add this to your Vercel environment variables
});

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    // Enhanced prompt with current context
    const currentDate = new Date().toLocaleDateString();
    const enhancedPrompt = `Current date: ${currentDate}

You are a helpful AI assistant. Provide accurate, helpful, and up-to-date information.
If you don't have recent information about something, mention your knowledge cutoff.

User question: ${prompt}`;

    const response = await together.chat.completions.create({
      model: "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo", // High-quality model
      messages: [{ role: 'user', content: enhancedPrompt }],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const reply = response.choices[0].message.content;
    return res.status(200).json({ response: reply });

  } catch (err) {
    console.error("Together AI API Error:", err);
    return res.status(500).json({ 
      error: err.message || 'Server error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}
