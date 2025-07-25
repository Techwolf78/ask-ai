import Groq from "groq-sdk";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

// AI model for summarizing scraped content (conditional)
let groq = null;
const MODEL = "llama3-8b-8192";

// Initialize Groq only if API key is available
try {
  if (process.env.GROQ_API_KEY) {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
    console.log("✅ Groq AI initialized successfully");
  } else {
    console.log("⚠️ No GROQ_API_KEY found - AI summarization will be disabled");
  }
} catch (error) {
  console.log("⚠️ Failed to initialize Groq AI:", error.message);
}

// Get multiple URLs from different search engines for better success rate
async function fetchMultipleUrls(query) {
  console.log(`🔍 Multi-search for: "${query}"`);
  const allUrls = [];
  
  try {
    // Try Google first (might be blocked but worth trying)
    console.log("🔍 Trying Google search...");
    const googleUrls = await fetchGoogleUrls(query);
    if (googleUrls && googleUrls.length > 0) {
      allUrls.push(...googleUrls);
      console.log(`✅ Google found ${googleUrls.length} URLs`);
    }
  } catch (error) {
    console.log("❌ Google search failed:", error.message);
  }
  
  try {
    // Try DuckDuckGo (most reliable)
    console.log("🦆 Trying DuckDuckGo search...");
    const ddgUrls = await getDuckDuckGoUrls(query);
    if (ddgUrls && ddgUrls.length > 0) {
      allUrls.push(...ddgUrls);
      console.log(`✅ DuckDuckGo found ${ddgUrls.length} URLs`);
    }
  } catch (error) {
    console.log("❌ DuckDuckGo search failed:", error.message);
  }
  
  try {
    // Try Bing as backup
    console.log("🔍 Trying Bing search...");
    const bingUrls = await getBingUrls(query);
    if (bingUrls && bingUrls.length > 0) {
      allUrls.push(...bingUrls);
      console.log(`✅ Bing found ${bingUrls.length} URLs`);
    }
  } catch (error) {
    console.log("❌ Bing search failed:", error.message);
  }
  
  // Remove duplicates and prioritize
  const uniqueUrls = [...new Set(allUrls)];
  const prioritizedUrls = prioritizeUrls(uniqueUrls);
  
  console.log(`🔗 Total unique URLs found: ${prioritizedUrls.length}`);
  prioritizedUrls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
  
  return prioritizedUrls;
}

// Extract URLs from Google search (updated from existing function)
async function fetchGoogleUrls(query) {
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      return [];
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
        if (i < 10) {
          const url = $(elem).attr('href');
          if (url && !url.includes('google.com') && !url.includes('youtube.com')) {
            results.push(url);
          }
        }
      });
      
      if (results.length > 0) break;
    }
    
    return results;
  } catch (error) {
    console.error("❌ Google URL extraction error:", error);
    return [];
  }
}

// Extract URLs from DuckDuckGo search
async function getDuckDuckGoUrls(query) {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return [];
    
    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];
    
    $('.result__url').each((i, elem) => {
      if (i < 10) {
        let url = $(elem).text().trim();
        if (url && !url.startsWith('http')) {
          url = 'https://' + url;
        }
        if (url.startsWith('http')) {
          results.push(url);
        }
      }
    });
    
    return results;
  } catch (error) {
    console.error("❌ DuckDuckGo URL extraction error:", error);
    return [];
  }
}

// Extract URLs from Bing search
async function getBingUrls(query) {
  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return [];
    
    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];
    
    $('.b_algo h2 a, .b_title a').each((i, elem) => {
      if (i < 10) {
        const url = $(elem).attr('href');
        if (url && url.startsWith('http') && !url.includes('bing.com')) {
          results.push(url);
        }
      }
    });
    
    // Filter out non-English domains
    const blacklistedDomains = ['baidu.com', 'zhidao.baidu.com', 'tieba.baidu.com', 'qq.com', 'weibo.com'];
    return results.filter(url => !blacklistedDomains.some(domain => url.includes(domain)));
  } catch (error) {
    console.error("❌ Bing URL extraction error:", error);
    return [];
  }
}

