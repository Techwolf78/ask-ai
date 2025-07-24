import Groq from "groq-sdk";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import googlethis from "googlethis";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = "llama3-8b-8192"; // Using same model as your friend's Python code

// Fetch top URL from Google search (same logic as Python version)
async function fetchTopUrl(query) {
  try {
    console.log(`🔍 Searching Google for: "${query}"`);
    
    const options = {
      page: 0,
      safe: false,
      parse_ads: false,
      additional_params: {
        hl: 'en'
      }
    };
    
    const response = await googlethis.search(query, options);
    const results = response.results || [];
    
    console.log(`📊 Found ${results.length} search results`);
    
    // Priority domains (same as Python version)
    const priorityDomains = ["shiksha.com", "careers360.com", ".ac.in", ".edu.in", ".org", ".in", ".com"];
    
    // First, try to find priority domains
    for (const result of results) {
      if (result.url && priorityDomains.some(domain => result.url.includes(domain))) {
        console.log(`✅ Found priority domain: ${result.url}`);
        return result.url;
      }
    }
    
    // If no priority domain found, return first valid result
    const firstResult = results[0]?.url;
    if (firstResult) {
      console.log(`📝 Using first result: ${firstResult}`);
      return firstResult;
    }
    
    console.log("❌ No search results found");
    return null;
  } catch (error) {
    console.error("❌ Search error:", error);
    return null;
  }
}

// Check if input is a URL
function isUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Scrape text (same logic as Python BeautifulSoup version)
async function scrapeText(url) {
  try {
    console.log(`🌐 Scraping: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Remove unwanted elements (same as Python version)
    $('script, style, noscript, nav, footer, header, .ad, .advertisement').remove();
    
    // Try to get main content first, then fall back to body
    let text = $('main').text() || $('article').text() || $('.content').text() || $('body').text();
    
    // Clean the text (equivalent to soup.get_text())
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    if (text.length < 100) {
      console.log("⚠️ Very little content found");
      return null;
    }
    
    console.log(`✅ Scraped ${text.length} characters`);
    return text;
  } catch (error) {
    console.error("❌ Scraping error:", error);
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

    console.log("🔍 Processing request...");
    
    let url = null;
    let context = "";
    let sourceUrl = null;

    // Check if the prompt is a URL - if so, scrape it directly
    if (isUrl(prompt)) {
      console.log("🔗 Direct URL detected, scraping directly...");
      url = prompt;
      sourceUrl = url;
      const scraped = await scrapeText(url);
      
      if (scraped) {
        context = scraped.substring(0, 3000);
        console.log("✅ Successfully scraped direct URL");
      } else {
        console.log("❌ Failed to scrape direct URL");
      }
    } else {
      // Search for the topic first
      console.log("🔍 Searching for topic...");
      url = await fetchTopUrl(prompt);
      
      if (url) {
        console.log(`🔗 Found source: ${url}`);
        sourceUrl = url;
        const scraped = await scrapeText(url);
        
        if (scraped) {
          context = scraped.substring(0, 3000); // Use only first 3000 chars (same as Python)
          console.log("✅ Successfully scraped search result");
        } else {
          console.log("⚠️ Failed to scrape search result");
        }
      } else {
        console.log("⚠️ No reliable source found from search");
      }
    }

    // Create prompt (same logic as Python version)
    let finalPrompt;
    if (context) {
      if (isUrl(prompt)) {
        finalPrompt = `Based on the content from the website ${sourceUrl}, provide a comprehensive description of this organization/institution:\n\n${context}`;
      } else {
        finalPrompt = `Give a brief and accurate description of the following topic based on this info:\n${context}`;
      }
    } else {
      if (isUrl(prompt)) {
        finalPrompt = `I couldn't access the website ${prompt}. Please provide a general explanation about what might be found on this domain or suggest how the user can access this information.`;
      } else {
        finalPrompt = `Give a short and clear explanation about: ${prompt}`;
      }
    }

    // Call Groq API (same as Python version)
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that gives brief and accurate descriptions of topics or institutions."
        },
        {
          role: "user",
          content: finalPrompt
        }
      ],
      temperature: 0.4, // Same temperature as Python version
    });

    const reply = response.choices[0].message.content;
    
    // Add source if available
    const finalResponse = sourceUrl ? 
      `${reply}\n\n🔗 Source: ${sourceUrl}` : 
      reply;

    return res.status(200).json({ 
      response: finalResponse,
      sourceUrl: sourceUrl 
    });

  } catch (err) {
    console.error("❌ Groq API Error:", err);
    return res.status(500).json({ 
      error: `❌ Groq API Error: ${err.message}`,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}