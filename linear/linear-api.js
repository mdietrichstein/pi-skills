#!/usr/bin/env node

/**
 * Linear API utilities
 * Shared functions for Linear GraphQL API interactions
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
if (fs.existsSync(path.join(__dirname, '.env'))) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(__dirname, '.env') });
}

const API_URL = 'https://api.linear.app/graphql';
const API_KEY = process.env.LINEAR_API_KEY;

if (!API_KEY) {
  console.error('Error: LINEAR_API_KEY environment variable is required.');
  console.error('Get your API key from: https://linear.app/settings/api');
  process.exit(1);
}

/**
 * Make a GraphQL request to Linear API
 */
export async function makeRequest(query, variables = {}) {
  const data = JSON.stringify({
    query,
    variables
  });

  const options = {
    hostname: 'api.linear.app',
    path: '/graphql',
    method: 'POST',
    headers: {
      'Authorization': API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          
          if (response.errors) {
            reject(new Error(`GraphQL Error: ${response.errors.map(e => e.message).join(', ')}`));
            return;
          }
          
          resolve(response.data);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Format date for display
 */
export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format priority for display
 */
export function formatPriority(priority) {
  const priorities = {
    0: 'None',
    1: 'Urgent',
    2: 'High', 
    3: 'Medium',
    4: 'Low'
  };
  return priorities[priority] || 'Unknown';
}

/**
 * Format status for display
 */
export function formatStatus(status) {
  return status.name;
}

/**
 * Convert string status to workflow state ID
 */
export async function getWorkflowStateId(teamId, statusName) {
  const query = `
    query GetWorkflowStates($teamId: String!) {
      team(id: $teamId) {
        states {
          nodes {
            id
            name
            type
          }
        }
      }
    }
  `;

  try {
    const data = await makeRequest(query, { teamId });
    const states = data.team.states.nodes;
    
    // Normalize status names for comparison
    const normalizedStatus = statusName.toLowerCase().replace(/[_\s]/g, '');
    
    const stateMap = {
      'backlog': 'backlog',
      'todo': 'unstarted',
      'inprogress': 'started',
      'done': 'completed',
      'canceled': 'canceled'
    };
    
    const targetType = stateMap[normalizedStatus];
    
    const state = states.find(s => 
      s.type === targetType || 
      s.name.toLowerCase().replace(/[_\s]/g, '') === normalizedStatus
    );
    
    return state ? state.id : null;
  } catch (error) {
    console.error('Error getting workflow state:', error.message);
    return null;
  }
}

/**
 * Find user ID by email
 */
export async function getUserId(email) {
  const query = `
    query GetUsers {
      users {
        nodes {
          id
          email
          name
        }
      }
    }
  `;

  try {
    const data = await makeRequest(query);
    const user = data.users.nodes.find(u => u.email.toLowerCase() === email.toLowerCase());
    return user ? user.id : null;
  } catch (error) {
    console.error('Error finding user:', error.message);
    return null;
  }
}

/**
 * Parse command line arguments
 */
export function parseArgs(args, options = {}) {
  const result = { ...options };
  
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      
      if (!nextArg || nextArg.startsWith('--')) {
        // Flag without value
        result[key] = true;
      } else {
        // Flag with value
        // Support multiple values for same flag (e.g., multiple --attachment)
        if (result[key] !== undefined) {
          // Convert to array if not already
          if (!Array.isArray(result[key])) {
            result[key] = [result[key]];
          }
          result[key].push(nextArg);
        } else {
          result[key] = nextArg;
        }
        i++;
      }
    } else {
      // Positional argument
      if (!result._positional) result._positional = [];
      result._positional.push(arg);
    }
    
    i++;
  }
  
  return result;
}

/**
 * Create an attachment in Linear for a file
 * Note: Linear doesn't support direct file uploads. You need to host the file elsewhere.
 * This function creates an attachment record pointing to an external URL.
 * @param {string} issueId - ID of the issue to attach to
 * @param {string} filePath - Path to the file (used for title/metadata only)
 * @param {string} fileUrl - External URL where the file is hosted
 * @returns {Promise<string>} - The attachment ID
 */
export async function createAttachment(issueId, filePath, fileUrl) {
  try {
    const filename = path.basename(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    // Determine icon URL based on file type
    let iconUrl = null;
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      iconUrl = fileUrl; // Use the image itself as icon
    }
    
    const attachmentMutation = `
      mutation AttachmentCreate($input: AttachmentCreateInput!) {
        attachmentCreate(input: $input) {
          success
          attachment {
            id
            url
            title
          }
        }
      }
    `;
    
    const input = {
      issueId: issueId,
      title: filename,
      url: fileUrl
    };
    
    if (iconUrl) {
      input.iconUrl = iconUrl;
    }
    
    const data = await makeRequest(attachmentMutation, { input });
    
    if (!data.attachmentCreate.success) {
      throw new Error('Failed to create attachment');
    }
    
    return data.attachmentCreate.attachment.id;
    
  } catch (error) {
    throw new Error(`Attachment creation failed: ${error.message}`);
  }
}

/**
 * Generate a temporary public URL for a file (placeholder implementation)
 * In a real implementation, you would upload the file to your own file hosting service
 * (AWS S3, Cloudinary, etc.) and return the public URL
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - Public URL where file can be accessed
 */
async function uploadToExternalStorage(filePath) {
  // This is a placeholder implementation
  // In production, you would upload to your preferred file hosting service
  const filename = path.basename(filePath);
  
  // For demonstration, we'll return a placeholder URL
  // You should replace this with actual file upload logic
  throw new Error(`File upload not implemented. Please upload '${filename}' to an external service and provide the URL directly.`);
  
  // Example implementation with AWS S3 or similar:
  // const url = await s3.upload({ Key: filename, Body: fs.readFileSync(filePath) }).promise();
  // return url.Location;
}

/**
 * Try to import Sharp for image processing
 * @returns {Promise<object|null>} - Sharp instance or null if not available
 */
async function getSharp() {
  try {
    const sharp = await import('sharp');
    return sharp.default;
  } catch (error) {
    return null;
  }
}

/**
 * Resize image to fit within size limit
 * @param {string} filePath - Path to the image file
 * @param {number} targetSizeKB - Target size in KB (default: 90KB for safety margin)
 * @returns {Promise<Buffer>} - Resized image buffer
 */
async function resizeImageToFitSize(filePath, targetSizeKB = 90) {
  const sharp = await getSharp();
  
  if (!sharp) {
    throw new Error('Sharp not available. Install with: npm install sharp');
  }
  
  const originalBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  
  // Start with reasonable dimensions and quality
  let width = 800;
  let quality = 80;
  let buffer;
  
  const targetSizeBytes = targetSizeKB * 1024;
  
  // Try progressive reduction
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      let pipeline = sharp(originalBuffer).resize(width, null, {
        withoutEnlargement: true,
        fit: 'inside'
      });
      
      // Apply format-specific compression
      if (ext === '.png') {
        pipeline = pipeline.png({ 
          quality: quality,
          compressionLevel: 9,
          adaptiveFiltering: true
        });
      } else if (ext === '.jpg' || ext === '.jpeg') {
        pipeline = pipeline.jpeg({ quality: quality });
      } else if (ext === '.webp') {
        pipeline = pipeline.webp({ quality: quality });
      } else {
        // For other formats, convert to JPEG for better compression
        pipeline = pipeline.jpeg({ quality: quality });
      }
      
      buffer = await pipeline.toBuffer();
      
      console.log(`📏 Resize attempt ${attempt + 1}: ${width}px, quality ${quality}% = ${(buffer.length / 1024).toFixed(1)}KB`);
      
      if (buffer.length <= targetSizeBytes) {
        console.log(`✅ Image resized successfully to ${(buffer.length / 1024).toFixed(1)}KB`);
        return buffer;
      }
      
      // Reduce dimensions and quality for next attempt
      if (attempt < 4) {
        width = Math.floor(width * 0.8); // Reduce width by 20%
      } else {
        width = Math.floor(width * 0.9); // Smaller reduction
        quality = Math.max(30, quality - 15); // Reduce quality more aggressively
      }
      
    } catch (error) {
      console.error(`❌ Resize attempt ${attempt + 1} failed:`, error.message);
      throw error;
    }
  }
  
  // If we still haven't reached target size, return the smallest version
  if (buffer) {
    console.log(`⚠️  Final size: ${(buffer.length / 1024).toFixed(1)}KB (target: ${targetSizeKB}KB)`);
    return buffer;
  }
  
  throw new Error('Unable to resize image to target size');
}

