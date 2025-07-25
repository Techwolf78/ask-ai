import Groq from "groq-sdk";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Helper function to determine if query needs web search
function needsWebSearch(prompt) {
  const webSearchKeywords = [
    'current', 'latest', 'recent', 'today', 'news', 'update', 'price',
    'university', 'college', 'admission', 'course', 'fee', 'ranking',
    'weather', 'stock', 'cryptocurrency', 'exchange rate',
    'what happened', 'breaking news', 'trending', '2024', '2025',
    'live', 'real-time', 'now', 'status', 'information about'
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  return webSearchKeywords.some(keyword => lowerPrompt.includes(keyword)) || 
         prompt.includes('?') || // Questions often need current info
         prompt.toLowerCase().includes('tell me about') ||
         prompt.toLowerCase().includes('what is') ||
         prompt.toLowerCase().includes('how to');
}

// Enhanced Google search with multiple fallbacks
async function fetchTopUrl(query) {
  try {
    console.log(`🔍 Searching for: "${query}"`);
    
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      return await fallbackSearch(query);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const results = [];
    const selectors = [
      'div.g a[href^="http"]',
      '.yuRUbf a[href^="http"]',
      'h3 a[href^="http"]',
      'a[href^="http"]:not([href*="google.com"])'
    ];
    
    for (const selector of selectors) {
      $(selector).each((i, elem) => {
        if (i < 10) {
          const url = $(elem).attr('href');
          const title = $(elem).text() || $(elem).find('h3').text() || 'No title';
          
          if (url && !url.includes('google.com') && !url.includes('youtube.com')) {
            results.push({ url, title });
          }
        }
      });
      
      if (results.length > 0) break;
    }
    
    if (results.length === 0) {
      return await fallbackSearch(query);
    }
    
    // Priority domains for reliable sources
    const priorityDomains = [
      "wikipedia.org", "britannica.com", ".edu", ".ac.in", ".edu.in", 
      "shiksha.com", "careers360.com", ".gov", ".org",
      "reuters.com", "bbc.com", "cnn.com", "bloomberg.com"
    ];
    
    for (const result of results) {
      if (result.url && priorityDomains.some(domain => result.url.includes(domain))) {
        console.log(`✅ Found priority source: ${result.url}`);
        return result.url;
      }
    }
    
    return results[0]?.url;
  } catch (error) {
    console.error("Search error:", error);
    return await fallbackSearch(query);
  }
}

async function fallbackSearch(query) {
  try {
    // Try Bing as fallback
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const results = [];
    $('.b_algo h2 a, .b_title a').each((i, elem) => {
      if (i < 5) {
        const url = $(elem).attr('href');
        if (url && url.startsWith('http') && !url.includes('bing.com')) {
          results.push(url);
        }
      }
    });
    
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error("Fallback search error:", error);
    return null;
  }
}

async function scrapeText(url) {
  try {
    console.log(`🌐 Accessing source: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, noscript, nav, footer, header, .ad, .advertisement, iframe, form, button').remove();
    
    let text = '';
    const contentSelectors = [
      'main article', 'main .content', 'main', 'article', '.content',
      '.post-content', '.entry-content', '#content', '.main-content', 'body'
    ];
    
    for (const selector of contentSelectors) {
      const content = $(selector).text();
      if (content && content.length > 200) {
        text = content;
        break;
      }
    }
    
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    return text.length > 100 ? text.substring(0, 4000) : null;
  } catch (error) {
    console.error("Content access error:", error);
    return null;
  }
}

export default async function handler(req, res) {
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
    let sourceUrl = null;

    // Check if we need to search for current information
    if (needsWebSearch(prompt)) {
      thinkingProcess = "I need to find the most current and accurate information for this query. Let me search for reliable sources and provide you with up-to-date details.";
      
      console.log("Searching for current information...");
      
      const searchUrl = await fetchTopUrl(prompt);
      if (searchUrl) {
        sourceUrl = searchUrl;
        thinkingProcess += `\n\nI found a reliable source with current information. Let me analyze the content and provide you with a comprehensive answer.`;
        
        const scrapedContent = await scrapeText(searchUrl);
        if (scrapedContent) {
          thinkingProcess += `\n\nPerfect! I've gathered the latest information and will now provide you with an accurate, well-structured response based on current data.`;
          
          enhancedPrompt += `Based on current information from a reliable source, please provide a comprehensive and professional answer to this question: "${prompt}"\n\n`;
          enhancedPrompt += `Current information available:\n${scrapedContent}\n\n`;
          enhancedPrompt += `Instructions:\n`;
          enhancedPrompt += `- Provide accurate, helpful information based on the source material\n`;
          enhancedPrompt += `- Structure your response clearly with proper formatting\n`;
          enhancedPrompt += `- Include relevant details and key points\n`;
          enhancedPrompt += `- Sound natural and professional, like a knowledgeable assistant\n`;
          enhancedPrompt += `- Don't mention that you searched the web or scraped content\n`;
          enhancedPrompt += `- Present the information as if it's from your knowledge base\n`;
          enhancedPrompt += `- If appropriate, mention that this is current/recent information\n`;
        } else {
          thinkingProcess += `\n\nI found a relevant source but need to work with my existing knowledge to provide the best answer possible.`;
          enhancedPrompt += `Please provide a comprehensive answer to: "${prompt}"\n\n`;
          enhancedPrompt += `Note: Provide the most accurate information available and mention if certain details might need verification from official sources.`;
        }
      } else {
        thinkingProcess += `\n\nI'll provide you with the best information from my knowledge base, though some details might benefit from checking official sources for the most current updates.`;
        enhancedPrompt += `Please provide a helpful and comprehensive answer to: "${prompt}"\n\n`;
        enhancedPrompt += `Note: For the most current information, you may want to check official websites or recent publications.`;
      }
    } else {
      // For general queries that don't need web search
      enhancedPrompt += `You are a helpful and knowledgeable AI assistant. Provide accurate, well-structured information.\n\nUser question: ${prompt}`;
    }

    const response = await groq.chat.completions.create({
      model: "deepseek-r1-distill-llama-70b",
      messages: [{ 
        role: 'user', 
        content: enhancedPrompt 
      }],
      max_tokens: 1500,
      temperature: 0.7,
    });

    let reply = response.choices[0].message.content;
    
    // Clean up any mentions of web scraping or searching
    reply = reply
      .replace(/based on.*?search/gi, '')
      .replace(/according to.*?website/gi, '')
      .replace(/from.*?scraped/gi, '')
      .replace(/web search.*?shows/gi, '');

    // Add subtle source reference only if we used web data
    if (sourceUrl && !reply.toLowerCase().includes('source')) {
      reply += `\n\n*For the most current updates, you may want to check official sources.*`;
    }

    // Format response with thinking process
    const finalResponse = thinkingProcess ? 
      `<think>${thinkingProcess}</think>\n\n${reply}` : 
      reply;

    return res.status(200).json({ 
      response: finalResponse,
      sourceUrl: sourceUrl 
    });

  } catch (err) {
    console.error("API Error:", err);
    
    // Fallback response that doesn't reveal technical errors
    const fallbackResponse = "I apologize, but I'm experiencing some technical difficulties at the moment. Please try asking your question again, or rephrase it slightly. I'm here to help!";
    
    return res.status(200).json({ 
      response: fallbackResponse
    });
  }
}