// Prioritize URLs based on educational relevance and accessibility
function prioritizeUrls(urls) {
  const priorityDomains = [
    // Government and official educational sites (highest priority)
    { domain: ".gov.in", weight: 100 },
    { domain: ".ac.in", weight: 95 },
    { domain: ".edu.in", weight: 90 },
    { domain: ".edu", weight: 85 },
    { domain: "aicte-india.org", weight: 85 },
    { domain: "ugc.ac.in", weight: 85 },
    { domain: "nic.in", weight: 80 },
    
    // IIT/NIT official sites
    { domain: "iit", weight: 90 },
    { domain: "nit", weight: 85 },
    { domain: "iisc", weight: 90 },
    { domain: "aiims", weight: 85 },
    
    // Reliable educational portals
    { domain: "careers360.com", weight: 75 },
    { domain: "shiksha.com", weight: 70 },
    { domain: "collegedunia.com", weight: 65 },
    { domain: "getmyuni.com", weight: 60 },
    { domain: "collegesearch.in", weight: 60 },
    { domain: "exams360.com", weight: 60 },
    { domain: "iquanta.in", weight: 55 },
    
    // Wikipedia and news sources
    { domain: "wikipedia.org", weight: 80 },
    { domain: "en.wikipedia.org", weight: 80 },
    { domain: "timesofindia.indiatimes.com", weight: 50 },
    { domain: "indianexpress.com", weight: 50 },
    
    // General domains (.in preference for Indian education)
    { domain: ".in", weight: 40 },
    { domain: ".org", weight: 35 },
    { domain: ".com", weight: 30 }
  ];
  
  // Score each URL
  const scoredUrls = urls.map(url => {
    let score = 0;
    for (const priority of priorityDomains) {
      if (url.includes(priority.domain)) {
        score = Math.max(score, priority.weight);
      }
    }
    
    // Penalize known problematic domains
    const problematicDomains = ['collegepravesh.com', 'studyiq.com'];
    if (problematicDomains.some(domain => url.includes(domain))) {
      score = Math.max(0, score - 50);
    }
    
    return { url, score };
  });
  
  // Sort by score (highest first) and return URLs
  return scoredUrls
    .sort((a, b) => b.score - a.score)
    .map(item => item.url);
}

