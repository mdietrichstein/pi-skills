#!/usr/bin/env node

/**
 * Web search using Jina AI's s.jina.ai endpoint.
 * Returns top 5 results with full page content.
 * 
 * Requires JINA_API_KEY environment variable.
 * Get a free key at: https://jina.ai/reader
 * 
 * Usage:
 *   ./search.js "query"
 *   ./search.js "query" --site example.com
 *   ./search.js "query" --json
 */

import https from 'https';

function parseArgs(args) {
  const result = {
    query: null,
    sites: [],
    json: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--site' && i + 1 < args.length) {
      result.sites.push(args[++i]);
    } else if (arg === '--json') {
      result.json = true;
    } else if (!arg.startsWith('-') && !result.query) {
      result.query = arg;
    }
    i++;
  }

  return result;
}

function buildUrl(query, sites) {
  const encodedQuery = encodeURIComponent(query);
  let url = `https://s.jina.ai/${encodedQuery}`;
  
  if (sites.length > 0) {
    const siteParams = sites.map(s => `site=${encodeURIComponent(s)}`).join('&');
    url += `?${siteParams}`;
  }
  
  return url;
}

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ data, statusCode: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function parseMarkdownResults(text) {
  // Jina returns multiple results separated by markdown sections
  // Each result starts with "Title:" and "URL Source:"
  const results = [];
  const sections = text.split(/(?=Title:)/);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    const titleMatch = section.match(/^Title:\s*(.+?)(?:\n|$)/);
    const urlMatch = section.match(/URL Source:\s*(.+?)(?:\n|$)/);
    
    if (titleMatch && urlMatch) {
      // Content is everything after the URL Source line
      const contentStart = section.indexOf('\n', section.indexOf('URL Source:'));
      const content = contentStart > -1 ? section.slice(contentStart).trim() : '';
      
      results.push({
        title: titleMatch[1].trim(),
        url: urlMatch[1].trim(),
        content: content,
      });
    }
  }
  
  return results;
}

function formatResults(results, jsonOutput) {
  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log('No results found.');
    return;
  }

  results.forEach((result, idx) => {
    console.log(`--- Result ${idx + 1} ---`);
    console.log(`Title: ${result.title}`);
    console.log(`URL: ${result.url}`);
    if (result.content) {
      console.log('Content:');
      // Indent content for readability
      const indented = result.content.split('\n').map(line => '  ' + line).join('\n');
      console.log(indented);
    }
    console.log();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const opts = parseArgs(args);

  if (!opts.query) {
    console.error('Usage: search.js "query" [--site domain] [--json]');
    process.exit(1);
  }

  if (!process.env.JINA_API_KEY) {
    console.error('Error: JINA_API_KEY environment variable is required for search.');
    console.error('Get a free API key at: https://jina.ai/reader');
    console.error('Then add to your shell profile: export JINA_API_KEY="your-key"');
    process.exit(1);
  }

  const url = buildUrl(opts.query, opts.sites);
  
  const headers = {
    'User-Agent': 'pi-jina-search/1.0',
    'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
  };

  // Request JSON for easier parsing
  if (opts.json) {
    headers['Accept'] = 'application/json';
  }

  try {
    const { data } = await fetch(url, headers);
    
    let results;
    
    // Check if response is JSON
    if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
      try {
        const json = JSON.parse(data);
        if (Array.isArray(json.data)) {
          results = json.data.map(item => ({
            title: item.title || '',
            url: item.url || '',
            content: item.content || '',
          }));
        } else if (Array.isArray(json)) {
          results = json.map(item => ({
            title: item.title || '',
            url: item.url || '',
            content: item.content || '',
          }));
        } else {
          results = [{
            title: json.title || '',
            url: json.url || '',
            content: json.content || '',
          }];
        }
      } catch {
        results = parseMarkdownResults(data);
      }
    } else {
      // Parse markdown format
      results = parseMarkdownResults(data);
    }

    formatResults(results, opts.json);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
