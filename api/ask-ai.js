import Groq from "groq-sdk";
import { search } from "googlesearch-api";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Updated model to use LLaMA3-8b as in your second example
const MODEL = "llama3-8b-8192";

// Enhanced web search detection with more keywords
function needsWebSearch(prompt) {
  const webSearchKeywords = [
    'current', 'latest', 'recent', 'today', 'news', 'update', 'price',
    'university', 'college', 'admission', 'course', 'fee', 'ranking',
    'weather', 'stock', 'cryptocurrency', 'exchange rate',
    'what happened', 'breaking news', 'trending',
    'when', 'where', 'who is', 'explain', 'describe' // Added from second example
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  return webSearchKeywords.some(keyword => lowerPrompt.includes(keyword));
}

// Combined URL fetching with both domain priorities
async function fetchTopUrl(query) {
  try {
    const searchOptions = {
      query,
      limit: 5,
    };
    
    const results = await search(searchOptions);
    
    // Combined priority domains from both versions
    const priorityDomains = [
      "shiksha.com", "careers360.com", ".ac.in", ".edu.in", 
      ".edu", ".org", ".in", ".com", // Added from second example
      "wikipedia.org", "britannica.com",
      "reuters.com", "bbc.com", "cnn.com"
    ];
    
    for (const result of results) {
      if (priorityDomains.some(domain => result.url.includes(domain))) {
        return result.url;
      }
    }
    
    return results[0]?.url || null;
  } catch (error) {
    console.error("Search error:", error);
    return null;
  }
}

// Enhanced scraping combining both approaches
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
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Combined removal of unwanted elements
    const unwantedSelectors = [
      'script', 'style', 'noscript', 'nav', 
      'footer', 'header', '.ad', '.advertisement',
      'iframe', 'form', 'button' // Added from second example
    ];
    
    unwantedSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    
    let content = document.body.textContent || '';
    
    // Enhanced cleaning
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .replace(/\[.*?\]/g, '') // Remove square brackets
      .replace(/\{.*?\}/g, '') // Remove curly braces
      .trim();
    
    return content.substring(0, 3000); // Reduced to 3000 chars as in second example
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
    let thinkingProcess = "";

    if (needsWebSearch(prompt)) {
      thinkingProcess = "This query seems to require current or specific information. Searching the web...";
      
      const searchUrl = await fetchTopUrl(prompt);
      if (searchUrl) {
        sourceUrl = searchUrl;
        const scrapedContent = await scrapeText(searchUrl);
        
        if (scrapedContent) {
          thinkingProcess += `\nFound relevant information from ${searchUrl}`;
          
          // Updated prompt format combining both approaches
          enhancedPrompt += `You are an AI assistant that provides brief and accurate descriptions. 
                            Based on this information from ${sourceUrl}:\n\n${scrapedContent}\n\n
                            Please provide a concise answer to: ${prompt}\n
                            Keep response under 300 words and mention the source.`;
        } else {
          thinkingProcess += `\nCouldn't extract content from source. Using general knowledge.`;
          enhancedPrompt += `Provide a short and clear explanation about: ${prompt}`;
        }
      } else {
        thinkingProcess += `\nNo reliable sources found. Using general knowledge.`;
        enhancedPrompt += `Provide a short and clear explanation about: ${prompt}`;
      }
    } else {
      // For general knowledge questions
      enhancedPrompt += `You are a helpful AI assistant. Provide a concise answer to: ${prompt}`;
    }

    const response = await groq.chat.completions.create({
      model: MODEL, // Using LLaMA3-8b as in second example
      messages: [{
         role: 'system',
         content: 'You are a helpful assistant that gives brief and accurate descriptions.'
       },{
         role: 'user',
         content: enhancedPrompt
       }],
      temperature: 0.4, // Lower temperature as in second example for more focused answers
      max_tokens: 800,  // Reduced from 1200 to match concise style
    });

    let reply = response.choices[0].message.content;
    
    // Enhanced source attribution
    if (sourceUrl) {
      reply += `\n\n[Source: ${sourceUrl}]`;
    }

    const finalResponse = thinkingProcess ? 
      `<think>${thinkingProcess}</think>\n\n${reply}` : 
      reply;

    return res.status(200).json({ 
      response: finalResponse,
      sourceUrl: sourceUrl 
    });
  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ 
      error: "Sorry, I encountered an error. Please try again.",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}