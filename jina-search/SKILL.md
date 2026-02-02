---
name: jina-search
description: Web search and content extraction via Jina AI Reader API. Use for searching documentation, facts, or any web content. Search requires API key; content extraction is free.
---

# Jina Search

Web search and content extraction using Jina AI's Reader API. No browser required.

## Setup

Install dependencies (run once):

```bash
cd {baseDir}
npm install
```

**Required for search:** Get a free API key from https://jina.ai/reader and add to your shell profile:

```bash
export JINA_API_KEY="your-api-key-here"
```

Note: Content extraction works without an API key. Search requires one.

## Search

Requires `JINA_API_KEY` environment variable.

```bash
{baseDir}/search.js "query"                         # Basic search (5 results)
{baseDir}/search.js "query" --site example.com      # Limit to specific site
{baseDir}/search.js "query" --json                  # JSON output format
{baseDir}/search.js "query" --site docs.python.org  # In-site search
```

### Options

- `--site <domain>` - Limit search to specific domain (can be used multiple times)
- `--json` - Output results as JSON instead of formatted text

## Extract Page Content

Works without API key (free tier).

```bash
{baseDir}/content.js https://example.com/article
{baseDir}/content.js https://example.com/article --json    # JSON output
{baseDir}/content.js https://example.com/doc.pdf           # PDFs supported
```

Fetches a URL and extracts readable content as markdown. Supports web pages and PDFs.

### Options

- `--json` - Output as JSON with url, title, content fields
- `--timeout <seconds>` - Custom timeout (default: 30)
- `--wait-for <selector>` - Wait for CSS selector before extracting

## Output Format

### Search Results (default)

```
--- Result 1 ---
Title: Page Title
URL: https://example.com/page
Content:
  Markdown content from the page...

--- Result 2 ---
...
```

### JSON Output

```json
[
  {
    "title": "Page Title",
    "url": "https://example.com/page",
    "content": "Markdown content..."
  }
]
```

## When to Use

- Searching for documentation or API references (requires API key)
- Looking up facts or current information (requires API key)
- Fetching content from specific URLs or PDFs (free)
- Any task requiring web search without interactive browsing