/**
 * Convert file to base64 data URI for embedding in markdown
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - Base64 data URI
 */
async function fileToBase64DataUri(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const fileSizeKB = stats.size / 1024;
    const ext = path.extname(filePath).toLowerCase();
    
    // Determine MIME type for data URI
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg', 
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    let fileBuffer;
    
    // If file is already small enough, use as-is
    if (fileSizeKB <= 90) {
      console.log(`✅ Image already optimal size: ${fileSizeKB.toFixed(1)}KB`);
      fileBuffer = fs.readFileSync(filePath);
    } else {
      // Try to resize the image
      console.log(`📏 Image is ${fileSizeKB.toFixed(1)}KB, attempting to resize...`);
      
      try {
        fileBuffer = await resizeImageToFitSize(filePath);
      } catch (resizeError) {
        // Fallback: show helpful message if resize fails
        const sharp = await getSharp();
        if (!sharp) {
          throw new Error(`Image file is ${(fileSizeKB / 1024).toFixed(1)}MB. To auto-resize images, install Sharp:

npm install sharp

Or manually:
1. Resize image to smaller dimensions  
2. Host externally and use --attachment "https://url"
3. Or manually drag and drop in Linear web interface`);
        } else {
          throw new Error(`Failed to resize image: ${resizeError.message}. Please:
1. Try a different image format
2. Host externally and use --attachment "https://url" 
3. Or manually drag and drop in Linear web interface`);
        }
      }
    }
    
    const base64 = fileBuffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
    
  } catch (error) {
    throw new Error(`Failed to convert file to base64: ${error.message}`);
  }
}

