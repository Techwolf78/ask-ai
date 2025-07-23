import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Add your custom responses here
const CUSTOM_ANSWERS = {
  account: "For account help, email support@yourdomain.com or visit /account-help",
  pricing: "See plans at /pricing",
  // Add more as needed
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  
  const { prompt } = req.body;
  const lowerPrompt = prompt.toLowerCase();

  // Check custom responses first
  for (const [keyword, response] of Object.entries(CUSTOM_ANSWERS)) {
    if (lowerPrompt.includes(keyword)) {
      return res.status(200).json({ 
        response,
        is_custom: true 
      });
    }
  }

  // Default AI response
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }]
    });
    
    return res.status(200).json({
      response: completion.choices[0].message.content,
      is_custom: false
    });
    
  } catch (error) {
    return res.status(500).json({ error: "AI service error" });
  }
}