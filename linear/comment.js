#!/usr/bin/env node

/**
 * Add a comment to a Linear issue
 *
 * Usage:
 *   ./comment.js ISSUE_ID "Comment text"
 *   ./comment.js ISSUE_ID --body "Comment text"
 */

import { makeRequest, parseArgs, formatDate } from './linear-api.js';

async function getIssueId(issueIdentifier) {
  const isIdentifier = /^[A-Z]+-\d+$/.test(issueIdentifier);

  const query = `
    query GetIssue($${isIdentifier ? 'identifier' : 'id'}: String!) {
      issue(id: $${isIdentifier ? 'identifier' : 'id'}) {
        id
        identifier
        title
      }
    }
  `;

  const variables = {};
  variables[isIdentifier ? 'identifier' : 'id'] = issueIdentifier;

  const data = await makeRequest(query, variables);
  return data.issue;
}

async function addComment(issueId, body) {
  const mutation = `
    mutation CommentCreate($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment {
          id
          body
          createdAt
          user {
            name
            email
          }
        }
      }
    }
  `;

  const data = await makeRequest(mutation, {
    input: {
      issueId,
      body,
    },
  });

  if (!data.commentCreate.success) {
    throw new Error('Failed to create comment');
  }

  return data.commentCreate.comment;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const issueIdentifier = args._positional?.[0];
  const body = args.body || args._positional?.[1];

  if (!issueIdentifier || !body) {
    console.error('Usage: ./comment.js <ISSUE_ID> "Comment text"');
    console.error('       ./comment.js <ISSUE_ID> --body "Comment text"');
    console.error('');
    console.error('Example: ./comment.js ENG-123 "This has been deployed to staging"');
    process.exit(1);
  }

  try {
    const issue = await getIssueId(issueIdentifier);

    if (!issue) {
      console.error(`Issue '${issueIdentifier}' not found`);
      process.exit(1);
    }

    const comment = await addComment(issue.id, body);

    if (args.json) {
      console.log(JSON.stringify(comment, null, 2));
    } else {
      console.log(`\n✅ Comment added to ${issue.identifier} - ${issue.title}`);
      console.log(`💬 ${comment.user.name} - ${formatDate(comment.createdAt)}`);
      console.log(`   ${body}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
