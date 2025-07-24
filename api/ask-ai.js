import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Predefined reliable sources for common queries
const reliableSources = {
  'university': ['shiksha.com', 'careers360.com'],
  'weather': ['weather.com', 'timeanddate.com'],
  'news': ['reuters.com', 'bbc.com'],
  'crypto': ['coinmarketcap.com', 'coingecko.com'],
  'stock': ['yahoo.com/finance', 'bloomberg.com']
};

function needsWebSearch(prompt) {
  const webSearchKeywords = [
    'current', 'latest', 'recent', 'today', 'news', 'update', 'price',
    'university', 'college', 'admission', 'ranking',
    'weather', 'stock', 'cryptocurrency', 'trending', '2024', '2025'
  ];
  
  return webSearchKeywords.some(keyword => 
    prompt.toLowerCase().includes(keyword)
  );
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
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

    const currentDate = new Date().toLocaleDateString();
    let enhancedPrompt = `Current date: ${currentDate}\n\n`;
    let thinkingProcess = "";

    // Check if we need to search the web
    if (needsWebSearch(prompt)) {
      thinkingProcess = "🔍 This query seems to require current information. Let me analyze what I know and provide the most accurate response possible.\n\nSince I don't have real-time web access, I'll provide information based on my training data and note any limitations regarding current information.";
      
      enhancedPrompt += `This question appears to require current information: "${prompt}"\n\n`;
      enhancedPrompt += `Please provide the most accurate answer you can, and clearly note if the information might be outdated or if real-time data would be more appropriate. Suggest reliable sources where the user can find current information.`;
    } else {
      enhancedPrompt += `You are a helpful AI assistant. Provide accurate, helpful information.\n\nUser question: ${prompt}`;
    }

    const response = await groq.chat.completions.create({
      model: "deepseek-r1-distill-llama-70b",
      messages: [{ 
        role: 'user', 
        content: enhancedPrompt 
      }],
      max_tokens: 1200,
      temperature: 0.7,
    });

    let reply = response.choices[0].message.content;

    // Format response with thinking process
    const finalResponse = thinkingProcess ? 
      `<think>${thinkingProcess}</think>\n\n${reply}` : 
      reply;

    return res.status(200).json({ 
      response: finalResponse
    });

  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ 
      error: err.message || 'Server error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}