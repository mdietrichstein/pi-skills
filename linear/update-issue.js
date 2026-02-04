#!/usr/bin/env node

/**
 * Update a Linear issue
 * 
 * Usage:
 *   ./update-issue.js ISSUE_ID --status "In Progress"
 *   ./update-issue.js ISSUE_ID --assignee email@domain.com  
 *   ./update-issue.js ISSUE_ID --priority high
 *   ./update-issue.js ISSUE_ID --title "New title"
 *   ./update-issue.js ISSUE_ID --description "New description"
 *   ./update-issue.js ISSUE_ID --attachment "https://example.com/file.png"
 *   ./update-issue.js ISSUE_ID --attachment "https://example.com/file1.png" --attachment "https://example.com/file2.pdf"
 */

import { makeRequest, parseArgs, getUserId, getWorkflowStateId, formatOutput, formatDate, processLocalImagesForDescription, createAttachment } from './linear-api.js';
import path from 'path';

const priorities = {
  'urgent': 1,
  'high': 2,
  'medium': 3,
  'low': 4,
  'none': 0
};

async function getIssue(issueId) {
  const isIdentifier = /^[A-Z]+-\d+$/.test(issueId);
  
  const query = `
    query GetIssue($${isIdentifier ? 'identifier' : 'id'}: String!) {
      issue(id: $${isIdentifier ? 'identifier' : 'id'}) {
        id
        identifier
        title
        description
        priority
        team {
          id
          key
          name
        }
        state {
          id
          name
          type
        }
        assignee {
          id
          name
          email
        }
      }
    }
  `;
  
  const variables = {};
  variables[isIdentifier ? 'identifier' : 'id'] = issueId;
  
  const data = await makeRequest(query, variables);
  return data.issue;
}

async function getCurrentIssueDescription(issueId) {
  const query = `
    query GetIssueDescription($id: String!) {
      issue(id: $id) {
        description
      }
    }
  `;
  
  const data = await makeRequest(query, { id: issueId });
  return data.issue ? data.issue.description || '' : '';
}

