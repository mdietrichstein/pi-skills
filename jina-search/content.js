#!/usr/bin/env node

/**
 * Extract page content using Jina AI's r.jina.ai endpoint.
 * Converts URLs (including PDFs) to LLM-friendly markdown.
 * 
 * Usage:
 *   ./content.js https://example.com/article
 *   ./content.js https://example.com/doc.pdf
 *   ./content.js https://example.com/page --json
 *   ./content.js https://example.com/spa --wait-for "#content"
 */

import https from 'https';

function parseArgs(args) {
  const result = {
    url: null,
    json: false,
    timeout: 30,
    waitFor: null,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--json') {
      result.json = true;
    } else if (arg === '--timeout' && i + 1 < args.length) {
      result.timeout = parseInt(args[++i], 10);
    } else if (arg === '--wait-for' && i + 1 < args.length) {
      result.waitFor = args[++i];
    } else if (!arg.startsWith('-') && !result.url) {
      result.url = arg;
    }
    i++;
  }

  return result;
}

function fetch(url, headers = {}, timeout = 60000) {
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
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function parseMarkdownContent(text) {
  // Parse Jina's markdown response format
  const titleMatch = text.match(/^Title:\s*(.+?)(?:\n|$)/m);
  const urlMatch = text.match(/URL Source:\s*(.+?)(?:\n|$)/m);
  
  let content = text;
  // Remove metadata lines from content
  if (urlMatch) {
    const contentStart = text.indexOf('\n', text.indexOf('URL Source:'));
    if (contentStart > -1) {
      content = text.slice(contentStart).trim();
    }
  } else if (titleMatch) {
    const contentStart = text.indexOf('\n', text.indexOf('Title:'));
    if (contentStart > -1) {
      content = text.slice(contentStart).trim();
    }
  }

  return {
    title: titleMatch ? titleMatch[1].trim() : '',
    url: urlMatch ? urlMatch[1].trim() : '',
    content: content,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const opts = parseArgs(args);

  if (!opts.url) {
    console.error('Usage: content.js <url> [--json] [--timeout <seconds>] [--wait-for <selector>]');
    process.exit(1);
  }

  // Build Jina Reader URL
  const jinaUrl = `https://r.jina.ai/${opts.url}`;
  
  const headers = {
    'User-Agent': 'pi-jina-search/1.0',
  };

  // Request JSON format if specified
  if (opts.json) {
    headers['Accept'] = 'application/json';
  }

  // Add API key if available
  if (process.env.JINA_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
  }

  // Add optional headers
  if (opts.timeout) {
    headers['x-timeout'] = opts.timeout.toString();
  }
  
  if (opts.waitFor) {
    headers['x-wait-for-selector'] = opts.waitFor;
  }

  try {
    const { data } = await fetch(jinaUrl, headers, (opts.timeout + 10) * 1000);
    
    if (opts.json) {
      try {
        // Try to parse as JSON
        const json = JSON.parse(data);
        const result = {
          title: json.data?.title || json.title || '',
          url: json.data?.url || json.url || opts.url,
          content: json.data?.content || json.content || '',
        };
        console.log(JSON.stringify(result, null, 2));
      } catch {
        // If not JSON, parse markdown and output as JSON
        const result = parseMarkdownContent(data);
        result.url = result.url || opts.url;
        console.log(JSON.stringify(result, null, 2));
      }
    } else {
      // Output raw markdown
      console.log(data);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
