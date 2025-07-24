import Groq from "groq-sdk";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Enhanced web search detection with more keywords
function needsWebSearch(prompt) {
  const webSearchKeywords = [
    'current', 'latest', 'recent', 'today', 'news', 'update', 'price',
    'university', 'college', 'admission', 'course', 'fee', 'ranking',
    'weather', 'stock', 'cryptocurrency', 'exchange rate',
    'what happened', 'breaking news', 'trending',
    'when', 'where', 'who is', 'explain', 'describe'
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  return webSearchKeywords.some(keyword => lowerPrompt.includes(keyword));
}

// Simple search using DuckDuckGo (free, no API key needed)
async function searchWeb(query) {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract first few search results
    const results = [];
    $('.result__url').each((i, elem) => {
      if (i < 3) { // Get top 3 results
        const url = $(elem).text().trim();
        if (url.startsWith('http')) {
          results.push(url);
        }
      }
    });
    
    return results[0] || null; // Return first result
  } catch (error) {
    console.error("Search error:", error);
    return null;
  }
}

// Enhanced scraping with cheerio
async function scrapeText(url) {
  try {
    const response = await fetch(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, noscript, nav, footer, header, .ad, .advertisement, iframe, form, button').remove();
    
    // Extract main content
    let content = $('main').text() || $('article').text() || $('body').text() || '';
    
    // Clean the content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    return content.substring(0, 3000); // Limit to 3000 chars
  } catch (error) {
    console.error("Scraping error:", error);
    return null;
  }
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
    let sourceUrl = null;

    if (needsWebSearch(prompt)) {
      const searchUrl = await searchWeb(prompt);
      if (searchUrl) {
        sourceUrl = searchUrl;
        const scrapedContent = await scrapeText(searchUrl);
        
        if (scrapedContent) {
          enhancedPrompt += `Based on this information from ${sourceUrl}:\n\n${scrapedContent}\n\n
                            Please provide a concise answer to: ${prompt}\n
                            Keep response under 300 words and mention the source.`;
        } else {
          enhancedPrompt += `Provide a short and clear explanation about: ${prompt}`;
        }
      } else {
        enhancedPrompt += `Provide a short and clear explanation about: ${prompt}`;
      }
    } else {
      // For general knowledge questions
      enhancedPrompt += `You are a helpful AI assistant. Provide a concise answer to: ${prompt}`;
    }

    const response = await groq.chat.completions.create({
      model: "deepseek-r1-distill-llama-70b", // Latest DeepSeek R1 reasoning model with 2024 training data
      messages: [{ role: 'user', content: enhancedPrompt }],
      max_tokens: 1000,
      temperature: 0.7,
    });

    let reply = response.choices[0].message.content;
    
    // Add source if available
    if (sourceUrl) {
      reply += `\n\n[Source: ${sourceUrl}]`;
    }

    return res.status(200).json({ 
      response: reply,
      sourceUrl: sourceUrl 
    });

  } catch (err) {
    console.error("Groq API Error:", err);
    return res.status(500).json({ 
      error: err.message || 'Server error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}