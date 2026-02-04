#!/usr/bin/env node

/**
 * Delete a Linear issue (move to trash)
 * 
 * Usage:
 *   ./delete-issue.js ISSUE_ID
 *   ./delete-issue.js MA-123
 */

import { makeRequest, parseArgs } from './linear-api.js';

async function deleteIssue(issueId) {
  const mutation = `
    mutation DeleteIssue($id: String!) {
      issueDelete(id: $id) {
        success
      }
    }
  `;
  
  const data = await makeRequest(mutation, { id: issueId });
  
  if (!data.issueDelete.success) {
    throw new Error('Failed to delete issue');
  }
  
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const issueId = args._positional?.[0];
  
  if (!issueId) {
    console.error('Usage: ./delete-issue.js <ISSUE_ID>');
    console.error('');
    console.error('Examples:');
    console.error('  ./delete-issue.js MA-123');
    console.error('  ./delete-issue.js ENG-456');
    console.error('');
    console.error('Warning: This action cannot be undone!');
    process.exit(1);
  }
  
  try {
    console.log(`🗑️  Deleting issue ${issueId}...`);
    await deleteIssue(issueId);
    console.log(`✅ Issue ${issueId} deleted successfully`);
    console.log(`⚠️  Note: Issue moved to trash and can be restored from Linear web interface if needed.`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();