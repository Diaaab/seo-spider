// scraper.js
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

// Configuration
const CONFIG = {
  urlsFile: 'urls.txt',
  outputDir: 'data',
  publicDir: 'public',
  concurrency: 3,
  timeout: 30000,
  retries: 2
};

// Googlebot User Agent
const GOOGLEBOT_UA = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// Scrape a single page
async function scrapePage(page, url, retryCount = 0) {
  try {
    console.log(`Scraping: ${url} (attempt ${retryCount + 1})`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.timeout
    });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract SEO data
    const seoData = await page.evaluate(() => {
      const result = {
        url: window.location.href,
        metaTitle: { en: '', ar: '' },
        metaDesc: { en: '', ar: '' },
        h1: { en: '', ar: '' },
        introText: { en: '', ar: '' },
        timestamp: new Date().toISOString()
      };
      
      // Extract H1 (English)
      const h1Element = document.querySelector('.SeoComponents_seoMetaTags__5b_Dl h1');
      if (h1Element) {
        result.h1.en = h1Element.textContent.trim();
      }
      
      // Extract intro text (English)
      const introElement = document.querySelector('#intro_copy');
      if (introElement) {
        result.introText.en = introElement.textContent.trim();
      }
      
      // Extract meta title
      const titleElement = document.querySelector('title');
      if (titleElement) {
        result.metaTitle.en = titleElement.textContent.trim();
      }
      
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle && ogTitle.content) {
        result.metaTitle.en = ogTitle.content;
      }
      
      // Extract meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && metaDesc.content) {
        result.metaDesc.en = metaDesc.content;
      }
      
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc && ogDesc.content) {
        result.metaDesc.en = ogDesc.content;
      }
      
      // Try to extract Arabic versions
      const metaTitleAr = document.querySelector('meta[property="og:title:ar"]');
      if (metaTitleAr && metaTitleAr.content) {
        result.metaTitle.ar = metaTitleAr.content;
      }
      
      const metaDescAr = document.querySelector('meta[name="description:ar"]');
      if (metaDescAr && metaDescAr.content) {
        result.metaDesc.ar = metaDescAr.content;
      }
      
      // Extract structured data
      const ldJsonScript = document.querySelector('script[id="ld-collection"]');
      if (ldJsonScript) {
        try {
          result.structuredData = JSON.parse(ldJsonScript.textContent);
        } catch (e) {
          console.error('Error parsing LD+JSON:', e);
        }
      }
      
      return result;
    });
    
    console.log(`✓ Successfully scraped: ${url}`);
    return { success: true, data: seoData };
    
  } catch (error) {
    console.error(`✗ Error scraping ${url}:`, error.message);
    
    if (retryCount < CONFIG.retries) {
      console.log(`Retrying ${url}...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return scrapePage(page, url, retryCount + 1);
    }
    
    return {
      success: false,
      error: error.message,
      url
    };
  }
}

// Process URLs in batches
async function scrapeUrls(urls) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });
  
  const results = [];
  const errors = [];
  
  // Process in batches
  for (let i = 0; i < urls.length; i += CONFIG.concurrency) {
    const batch = urls.slice(i, i + CONFIG.concurrency);
    console.log(`\nProcessing batch ${Math.floor(i / CONFIG.concurrency) + 1}/${Math.ceil(urls.length / CONFIG.concurrency)}`);
    
    const batchPromises = batch.map(async (url) => {
      const page = await browser.newPage();
      
      // Set Googlebot user agent
      await page.setUserAgent(GOOGLEBOT_UA);
      
      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      });
      
      const result = await scrapePage(page, url);
      await page.close();
      
      return result;
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(result => {
      if (result.success) {
        results.push(result.data);
      } else {
        errors.push(result);
      }
    });
  }
  
  await browser.close();
  
  return { results, errors };
}

// Save results to files
async function saveResults(results, errors) {
  // Create directories
  await fs.mkdir(CONFIG.outputDir, { recursive: true });
  await fs.mkdir(CONFIG.publicDir, { recursive: true });
  
  // Save JSON
  const jsonPath = path.join(CONFIG.outputDir, 'seo-results.json');
  await fs.writeFile(jsonPath, JSON.stringify({ results, errors, timestamp: new Date().toISOString() }, null, 2));
  console.log(`\n✓ Saved JSON: ${jsonPath}`);
  
  // Save CSV
  const csvPath = path.join(CONFIG.outputDir, 'seo-results.csv');
  const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: [
      { id: 'url', title: 'URL' },
      { id: 'metaTitleEn', title: 'Meta Title (EN)' },
      { id: 'metaTitleAr', title: 'Meta Title (AR)' },
      { id: 'metaDescEn', title: 'Meta Description (EN)' },
      { id: 'metaDescAr', title: 'Meta Description (AR)' },
      { id: 'h1En', title: 'H1 (EN)' },
      { id: 'h1Ar', title: 'H1 (AR)' },
      { id: 'introTextEn', title: 'Intro Text (EN)' },
      { id: 'introTextAr', title: 'Intro Text (AR)' },
      { id: 'timestamp', title: 'Timestamp' }
    ]
  });
  
  const csvData = results.map(r => ({
    url: r.url,
    metaTitleEn: r.metaTitle.en,
    metaTitleAr: r.metaTitle.ar,
    metaDescEn: r.metaDesc.en,
    metaDescAr: r.metaDesc.ar,
    h1En: r.h1.en,
    h1Ar: r.h1.ar,
    introTextEn: r.introText.en,
    introTextAr: r.introText.ar,
    timestamp: r.timestamp
  }));
  
  await csvWriter.writeRecords(csvData);
  console.log(`✓ Saved CSV: ${csvPath}`);
  
  // Generate HTML dashboard
  await generateDashboard(results, errors);
}

// Generate HTML dashboard
async function generateDashboard(results, errors) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SEO Scraper Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-card h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
        .stat-card .value { font-size: 32px; font-weight: bold; color: #333; }
        .results { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6; }
        td { padding: 12px; border-bottom: 1px solid #dee2e6; }
        tr:hover { background: #f8f9fa; }
        .url { color: #0066cc; text-decoration: none; }
        .url:hover { text-decoration: underline; }
        .error { color: #dc3545; }
        .success { color: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>SEO Scraper Dashboard</h1>
            <p>Last updated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <h3>Total URLs</h3>
                <div class="value">${results.length + errors.length}</div>
            </div>
            <div class="stat-card">
                <h3>Successfully Scraped</h3>
                <div class="value success">${results.length}</div>
            </div>
            <div class="stat-card">
                <h3>Failed</h3>
                <div class="value error">${errors.length}</div>
            </div>
            <div class="stat-card">
                <h3>Success Rate</h3>
                <div class="value">${((results.length / (results.length + errors.length)) * 100).toFixed(1)}%</div>
            </div>
        </div>
        
        <div class="results">
            <h2>Scraped Data</h2>
            <table>
                <thead>
                    <tr>
                        <th>URL</th>
                        <th>Meta Title (EN)</th>
                        <th>H1 (EN)</th>
                        <th>Meta Description (EN)</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(r => `
                        <tr>
                            <td><a href="${r.url}" class="url" target="_blank">${r.url}</a></td>
                            <td>${r.metaTitle.en || '-'}</td>
                            <td>${r.h1.en || '-'}</td>
                            <td>${r.metaDesc.en.substring(0, 100)}${r.metaDesc.en.length > 100 ? '...' : ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
  `;
  
  const dashboardPath = path.join(CONFIG.publicDir, 'index.html');
  await fs.writeFile(dashboardPath, html);
  console.log(`✓ Generated dashboard: ${dashboardPath}`);
}

// Main function
async function main() {
  try {
    console.log('🚀 Starting SEO scraper...\n');
    
    // Read URLs
    const urlsContent = await fs.readFile(CONFIG.urlsFile, 'utf-8');
    const urls = urlsContent.split('\n').filter(url => url.trim());
    
    console.log(`Found ${urls.length} URLs to scrape\n`);
    
    // Scrape URLs
    const { results, errors } = await scrapeUrls(urls);
    
    // Save results
    await saveResults(results, errors);
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`✓ Successfully scraped: ${results.length}`);
    console.log(`✗ Failed: ${errors.length}`);
    console.log(`📈 Success rate: ${((results.length / urls.length) * 100).toFixed(1)}%`);
    
    if (errors.length > 0) {
      console.log('\n❌ Failed URLs:');
      errors.forEach(e => console.log(`  - ${e.url}: ${e.error}`));
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();