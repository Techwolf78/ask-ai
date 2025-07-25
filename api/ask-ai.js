import Groq from "groq-sdk";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

// Re-enable AI model for content summarization
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
const MODEL = "llama3-8b-8192";

// Enhanced search with multiple result attempts
async function searchAndScrapeRelevantContent(query, maxAttempts = 3) {
  try {
    console.log(`🔍 Searching for relevant content: "${query}"`);
    
    // Get search results
    const searchResults = await getMultipleSearchResults(query);
    
    if (!searchResults || searchResults.length === 0) {
      console.log("❌ No search results found");
      return { content: null, sourceUrl: null };
    }
    
    // Try scraping multiple results until we find relevant content
    for (let i = 0; i < Math.min(searchResults.length, maxAttempts); i++) {
      const url = searchResults[i];
      console.log(`🌐 Attempting to scrape result ${i + 1}: ${url}`);
      
      const scraped = await scrapeText(url);
      if (scraped && isRelevantContent(scraped, query)) {
        console.log(`✅ Found relevant content from result ${i + 1}`);
        return { content: scraped, sourceUrl: url };
      } else if (scraped) {
        console.log(`⚠️ Content from result ${i + 1} not relevant, trying next...`);
      } else {
        console.log(`❌ Failed to scrape result ${i + 1}, trying next...`);
      }
    }
    
    console.log("❌ No relevant content found from search results");
    return { content: null, sourceUrl: null };
  } catch (error) {
    console.error("❌ Search and scrape error:", error);
    return { content: null, sourceUrl: null };
  }
}

// Get multiple search results instead of just the first one
async function getMultipleSearchResults(query) {
  try {
    console.log(`🔍 Getting multiple search results for: "${query}"`);
    
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.log("❌ Google search failed, trying fallback");
      return await getFallbackSearchResults(query);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const results = [];
    const selectors = [
      'div.g a[href^="http"]',
      '.g a[href^="http"]', 
      'h3 a[href^="http"]',
      'a[href^="http"]:not([href*="google.com"])',
      '.yuRUbf a[href^="http"]'
    ];
    
    for (const selector of selectors) {
      $(selector).each((i, elem) => {
        if (results.length < 5) { // Get top 5 results
          const url = $(elem).attr('href');
          if (url && !url.includes('google.com') && !url.includes('youtube.com')) {
            results.push(url);
            console.log(`Search Result ${results.length}: ${url}`);
          }
        }
      });
      
      if (results.length > 0) break;
    }
    
    if (results.length === 0) {
      return await getFallbackSearchResults(query);
    }
    
    // Sort by priority domains
    const priorityDomains = [
      ".ac.in", ".edu.in", ".edu", ".gov.in", 
      "careers360.com", "shiksha.com", "collegedunia.com",
      "wikipedia.org", "iitb.ac.in", "naac.gov.in"
    ];
    
    const priorityResults = [];
    const regularResults = [];
    
    for (const url of results) {
      if (priorityDomains.some(domain => url.includes(domain))) {
        priorityResults.push(url);
      } else {
        regularResults.push(url);
      }
    }
    
    return [...priorityResults, ...regularResults];
  } catch (error) {
    console.error("❌ Multiple search results error:", error);
    return await getFallbackSearchResults(query);
  }
}

