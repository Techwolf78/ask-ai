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
    console.log("📊 Raw search response:", JSON.stringify(response, null, 2));
    
    const results = response.results || [];
    console.log(`📊 Found ${results.length} search results`);
    
    if (results.length === 0) {
      console.log("❌ No search results - trying fallback method");
      return await fallbackSearch(query);
    }
    
    // Log all found URLs for debugging
    results.forEach((result, index) => {
      console.log(`Result ${index + 1}: ${result.url || 'No URL'} - ${result.title || 'No title'}`);
    });
    
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
    
    console.log("❌ No usable search results found");
    return null;
  } catch (error) {
    console.error("❌ Search error:", error);
    console.log("🔄 Trying fallback search method...");
    return await fallbackSearch(query);
  }
}

// Fallback search using DuckDuckGo
async function fallbackSearch(query) {
  try {
    console.log(`🦆 Fallback: Searching DuckDuckGo for: "${query}"`);
    
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.log("❌ DuckDuckGo search failed");
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract search results from DuckDuckGo
    const results = [];
    $('.result__url').each((i, elem) => {
      if (i < 5) { // Get top 5 results
        let url = $(elem).text().trim();
        if (url && !url.startsWith('http')) {
          url = 'https://' + url;
        }
        if (url.startsWith('http')) {
          results.push(url);
          console.log(`DuckDuckGo Result ${i + 1}: ${url}`);
        }
      }
    });
    
    if (results.length === 0) {
      console.log("❌ No DuckDuckGo results found");
      return null;
    }
    
    // Priority domains
    const priorityDomains = ["shiksha.com", "careers360.com", ".ac.in", ".edu.in", ".org", ".in", ".com"];
    
    for (const url of results) {
      if (priorityDomains.some(domain => url.includes(domain))) {
        console.log(`✅ Found priority domain via DuckDuckGo: ${url}`);
        return url;
      }
    }
    
    console.log(`📝 Using first DuckDuckGo result: ${results[0]}`);
    return results[0];
    
  } catch (error) {
    console.error("❌ Fallback search error:", error);
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
      console.log(`Query being searched: "${prompt}"`);
      
      url = await fetchTopUrl(prompt);
      console.log(`Search result URL: ${url}`);
      
      if (url) {
        console.log(`🔗 Found source: ${url}`);
        sourceUrl = url;
        const scraped = await scrapeText(url);
        
        if (scraped) {
          context = scraped.substring(0, 3000); // Use only first 3000 chars (same as Python)
          console.log("✅ Successfully scraped search result");
          console.log(`Context length: ${context.length} characters`);
          console.log(`Context preview: ${context.substring(0, 200)}...`);
        } else {
          console.log("⚠️ Failed to scrape search result");
        }
      } else {
        console.log("⚠️ No reliable source found from search");
      }
    }

    // Create prompt (same logic as Python version)
    let finalPrompt;
    let systemMessage;
    
    if (context) {
      console.log("📝 Using scraped content for response");
      
      if (isUrl(prompt)) {
        systemMessage = "You are an assistant that ONLY uses the provided website content. Do NOT use your training data. Base your response EXCLUSIVELY on the content provided below.";
        finalPrompt = `IMPORTANT: Use ONLY the content from this website. Do NOT use your general knowledge about this organization.

Website: ${sourceUrl}
Content: ${context}

Based EXCLUSIVELY on the above website content, provide a comprehensive description of this organization/institution. If the content doesn't contain enough information, say so clearly.`;
      } else {
        systemMessage = "You are an assistant that ONLY uses the provided web search content. Do NOT use your training data. Base your response EXCLUSIVELY on the information provided below.";
        finalPrompt = `IMPORTANT: Use ONLY the web search content provided below. Do NOT use your general knowledge.

Topic: ${prompt}
Web Content: ${context}

Based EXCLUSIVELY on the above content, provide a brief and accurate description. If the content doesn't contain enough information about the topic, say so clearly and mention what information is missing.`;
      }
    } else {
      console.log("⚠️ No scraped content - using general knowledge");
      
      if (isUrl(prompt)) {
        systemMessage = "You are a helpful assistant.";
        finalPrompt = `I couldn't access the website ${prompt}. Please provide a general explanation about what might be found on this domain or suggest how the user can access this information.`;
      } else {
        systemMessage = "You are a helpful assistant.";
        finalPrompt = `Give a short and clear explanation about: ${prompt}`;
      }
    }

    // Call Groq API (same as Python version)
    console.log("🤖 Calling Groq API...");
    console.log(`System message: ${systemMessage}`);
    console.log(`Final prompt preview: ${finalPrompt.substring(0, 300)}...`);
    
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: finalPrompt
        }
      ],
      temperature: 0.4, // Same temperature as Python version
    });

    const reply = response.choices[0].message.content;
    console.log(`✅ Got AI response: ${reply.length} characters`);
    
    // Add debug info to response
    let debugInfo = "";
    if (context) {
      debugInfo = `\n\n📊 Debug Info: Used ${context.length} characters of scraped content from web search.`;
    } else {
      debugInfo = `\n\n📊 Debug Info: No web content found - used general AI knowledge.`;
    }
    
    // Add source if available
    const finalResponse = sourceUrl ? 
      `${reply}\n\n🔗 Source: ${sourceUrl}${debugInfo}` : 
      `${reply}${debugInfo}`;

    return res.status(200).json({ 
      response: finalResponse,
      sourceUrl: sourceUrl,
      hasScrapedContent: !!context,
      scrapedContentLength: context ? context.length : 0
    });

  } catch (err) {
    console.error("❌ Groq API Error:", err);
    return res.status(500).json({ 
      error: `❌ Groq API Error: ${err.message}`,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}