/**
 * Process local images for embedding in description (for create-issue)
 * @param {string[]} attachments - Array of file paths
 * @returns {Promise<{markdown: string, remaining: string[]}>} - Markdown content and remaining non-image files
 */
export async function processLocalImagesForDescription(attachments) {
  if (!attachments || attachments.length === 0) {
    return { markdown: '', remaining: [] };
  }
  
  const markdownParts = [];
  const remaining = [];
  
  for (const attachment of attachments) {
    if (attachment.startsWith('http://') || attachment.startsWith('https://')) {
      // URLs go to remaining for later attachment creation
      remaining.push(attachment);
      continue;
    }
    
    const filename = path.basename(attachment);
    const ext = path.extname(attachment).toLowerCase();
    
    // Check if file exists
    if (!fs.existsSync(attachment)) {
      console.error(`❌ File not found: ${filename}`);
      continue;
    }
    
    // Check if it's an image that can be embedded
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
      try {
        console.log(`📷 Embedding image: ${filename}...`);
        
        const dataUri = await fileToBase64DataUri(attachment);
        markdownParts.push(`![${filename}](${dataUri})`);
        
        console.log(`✅ Embedded image: ${filename}`);
      } catch (error) {
        console.error(`❌ Failed to embed ${filename}: ${error.message}`);
        remaining.push(attachment); // Add to remaining for manual handling
      }
    } else {
      // Non-image files go to remaining
      remaining.push(attachment);
    }
  }
  
  const markdown = markdownParts.length > 0 ? '\n\n' + markdownParts.join('\n\n') : '';
  
  return { markdown, remaining };
}

/**
 * Process attachments for URL-based attachments (for update-issue)
 * @param {string} issueId - Issue ID for URL attachments
 * @param {string[]} attachments - Array of file paths or URLs
 * @returns {Promise<string>} - Status message about attachments
 */
export async function processAttachments(issueId, attachments) {
  if (!attachments || attachments.length === 0) {
    return '';
  }
  
  const results = [];
  const nonImageFiles = [];
  
  for (const attachment of attachments) {
    try {
      if (attachment.startsWith('http://') || attachment.startsWith('https://')) {
        // It's a URL - create Linear attachment
        console.log(`📎 Creating attachment for ${attachment}...`);
        
        const filename = path.basename(new URL(attachment).pathname) || 'Attachment';
        const attachmentId = await createAttachment(issueId, filename, attachment);
        
        results.push(`✅ Created attachment: ${filename}`);
        console.log(`✅ Created attachment: ${filename} (${attachmentId})`);
        
      } else {
        // It's a local file path
        const filename = path.basename(attachment);
        const ext = path.extname(attachment).toLowerCase();
        
        // Check if file exists
        if (!fs.existsSync(attachment)) {
          results.push(`❌ File not found: ${filename}`);
          continue;
        }
        
        // For local files in update, we can't embed in description, so show instructions
        nonImageFiles.push(filename);
      }
    } catch (error) {
      console.error(`❌ Failed to process ${attachment}: ${error.message}`);
      results.push(`❌ Failed: ${path.basename(attachment)} - ${error.message}`);
    }
  }
  
  let message = '';
  
  // Add success/failure results
  if (results.length > 0) {
    message += '\n\n**📎 Attachment Results:**\n' + results.join('\n');
  }
  
  // Add note about local files
  if (nonImageFiles.length > 0) {
    message += `\n\n**📎 Local Files Note:**
For updating existing issues, local files cannot be embedded in the description. These files need external hosting:

${nonImageFiles.map(f => `- ${f}`).join('\n')}

To add these files:
1. Upload to your file hosting service (AWS S3, Cloudinary, etc.)
2. Re-run with --attachment "https://your-hosted-url.com/file"
3. Or manually drag and drop files in the Linear web interface
4. For new issues, use create-issue.js to embed images directly`;
  }
  
  return message;
}

/**
 * Output formatter
 */
export function formatOutput(data, format = 'table') {
  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  
  if (format === 'csv') {
    if (Array.isArray(data) && data.length > 0) {
      // Get headers from first object
      const headers = Object.keys(data[0]);
      console.log(headers.join(','));
      
      data.forEach(row => {
        const values = headers.map(h => {
          const value = row[h] || '';
          // Escape commas and quotes in CSV
          return `"${value.toString().replace(/"/g, '""')}"`;
        });
        console.log(values.join(','));
      });
    }
    return;
  }
  
  // Default table format
  if (Array.isArray(data)) {
    data.forEach(item => console.log(item));
  } else {
    console.log(data);
  }
}