// Fallback search results
async function getFallbackSearchResults(query) {
  // Try known educational URLs first
  if (query.toLowerCase().includes('iit bombay') || query.toLowerCase().includes('iit mumbai')) {
    return [
      'https://www.iitb.ac.in/',
      'https://en.wikipedia.org/wiki/IIT_Bombay',
      'https://www.careers360.com/university/indian-institute-of-technology-iit-bombay-mumbai'
    ];
  }
  
  if (query.toLowerCase().includes('naac')) {
    return [
      'https://www.naac.gov.in/',
      'https://en.wikipedia.org/wiki/National_Assessment_and_Accreditation_Council'
    ];
  }
  
  return [];
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
    const priorityDomains = [
      ".ac.in", ".edu.in", ".edu", ".gov.in", 
      "careers360.com", "shiksha.com", "collegedunia.com",
      "wikipedia.org", "iitb.ac.in", "naac.gov.in"
    ];
    
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

// Enhanced content validation
function isRelevantContent(content, query) {
  const queryWords = query.toLowerCase().split(' ');
  const contentLower = content.toLowerCase();
  
  // Check if content contains at least 30% of query words
  const matchingWords = queryWords.filter(word => 
    word.length > 2 && contentLower.includes(word)
  );
  
  const relevanceScore = matchingWords.length / queryWords.length;
  console.log(`🎯 Relevance score: ${relevanceScore} (${matchingWords.length}/${queryWords.length})`);
  
  return relevanceScore >= 0.3; // At least 30% relevance
}

// AI-powered content summarization
async function summarizeContent(content, prompt, sourceUrl) {
  try {
    console.log("🤖 Processing content with AI...");
    
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant that summarizes web content accurately and concisely. 
          Focus on providing factual information related to the user's query. 
          Structure your response clearly with key points.
          If the content is not relevant to the query, say so clearly.`
        },
        {
          role: "user",
          content: `Please summarize this web content for the query: "${prompt}"

Web Content:
${content.substring(0, 4000)}

Source: ${sourceUrl}

Provide a clear, structured summary focusing on information relevant to the query.`
        }
      ],
      model: MODEL,
      temperature: 0.3,
      max_tokens: 1000,
    });

    const summary = completion.choices[0]?.message?.content;
    
    if (summary) {
      console.log("✅ AI summarization successful");
      return summary;
    } else {
      console.log("⚠️ AI returned empty response");
      return null;
    }
  } catch (error) {
    console.error("❌ AI summarization error:", error);
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
        context = scraped;
        console.log("✅ Successfully scraped direct URL");
        
        // Check relevance for direct URLs too
        if (!isRelevantContent(context, prompt)) {
          console.log("⚠️ Direct URL content may not be fully relevant to query");
          // Continue anyway since user provided specific URL
        }
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
      // Search for the topic and get relevant content
      console.log("🔍 Searching for topic...");
      console.log(`Query being searched: "${prompt}"`);
      
      const searchResult = await searchAndScrapeRelevantContent(prompt);
      
      if (searchResult.content) {
        context = searchResult.content;
        sourceUrl = searchResult.sourceUrl;
        console.log("✅ Successfully found relevant content");
        console.log(`Context length: ${context.length} characters`);
        console.log(`Source: ${sourceUrl}`);
      } else {
        console.log("⚠️ No relevant content found from search");
      }
      
      // If no content found from search, return helpful message
      if (!context) {
        return res.status(200).json({
          response: `❌ No reliable web sources found for: "${prompt}"\n\nSuggestions:\n- Try more specific search terms\n- Check spelling\n- Use official website URLs directly\n\nExample: Instead of "NAAC accreditation IIT Bombay", try "IIT Bombay NAAC grade rating official"`,
          sourceUrl: null,
          hasScrapedContent: false,
          scrapedContentLength: 0
        });
      }
    }

    // Process scraped content with AI summarization
    console.log("🤖 Processing content with AI...");
    const aiSummary = await summarizeContent(context, prompt, sourceUrl);
    
    let finalResponse;
    if (aiSummary) {
      finalResponse = `🤖 **AI Summary for: "${prompt}"**

${aiSummary}

---
🔗 **Source**: ${sourceUrl}
� **Original Content Length**: ${context.length} characters
⏰ **Processed on**: ${new Date().toLocaleString()}

Note: This summary is generated by AI from scraped web content.`;
    } else {
      // Fallback to formatted raw content if AI fails
      console.log("⚠️ AI processing failed, using formatted raw content");
      const formattedContent = context
        .substring(0, 2000)
        .replace(/\s+/g, ' ')
        .trim();
      
      finalResponse = `📝 **Web Search Results for: "${prompt}"**

${formattedContent}

---
🔗 **Source**: ${sourceUrl}
📊 **Content Length**: ${context.length} characters
⏰ **Scraped on**: ${new Date().toLocaleString()}

Note: This is raw web content (AI processing unavailable).`;
    }

    return res.status(200).json({ 
      response: finalResponse,
      sourceUrl: sourceUrl,
      hasScrapedContent: true,
      scrapedContentLength: context.length,
      aiProcessed: !!aiSummary
    });

  } catch (err) {
    console.error("❌ API Error:", err);
    return res.status(500).json({ 
      error: `❌ Server Error: ${err.message}`,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}