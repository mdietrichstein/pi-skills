#!/usr/bin/env node

/**
 * Create a Linear document attached to a project, team, or issue
 *
 * Usage:
 *   ./create-document.js --title "Doc Title" --project PROJECT_ID --content "markdown..."
 *   ./create-document.js --title "Doc Title" --project PROJECT_ID --content-file /path/to/file.md
 *   ./create-document.js --title "Doc Title" --team TEAM_KEY --content "markdown..."
 *   ./create-document.js --title "Doc Title" --issue ISSUE_ID --content "markdown..."
 *   ./create-document.js --title "Doc Title" --project PROJECT_ID --content "markdown..." --icon "📋"
 *   ./create-document.js --json    # JSON output
 */

import fs from 'fs';
import { makeRequest, parseArgs } from './linear-api.js';

async function findProjectId(nameOrId) {
  // If it looks like a UUID, use directly
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameOrId)) {
    return nameOrId;
  }

  // Search by name
  const query = `
    query GetProjects {
      projects(first: 100) {
        nodes {
          id
          name
        }
      }
    }
  `;

  const data = await makeRequest(query);
  const project = data.projects.nodes.find(
    p => p.name.toLowerCase() === nameOrId.toLowerCase()
  );

  if (!project) {
    throw new Error(`Project not found: "${nameOrId}". Use projects.js to list available projects.`);
  }

  return project.id;
}

async function findTeamId(teamKey) {
  const query = `
    query GetTeam($key: String!) {
      team(id: $key) {
        id
        name
      }
    }
  `;

  try {
    const data = await makeRequest(query, { key: teamKey });
    if (!data.team) throw new Error('not found');
    return data.team.id;
  } catch {
    throw new Error(`Team not found: "${teamKey}". Use teams.js to list available teams.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.title) {
    console.error('Error: --title is required');
    console.error('Usage: create-document.js --title "Title" --project "Project Name" --content "markdown..."');
    console.error('       create-document.js --title "Title" --project "Project Name" --content-file /path/to/file.md');
    process.exit(1);
  }

  // Get content from --content or --content-file
  let content = args.content || '';
  if (args['content-file']) {
    const filePath = args['content-file'];
    if (!fs.existsSync(filePath)) {
      console.error(`Error: Content file not found: ${filePath}`);
      process.exit(1);
    }
    content = fs.readFileSync(filePath, 'utf-8');
  }

  if (!content) {
    console.error('Error: --content or --content-file is required');
    process.exit(1);
  }

  if (!args.project && !args.team && !args.issue) {
    console.error('Error: One of --project, --team, or --issue is required');
    process.exit(1);
  }

  // Build input
  const input = {
    title: args.title,
    content: content,
  };

  if (args.icon) {
    input.icon = args.icon;
  }

  if (args.project) {
    input.projectId = await findProjectId(args.project);
  }

  if (args.team) {
    input.teamId = await findTeamId(args.team);
  }

  if (args.issue) {
    input.issueId = args.issue;
  }

  // Create document
  const mutation = `
    mutation DocumentCreate($input: DocumentCreateInput!) {
      documentCreate(input: $input) {
        success
        document {
          id
          title
          slugId
          url
          createdAt
          project {
            id
            name
          }
          team {
            id
            name
          }
        }
      }
    }
  `;

  try {
    const data = await makeRequest(mutation, { input });

    if (!data.documentCreate.success) {
      console.error('Error: Failed to create document');
      process.exit(1);
    }

    const doc = data.documentCreate.document;

    if (args.json) {
      console.log(JSON.stringify(doc, null, 2));
      return;
    }

    console.log(`Document created successfully!`);
    console.log(`  Title: ${doc.title}`);
    if (doc.project) {
      console.log(`  Project: ${doc.project.name}`);
    }
    if (doc.team) {
      console.log(`  Team: ${doc.team.name}`);
    }
    console.log(`  URL: ${doc.url}`);

  } catch (error) {
    console.error('Error creating document:', error.message);
    process.exit(1);
  }
}

main();
