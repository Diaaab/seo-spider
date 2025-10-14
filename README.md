# SEO Scraper with GitHub Actions & Cloudflare Pages

Automated SEO data scraper that extracts meta titles, descriptions, H1s, and intro text in both English and Arabic.

## Setup

### 1. Repository Setup
1. Create a new GitHub repository
2. Upload all files from your local folder
3. Commit and push

### 2. Cloudflare Pages Setup
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to Pages > Create a project
3. Connect your GitHub repository
4. Configure build settings:
   - Build command: (leave empty)
   - Build output directory: `public`
5. Note your Account ID from the URL

### 3. GitHub Secrets
Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

- `CLOUDFLARE_API_TOKEN`: 
  1. Go to Cloudflare Dashboard > My Profile > API Tokens
  2. Create Token > Edit Cloudflare Workers
  3. Add Account > Cloudflare Pages:Edit
  4. Copy the token

- `CLOUDFLARE_ACCOUNT_ID`:
  1. Found in Cloudflare Dashboard URL or Account settings

### 4. Add URLs
Edit `urls.txt` and add your URLs (one per line)

### 5. Run
- **Manual**: Go to Actions tab > Scrape SEO Data > Run workflow
- **Automatic**: Runs daily at 2 AM UTC
- **On Push**: Automatically runs when you update `urls.txt`

## Output

### Files Generated
- `data/seo-results.json` - Complete JSON data
- `data/seo-results.csv` - CSV export for analysis
- `public/index.html` - Interactive dashboard

### Dashboard
View your dashboard at: `https://YOUR-PROJECT.pages.dev`

## Configuration
Edit `scraper.js` CONFIG object:
```javascript
const CONFIG = {
  urlsFile: 'urls.txt',
  outputDir: 'data',
  publicDir: 'public',
  concurrency: 3,
  timeout: 30000,
  retries: 2
};
```

## License
MIT