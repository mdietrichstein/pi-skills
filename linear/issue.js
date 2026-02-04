#!/usr/bin/env node

/**
 * Get detailed information about a specific Linear issue
 * 
 * Usage:
 *   ./issue.js ISSUE_ID        # Get issue by ID
 *   ./issue.js TEAM-123        # Get issue by identifier
 *   ./issue.js --json          # JSON output
 */

import { makeRequest, parseArgs, formatOutput, formatDate, formatPriority } from './linear-api.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const issueId = args._positional?.[0];
  
  if (!issueId) {
    console.error('Usage: ./issue.js <ISSUE_ID>');
    console.error('Example: ./issue.js ENG-123');
    process.exit(1);
  }
  
  // Determine if it's an identifier (TEAM-123) or ID
  const isIdentifier = /^[A-Z]+-\d+$/.test(issueId);
  
  let query;
  let variables;
  
  if (isIdentifier) {
    query = `
      query GetIssueByIdentifier($identifier: String!) {
        issue(id: $identifier) {
          id
          identifier
          title
          description
          priority
          estimate
          createdAt
          updatedAt
          completedAt
          canceledAt
          dueDate
          url
          state {
            name
            type
            color
          }
          assignee {
            id
            name
            email
            avatarUrl
          }
          creator {
            name
            email
          }
          team {
            key
            name
            description
          }
          project {
            id
            name
            description
            progress
            targetDate
          }
          labels {
            nodes {
              id
              name
              color
              description
            }
          }
          children {
            nodes {
              id
              identifier
              title
              state {
                name
              }
            }
          }
          parent {
            id
            identifier
            title
          }
          attachments {
            nodes {
              id
              title
              url
              subtitle
            }
          }
          comments {
            nodes {
              id
              body
              createdAt
              user {
                name
                email
              }
            }
          }
          history {
            nodes {
              id
              createdAt
              actor {
                name
              }
              fromState {
                name
              }
              toState {
                name
              }
              changes {
                field
                from
                to
              }
            }
          }
        }
      }
    `;
    variables = { identifier: issueId };
  } else {
    query = query.replace('$identifier: String!', '$id: String!').replace('id: $identifier', 'id: $id');
    variables = { id: issueId };
  }
  
  try {
    const data = await makeRequest(query, variables);
    
    if (!data.issue) {
      console.error(`Issue '${issueId}' not found`);
      process.exit(1);
    }
    
    const issue = data.issue;
    
    if (args.json) {
      formatOutput(issue, 'json');
      return;
    }
    
    // Display issue details
    console.log(`\n📋 ${issue.identifier} - ${issue.title}\n`);
    
    if (issue.description) {
      console.log('Description:');
      console.log(issue.description);
      console.log('');
    }
    
    console.log('Details:');
    console.log(`  Status: ${issue.state.name}`);
    console.log(`  Priority: ${formatPriority(issue.priority)}`);
    console.log(`  Team: ${issue.team.key} (${issue.team.name})`);
    
    if (issue.assignee) {
      console.log(`  Assignee: ${issue.assignee.name} (${issue.assignee.email})`);
    } else {
      console.log(`  Assignee: Unassigned`);
    }
    
    console.log(`  Creator: ${issue.creator.name} (${issue.creator.email})`);
    
    if (issue.project) {
      console.log(`  Project: ${issue.project.name} (${issue.project.progress}% complete)`);
      if (issue.project.targetDate) {
        console.log(`  Project Target: ${formatDate(issue.project.targetDate)}`);
      }
    }
    
    if (issue.estimate) {
      console.log(`  Estimate: ${issue.estimate} points`);
    }
    
    if (issue.dueDate) {
      console.log(`  Due Date: ${formatDate(issue.dueDate)}`);
    }
    
    console.log(`  Created: ${formatDate(issue.createdAt)}`);
    console.log(`  Updated: ${formatDate(issue.updatedAt)}`);
    
    if (issue.completedAt) {
      console.log(`  Completed: ${formatDate(issue.completedAt)}`);
    }
    
    if (issue.canceledAt) {
      console.log(`  Canceled: ${formatDate(issue.canceledAt)}`);
    }
    
    console.log(`  URL: ${issue.url}`);
    
    // Labels
    if (issue.labels.nodes.length > 0) {
      console.log('\nLabels:');
      issue.labels.nodes.forEach(label => {
        console.log(`  🏷️  ${label.name}${label.description ? ` - ${label.description}` : ''}`);
      });
    }
    
    // Parent/Children relationships
    if (issue.parent) {
      console.log('\nParent Issue:');
      console.log(`  ⬆️  ${issue.parent.identifier} - ${issue.parent.title}`);
    }
    
    if (issue.children.nodes.length > 0) {
      console.log('\nChild Issues:');
      issue.children.nodes.forEach(child => {
        console.log(`  ⬇️  ${child.identifier} - ${child.title} (${child.state.name})`);
      });
    }
    
    // Attachments
    if (issue.attachments.nodes.length > 0) {
      console.log('\nAttachments:');
      issue.attachments.nodes.forEach(attachment => {
        console.log(`  📎 ${attachment.title}`);
        if (attachment.subtitle) {
          console.log(`     ${attachment.subtitle}`);
        }
        console.log(`     ${attachment.url}`);
      });
    }
    
    // Recent comments
    if (issue.comments.nodes.length > 0) {
      console.log('\nComments:');
      issue.comments.nodes.slice(0, 5).forEach(comment => { // Show last 5 comments
        console.log(`\n💬 ${comment.user.name} - ${formatDate(comment.createdAt)}`);
        console.log(`   ${comment.body}`);
      });
      
      if (issue.comments.nodes.length > 5) {
        console.log(`\n   ... and ${issue.comments.nodes.length - 5} more comments`);
      }
    }
    
    // Recent history
    if (issue.history.nodes.length > 0) {
      console.log('\nRecent History:');
      issue.history.nodes.slice(0, 10).forEach(entry => { // Show last 10 history entries
        const actor = entry.actor?.name || 'System';
        const date = formatDate(entry.createdAt);
        
        if (entry.fromState && entry.toState) {
          console.log(`  📈 ${actor} moved from ${entry.fromState.name} to ${entry.toState.name} - ${date}`);
        } else if (entry.changes.length > 0) {
          entry.changes.forEach(change => {
            console.log(`  ✏️  ${actor} changed ${change.field}: ${change.from} → ${change.to} - ${date}`);
          });
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();