// Direct Google search scraping (keep existing function for compatibility)
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
    
    // Priority domains for educational content
    const priorityDomains = [
      "shiksha.com", "careers360.com", "collegedunia.com", 
      "getmyuni.com", "collegesearch.in", "exams360.com",
      ".ac.in", ".edu.in", ".org", ".edu", "aicte-india.org",
      "ugc.ac.in", "nic.in", "gov.in", "aiims", "iit", "nit"
    ];
    
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
    if (ddgResults) {
      // If DuckDuckGo returns multiple URLs, try each one
      if (Array.isArray(ddgResults)) {
        for (const ddgUrl of ddgResults) {
          console.log(`🔄 Trying DuckDuckGo URL: ${ddgUrl}`);
          const scraped = await scrapeText(ddgUrl);
          if (scraped) {
            console.log(`✅ Successfully scraped DuckDuckGo URL: ${ddgUrl}`);
            return ddgUrl;
          }
        }
        console.log("❌ All DuckDuckGo URLs failed to scrape");
      } else {
        // Single URL returned
        return ddgResults;
      }
    }
    
    // If all fails, try known URLs for various queries
    console.log("🏫 Trying known educational URLs...");
    
    if (query.toLowerCase().includes('iit bombay') || query.toLowerCase().includes('iit mumbai')) {
      const knownUrls = [
        'https://www.iitb.ac.in/',
        'https://en.wikipedia.org/wiki/IIT_Bombay',
        'https://www.careers360.com/university/indian-institute-of-technology-iit-bombay-mumbai',
        'https://www.shiksha.com/university/iit-bombay-mumbai-3056'
      ];
      console.log("🎯 Using known IIT Bombay URLs");
      return knownUrls[0];
    }
    
    if (query.toLowerCase().includes('iit delhi')) {
      const knownUrls = [
        'https://home.iitd.ac.in/',
        'https://en.wikipedia.org/wiki/IIT_Delhi',
        'https://www.careers360.com/university/indian-institute-of-technology-iit-delhi',
        'https://www.shiksha.com/university/iit-delhi-new-delhi-3055'
      ];
      console.log("🎯 Using known IIT Delhi URLs");
      return knownUrls[0];
    }
    
    if (query.toLowerCase().includes('jee') && (query.toLowerCase().includes('cutoff') || query.toLowerCase().includes('2025'))) {
      const knownUrls = [
        'https://en.wikipedia.org/wiki/Joint_Entrance_Examination',
        'https://www.careers360.com/articles/jee-advanced-cutoff',
        'https://www.shiksha.com/engineering/articles/jee-advanced-cutoff-blogId-33826',
        'https://www.collegedunia.com/exams/jee-advanced/cutoff'
      ];
      console.log("🎯 Using known JEE cutoff URLs");
      return knownUrls[0];
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
      if (i < 10) { // Get more results for better filtering
        const url = $(elem).attr('href');
        if (url && url.startsWith('http') && !url.includes('bing.com')) {
          results.push(url);
          console.log(`Bing Result ${i + 1}: ${url}`);
        }
      }
    });
    
    if (results.length === 0) {
      console.log("❌ No Bing results found");
      return null;
    }
    
    console.log(`✅ Found ${results.length} Bing results`);
    
    // Filter out non-English or problematic domains
    const blacklistedDomains = ['baidu.com', 'zhidao.baidu.com', 'tieba.baidu.com', 'qq.com', 'weibo.com'];
    const englishResults = results.filter(url => {
      return !blacklistedDomains.some(domain => url.includes(domain));
    });
    
    if (englishResults.length === 0) {
      console.log("❌ No English/accessible results found");
      return null;
    }
    
    // Priority domains for educational content
    const priorityDomains = [
      "shiksha.com", "careers360.com", "collegedunia.com", 
      "getmyuni.com", "collegesearch.in", "exams360.com",
      ".ac.in", ".edu.in", ".org", ".edu", "aicte-india.org",
      "ugc.ac.in", "nic.in", "gov.in", "aiims", "iit", "nit",
      "wikipedia.org", "news", "times"
    ];
    
    for (const url of englishResults) {
      if (priorityDomains.some(domain => url.includes(domain))) {
        console.log(`✅ Found priority domain via Bing: ${url}`);
        return url;
      }
    }
    
    console.log(`📝 Using first filtered Bing result: ${englishResults[0]}`);
    return englishResults[0];
    
  } catch (error) {
    console.error("❌ Bing search error:", error);
    return null;
  }
}

// Try DuckDuckGo search and return multiple promising URLs
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
    
    // Priority domains for educational content
    const priorityDomains = [
      "shiksha.com", "careers360.com", "collegedunia.com", 
      "getmyuni.com", "collegesearch.in", "exams360.com",
      ".ac.in", ".edu.in", ".org", ".edu", "aicte-india.org",
      "ugc.ac.in", "nic.in", "gov.in", "aiims", "iit", "nit",
      ".in", ".com"
    ];
    
    // Return all priority URLs, not just the first one
    const priorityUrls = [];
    for (const url of results) {
      if (priorityDomains.some(domain => url.includes(domain))) {
        priorityUrls.push(url);
        console.log(`✅ Found priority domain via DuckDuckGo: ${url}`);
      }
    }
    
    if (priorityUrls.length > 0) {
      return priorityUrls; // Return array of promising URLs
    }
    
    console.log(`📝 Using first DuckDuckGo result: ${results[0]}`);
    return results[0];
    
  } catch (error) {
    console.error("❌ DuckDuckGo search error:", error);
    return null;
  }
}

