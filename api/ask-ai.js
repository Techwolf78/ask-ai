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
    
    // Priority domains (same as Python version)
    const priorityDomains = ["shiksha.com", "careers360.com", ".ac.in", ".edu.in", ".org", ".in", ".com"];
    
    for (const result of results) {
      if (result.url && priorityDomains.some(domain => result.url.includes(domain))) {
        return result.url;
      }
    }
    
    return results[0]?.url || null;
  } catch (error) {
    console.error("Search error:", error);
    return null;
  }
}

// Scrape text (same logic as Python BeautifulSoup version)
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
    
    // Remove unwanted elements (same as Python version)
    $('script, style, noscript').remove();
    
    // Get text content (equivalent to soup.get_text())
    const text = $('body').text()
      .replace(/\s+/g, ' ')
      .trim();
    
    return text;
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

    console.log("🔍 Searching and thinking...");
    
    const url = await fetchTopUrl(prompt);
    let context = "";
    let sourceUrl = null;

    if (url) {
      console.log(`🔗 Source: ${url}`);
      sourceUrl = url;
      const scraped = await scrapeText(url);
      
      if (scraped) {
        context = scraped.substring(0, 3000); // Use only first 3000 chars (same as Python)
        console.log("✅ Successfully scraped content");
      } else {
        console.log("⚠️ Failed to scrape content");
      }
    } else {
      console.log("⚠️ No reliable source found. Using only prompt.");
    }

    // Create prompt (same logic as Python version)
    let finalPrompt;
    if (context) {
      finalPrompt = `Give a brief and accurate description of the following topic based on this info:\n${context}`;
    } else {
      finalPrompt = `Give a short and clear explanation about: ${prompt}`;
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