async function updateIssue(issueId, updates, currentIssue, attachments = []) {
  // Process local images for embedding and separate URL attachments
  let urlAttachments = [];
  let descriptionAddition = '';
  
  if (attachments && attachments.length > 0) {
    const { markdown, remaining } = await processLocalImagesForDescription(attachments);
    
    // Add embedded images to description
    descriptionAddition = markdown;
    
    // Keep URL attachments for later processing
    urlAttachments = remaining.filter(att => att.startsWith('http://') || att.startsWith('https://'));
    
    // If we have embedded images, update the description
    if (markdown) {
      // If description is being explicitly updated, use that; otherwise preserve current description
      let baseDescription = '';
      if (updates.description !== undefined) {
        // User provided new description
        baseDescription = updates.description;
      } else {
        // Preserve existing description
        baseDescription = currentIssue.description || '';
        console.log(`📄 Preserving existing description (${baseDescription.length} chars)`);
      }
      updates.description = baseDescription + markdown;
    }
  }
  
  const mutation = `
    mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue {
          id
          identifier
          title
          priority
          state {
            name
          }
          assignee {
            name
            email
          }
          updatedAt
        }
      }
    }
  `;
  
  const data = await makeRequest(mutation, { id: issueId, input: updates });
  
  if (!data.issueUpdate.success) {
    throw new Error('Failed to update issue');
  }
  
  const issue = data.issueUpdate.issue;
  
  // Process URL attachments after issue update
  const attachmentResults = [];
  for (const urlAttachment of urlAttachments) {
    try {
      console.log(`📎 Creating attachment for ${urlAttachment}...`);
      const filename = path.basename(new URL(urlAttachment).pathname) || 'Attachment';
      const attachmentId = await createAttachment(issueId, filename, urlAttachment);
      attachmentResults.push(`✅ Created attachment: ${filename}`);
      console.log(`✅ Created attachment: ${filename} (${attachmentId})`);
    } catch (error) {
      console.error(`❌ Failed to create attachment for ${urlAttachment}: ${error.message}`);
      attachmentResults.push(`❌ Failed: ${path.basename(urlAttachment)} - ${error.message}`);
    }
  }
  
  // Build attachment result message
  const resultParts = [];
  
  if (descriptionAddition) {
    resultParts.push('✅ Images embedded in description');
  }
  
  if (attachmentResults.length > 0) {
    resultParts.push('\n**📎 URL Attachment Results:**\n' + attachmentResults.join('\n'));
  }
  
  if (resultParts.length > 0) {
    issue._attachmentResult = '\n\n**📎 Attachment Processing:**\n' + resultParts.join('\n');
  }
  
  return issue;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const issueId = args._positional?.[0];
  
  if (!issueId) {
    console.error('Usage: ./update-issue.js <ISSUE_ID> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --status <status>       Update issue status');
    console.error('  --assignee <email>      Assign to user (email)');
    console.error('  --priority <priority>   Set priority (urgent/high/medium/low/none)');
    console.error('  --title <title>         Update title');
    console.error('  --description <desc>    Update description');
    console.error('  --attachment <file>     Add file attachment (can be used multiple times)');
    console.error('');
    console.error('Example: ./update-issue.js ENG-123 --status "In Progress" --priority high');
    console.error('Example: ./update-issue.js ENG-123 --attachment "https://example.com/screenshot.png"');
    process.exit(1);
  }
  
  try {
    // Get current issue details
    const issue = await getIssue(issueId);
    
    if (!issue) {
      console.error(`Issue '${issueId}' not found`);
      process.exit(1);
    }
    
    console.log(`Updating issue ${issue.identifier} - ${issue.title}\n`);
    
    const updates = {};
    let hasUpdates = false;
    
    // Handle status update
    if (args.status) {
      const stateId = await getWorkflowStateId(issue.team.id, args.status);
      if (!stateId) {
        console.error(`Invalid status '${args.status}' for team ${issue.team.key}`);
        console.error('Valid statuses: backlog, todo, in_progress, done, canceled');
        process.exit(1);
      }
      updates.stateId = stateId;
      hasUpdates = true;
      console.log(`🔄 Setting status to: ${args.status}`);
    }
    
    // Handle assignee update
    if (args.assignee) {
      if (args.assignee.toLowerCase() === 'none' || args.assignee === '') {
        updates.assigneeId = null;
        console.log(`👤 Removing assignee`);
      } else {
        const assigneeId = await getUserId(args.assignee);
        if (!assigneeId) {
          console.error(`User with email '${args.assignee}' not found`);
          process.exit(1);
        }
        updates.assigneeId = assigneeId;
        console.log(`👤 Assigning to: ${args.assignee}`);
      }
      hasUpdates = true;
    }
    
    // Handle priority update
    if (args.priority) {
      const priority = priorities[args.priority.toLowerCase()];
      if (priority === undefined) {
        console.error(`Invalid priority '${args.priority}'`);
        console.error('Valid priorities: urgent, high, medium, low, none');
        process.exit(1);
      }
      updates.priority = priority;
      hasUpdates = true;
      console.log(`📍 Setting priority to: ${args.priority}`);
    }
    
    // Handle title update
    if (args.title) {
      updates.title = args.title;
      hasUpdates = true;
      console.log(`📝 Updating title to: ${args.title}`);
    }
    
    // Handle description update
    if (args.description) {
      updates.description = args.description;
      hasUpdates = true;
      console.log(`📄 Updating description`);
    }
    
    // Handle attachments
    let attachments = [];
    if (args.attachment) {
      if (Array.isArray(args.attachment)) {
        attachments = args.attachment;
      } else {
        attachments = [args.attachment];
      }
      hasUpdates = true;
      console.log(`📎 Adding ${attachments.length} attachment(s)`);
    }
    
    if (!hasUpdates) {
      console.error('No updates specified. Use --status, --assignee, --priority, --title, --description, or --attachment');
      process.exit(1);
    }
    
    console.log('\nApplying updates...');
    const updatedIssue = await updateIssue(issue.id, updates, issue, attachments);
    
    if (args.json) {
      formatOutput(updatedIssue, 'json');
    } else {
      console.log('\n✅ Issue updated successfully!');
      console.log(`📋 ${updatedIssue.identifier} - ${updatedIssue.title}`);
      console.log(`Status: ${updatedIssue.state.name}`);
      
      if (updatedIssue.assignee) {
        console.log(`Assignee: ${updatedIssue.assignee.name} (${updatedIssue.assignee.email})`);
      } else {
        console.log(`Assignee: Unassigned`);
      }
      
      const priorityNames = ['None', 'Urgent', 'High', 'Medium', 'Low'];
      console.log(`Priority: ${priorityNames[updatedIssue.priority] || 'Unknown'}`);
      console.log(`Updated: ${formatDate(updatedIssue.updatedAt)}`);
      
      // Display attachment results if any
      if (updatedIssue._attachmentResult) {
        console.log(updatedIssue._attachmentResult);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();