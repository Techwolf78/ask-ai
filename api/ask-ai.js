import Groq from "groq-sdk";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

// AI model for summarizing scraped content
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
const MODEL = "llama3-8b-8192";

// Direct Google search scraping (like Python's googlesearch)
async function fetchTopUrl(query) {
  try {
    console.log(`🔍 Searching Google for: "${query}"`);
    
    // Use Google search URL directly (like your friend's Python googlesearch)
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`;
    console.log(`🔗 Search URL: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    console.log(`📊 Google response status: ${response.status}`);
    
    if (!response.ok) {
      console.log("❌ Google search failed, trying fallback");
      return await fallbackSearch(query);
    }
    
    const html = await response.text();
    console.log(`📄 HTML length: ${html.length} characters`);
    console.log(`📄 HTML preview: ${html.substring(0, 500)}...`);
    
    const $ = cheerio.load(html);
    
    // Extract search results from Google (try multiple selectors)
    const results = [];
    
    // Try different Google selectors
    const selectors = [
      'div.g a[href^="http"]',
      '.g a[href^="http"]',
      'h3 a[href^="http"]',
      'a[href^="http"]:not([href*="google.com"])',
      '.yuRUbf a[href^="http"]'
    ];
    
    for (const selector of selectors) {
      console.log(`🔍 Trying selector: ${selector}`);
      
      $(selector).each((i, elem) => {
        if (i < 10) { // Get top 10 results
          const url = $(elem).attr('href');
          const title = $(elem).text() || $(elem).find('h3').text() || 'No title';
          
          if (url && !url.includes('google.com') && !url.includes('youtube.com')) {
            results.push({ url, title });
            console.log(`Google Result ${results.length}: ${url} - ${title}`);
          }
        }
      });
      
      if (results.length > 0) {
        console.log(`✅ Found ${results.length} results with selector: ${selector}`);
        break;
      }
    }
    
    console.log(`📊 Total found ${results.length} Google search results`);
    
    if (results.length === 0) {
      console.log("❌ No Google results - trying fallback method");
      // Let's save the HTML for debugging
      console.log(`🐛 Saving Google HTML for debugging (first 1000 chars):`);
      console.log(html.substring(0, 1000));
      return await fallbackSearch(query);
    }
    
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
      console.log(`📝 Using first Google result: ${firstResult}`);
      return firstResult;
    }
    
    console.log("❌ No usable Google search results found");
    return null;
  } catch (error) {
    console.error("❌ Google search error:", error);
    console.log("🔄 Trying fallback search method...");
    return await fallbackSearch(query);
  }
}

// Fallback search using multiple approaches
async function fallbackSearch(query) {
  try {
    console.log(`🦆 Fallback: Trying alternative search for: "${query}"`);
    
    // Try Bing search first
    console.log("🔍 Trying Bing search...");
    let bingResults = await tryBingSearch(query);
    if (bingResults) return bingResults;
    
    // Try DuckDuckGo
    console.log("🦆 Trying DuckDuckGo search...");
    let ddgResults = await tryDuckDuckGoSearch(query);
    if (ddgResults) return ddgResults;
    
    // If all fails, try known URLs for IIT Bombay
    console.log("🏫 Trying known educational URLs...");
    if (query.toLowerCase().includes('iit bombay') || query.toLowerCase().includes('iit mumbai')) {
      const knownUrls = [
        'https://www.iitb.ac.in/',
        'https://en.wikipedia.org/wiki/IIT_Bombay',
        'https://www.careers360.com/university/indian-institute-of-technology-iit-bombay-mumbai',
        'https://www.shiksha.com/university/iit-bombay-mumbai-3056'
      ];
      
      console.log("🎯 Using known IIT Bombay URLs");
      return knownUrls[0]; // Return the official website
    }
    
    return null;
  } catch (error) {
    console.error("❌ All fallback searches failed:", error);
    return null;
  }
}