// Get alternative URLs for educational content
function getAlternativeUrls(query) {
  const alternatives = [];
  const lowerQuery = query.toLowerCase();
  
  // IIT-related queries
  if (lowerQuery.includes('iit')) {
    if (lowerQuery.includes('delhi')) {
      alternatives.push(
        'https://en.wikipedia.org/wiki/IIT_Delhi',
        'https://www.careers360.com/university/indian-institute-of-technology-iit-delhi',
        'https://www.shiksha.com/university/iit-delhi-new-delhi-3055'
      );
    } else if (lowerQuery.includes('bombay') || lowerQuery.includes('mumbai')) {
      alternatives.push(
        'https://en.wikipedia.org/wiki/IIT_Bombay',
        'https://www.careers360.com/university/indian-institute-of-technology-iit-bombay-mumbai',
        'https://www.shiksha.com/university/iit-bombay-mumbai-3056'
      );
    } else {
      alternatives.push(
        'https://en.wikipedia.org/wiki/Indian_Institutes_of_Technology',
        'https://www.careers360.com/colleges/list-of-iit-colleges-in-india',
        'https://www.shiksha.com/engineering/colleges/engineering-colleges-india'
      );
    }
  }
  
  // JEE-related queries
  if (lowerQuery.includes('jee')) {
    alternatives.push(
      'https://en.wikipedia.org/wiki/Joint_Entrance_Examination',
      'https://www.careers360.com/exams/jee-advanced',
      'https://www.shiksha.com/engineering/articles/jee-advanced-cutoff-blogId-33826'
    );
    
    if (lowerQuery.includes('cutoff')) {
      alternatives.push(
        'https://www.careers360.com/articles/jee-advanced-cutoff',
        'https://www.collegedunia.com/exams/jee-advanced/cutoff'
      );
    }
  }
  
  // General educational queries
  if (lowerQuery.includes('admission') || lowerQuery.includes('cutoff')) {
    alternatives.push(
      'https://www.careers360.com/',
      'https://www.shiksha.com/',
      'https://www.collegedunia.com/'
    );
  }
  
  return alternatives;
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

// Enhanced scraping with better content extraction and retry logic
async function scrapeText(url) {
  try {
    console.log(`🌐 Scraping: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    // Better headers to avoid blocks
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: headers
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      
      // If 403, try alternative approach
      if (response.status === 403) {
        console.log("🔄 403 error - trying with simpler headers...");
        
        const simpleResponse = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
          }
        });
        
        if (simpleResponse.ok) {
          const html = await simpleResponse.text();
          return extractContentFromHtml(html);
        }
      }
      
      return null;
    }
    
    const html = await response.text();
    return extractContentFromHtml(html);
    
  } catch (error) {
    console.error("❌ Scraping error:", error);
    return null;
  }
}

// Extract content from HTML
function extractContentFromHtml(html) {
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
}

// AI summarization function
async function summarizeWithAI(content, query) {
  try {
    if (!groq) {
      console.log("❌ Groq AI not initialized - skipping AI summarization");
      return null;
    }

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
      
      // Search for URLs and try multiple sources
      const searchResults = await fetchMultipleUrls(prompt);
      console.log(`Search found ${searchResults.length} potential URLs`);
      
      if (searchResults.length > 0) {
        // Try each URL until we successfully scrape one
        for (const searchUrl of searchResults) {
          console.log(`🔗 Trying source: ${searchUrl}`);
          const scraped = await scrapeText(searchUrl);
          
          if (scraped) {
            context = scraped;
            sourceUrl = searchUrl;
            url = searchUrl;
            console.log("✅ Successfully scraped search result");
            console.log(`Context length: ${context.length} characters`);
            console.log(`Context preview: ${context.substring(0, 200)}...`);
            break;
          } else {
            console.log(`⚠️ Failed to scrape: ${searchUrl}, trying next URL...`);
          }
        }
        
        // If no search results worked, try known alternatives
        if (!context) {
          console.log("⚠️ All search results failed, trying alternative sources...");
          
          const alternatives = await getAlternativeUrls(prompt);
          for (const altUrl of alternatives) {
            console.log(`🔄 Trying alternative: ${altUrl}`);
            const altScraped = await scrapeText(altUrl);
            if (altScraped) {
              context = altScraped;
              sourceUrl = altUrl;
              url = altUrl;
              console.log("✅ Successfully scraped alternative source");
              break;
            }
          }
        }
      } else {
        console.log("⚠️ No URLs found from search, trying known URLs...");
        
        // If no URL from search, try known educational URLs directly
        const alternatives = await getAlternativeUrls(prompt);
        for (const altUrl of alternatives) {
          console.log(`🔄 Trying known URL: ${altUrl}`);
          const altScraped = await scrapeText(altUrl);
          if (altScraped) {
            context = altScraped;
            sourceUrl = altUrl;
            url = altUrl;
            console.log("✅ Successfully scraped known URL");
            break;
          }
        }
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