// Try Bing search
async function tryBingSearch(query) {
  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    console.log(`🔗 Bing URL: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.log("❌ Bing search failed");
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Bing result selectors
    const results = [];
    $('.b_algo h2 a, .b_title a').each((i, elem) => {
      if (i < 5) {
        const url = $(elem).attr('href');
        if (url && url.startsWith('http') && !url.includes('bing.com')) {
          results.push(url);
          console.log(`Bing Result ${i + 1}: ${url}`);
        }
      }
    });
    
    if (results.length > 0) {
      console.log(`✅ Found ${results.length} Bing results`);
      return results[0];
    }
    
    return null;
  } catch (error) {
    console.error("❌ Bing search error:", error);
    return null;
  }
}

// Try DuckDuckGo search
async function tryDuckDuckGoSearch(query) {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    console.log(`🔗 DuckDuckGo URL: ${searchUrl}`);
    
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
    console.error("❌ DuckDuckGo search error:", error);
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

// Enhanced scraping with better content extraction
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
    
    // Remove unwanted elements
    $('script, style, noscript, nav, footer, header, .ad, .advertisement, iframe, form, button').remove();
    
    // Try to get main content with better selectors
    let text = '';
    
    // Priority order for content extraction
    const contentSelectors = [
      'main article',
      'main .content',
      'main',
      'article',
      '.content',
      '.post-content',
      '.entry-content',
      '#content',
      '.main-content',
      'body'
    ];
    
    for (const selector of contentSelectors) {
      const content = $(selector).text();
      if (content && content.length > 200) {
        text = content;
        console.log(`✅ Found content using selector: ${selector}`);
        break;
      }
    }
    
    // Clean the text
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

// AI summarization function
async function summarizeWithAI(content, query) {
  try {
    console.log("🤖 Starting AI summarization...");
    
    const prompt = `You are a helpful assistant that summarizes web content based on user queries.

User Query: "${query}"

Scraped Content:
${content.substring(0, 4000)} ${content.length > 4000 ? '...(content truncated)' : ''}

Please provide a clear, comprehensive summary that directly answers the user's query. Include:
1. Key facts and information relevant to the query
2. Important details from the content
3. Any statistics, dates, or specific data mentioned
4. A conclusion or key takeaway

Format your response in a clear, readable manner with proper headings and bullet points where appropriate.`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      model: MODEL,
      temperature: 0.3,
      max_tokens: 1500,
    });

    const summary = completion.choices[0]?.message?.content;
    console.log("✅ AI summarization completed");
    return summary;
  } catch (error) {
    console.error("❌ AI summarization error:", error);
    return null;
  }
}

// Format AI-summarized content for presentation
function formatAISummary(summary, rawContent, sourceUrl, prompt) {
  const response = `🤖 **AI Summary for: "${prompt}"**

${summary}

---
📊 **Source Information**
🔗 **URL**: ${sourceUrl}
📝 **Original Content Length**: ${rawContent.length} characters
⏰ **Processed on**: ${new Date().toLocaleString()}

*Note: This summary is AI-generated from scraped web content. For complete details, please visit the source URL.*`;

  return response;
}

// Format scraped content for presentation
function formatScrapedContent(content, sourceUrl, prompt) {
  let formattedContent = content
    .substring(0, 2000) // Limit to 2000 chars for readability
    .replace(/\s+/g, ' ')
    .trim();
  
  // Add basic formatting
  const response = `📝 **Web Search Results for: "${prompt}"**

${formattedContent}

---
🔗 **Source**: ${sourceUrl}
📊 **Content Length**: ${content.length} characters
⏰ **Scraped on**: ${new Date().toLocaleString()}

Note: This is raw web content without AI processing for maximum accuracy.`;

  return response;
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
        context = scraped;
        console.log("✅ Successfully scraped direct URL");
      } else {
        console.log("❌ Failed to scrape direct URL");
        return res.status(200).json({
          response: `❌ Could not access the website: ${prompt}\n\nPossible reasons:\n- Website is down\n- Access restricted\n- Invalid URL\n\nPlease check the URL and try again.`,
          sourceUrl: null,
          hasScrapedContent: false,
          scrapedContentLength: 0
        });
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
          context = scraped;
          console.log("✅ Successfully scraped search result");
          console.log(`Context length: ${context.length} characters`);
          console.log(`Context preview: ${context.substring(0, 200)}...`);
        } else {
          console.log("⚠️ Failed to scrape search result");
        }
      } else {
        console.log("⚠️ No reliable source found from search");
      }
      
      // If no content found from search, return helpful message
      if (!context) {
        return res.status(200).json({
          response: `❌ No reliable web sources found for: "${prompt}"\n\nSuggestions:\n- Try more specific search terms\n- Check spelling\n- Use official website URLs directly\n\nExample: Instead of "KL University NAAC", try "KL University NAAC accreditation status"`,
          sourceUrl: null,
          hasScrapedContent: false,
          scrapedContentLength: 0
        });
      }
    }

    // AI summarization of scraped content
    console.log("🤖 Starting AI summarization of scraped content");
    const aiSummary = await summarizeWithAI(context, prompt);
    
    let formattedResponse;
    if (aiSummary) {
      console.log("✅ AI summarization successful");
      formattedResponse = formatAISummary(aiSummary, context, sourceUrl, prompt);
    } else {
      console.log("⚠️ AI summarization failed, falling back to raw content");
      formattedResponse = formatScrapedContent(context, sourceUrl, prompt);
    }

    return res.status(200).json({ 
      response: formattedResponse,
      sourceUrl: sourceUrl,
      hasScrapedContent: true,
      scrapedContentLength: context.length,
      aiSummarized: aiSummary ? true : false
    });

  } catch (err) {
    console.error("❌ API Error:", err);
    return res.status(500).json({ 
      error: `❌ Server Error: ${err.message}`,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}