#!/usr/bin/env node

/**
 * Search and list Linear issues
 * 
 * Usage:
 *   ./issues.js                            # List recent issues
 *   ./issues.js --team TEAM_KEY            # Issues from specific team
 *   ./issues.js --status backlog           # Filter by status
 *   ./issues.js --assignee email           # Issues assigned to user
 *   ./issues.js --project PROJECT_ID       # Issues in specific project
 *   ./issues.js --search "bug fix"         # Text search
 *   ./issues.js --limit 50                 # Limit results
 *   ./issues.js --json                     # JSON output
 */

import { makeRequest, parseArgs, formatOutput, formatDate, formatPriority } from './linear-api.js';

async function buildQuery(args) {
  let filters = [];
  let variables = {};
  
  if (args.team) {
    filters.push('team: { key: { eq: $teamKey } }');
    variables.teamKey = args.team;
  }
  
  if (args.assignee) {
    filters.push('assignee: { email: { eq: $assigneeEmail } }');
    variables.assigneeEmail = args.assignee;
  }
  
  if (args.project) {
    filters.push('project: { id: { eq: $projectId } }');
    variables.projectId = args.project;
  }
  
  if (args.status) {
    const statusMap = {
      'backlog': 'backlog',
      'todo': 'unstarted', 
      'in_progress': 'started',
      'done': 'completed',
      'canceled': 'canceled'
    };
    const statusType = statusMap[args.status.toLowerCase()] || args.status;
    filters.push('state: { type: { eq: $stateType } }');
    variables.stateType = statusType;
  }
  
  const filterString = filters.length > 0 ? `filter: { ${filters.join(', ')} }` : '';
  
  // Build order by clause - most recent first
  const orderBy = 'orderBy: updatedAt';
  
  const limit = args.limit ? parseInt(args.limit) : 20;
  
  let searchQuery = '';
  if (args.search) {
    // For text search, we need to use a different approach
    searchQuery = ', query: $searchText';
    variables.searchText = args.search;
  }
  
  const query = `
    query GetIssues($first: Int!${Object.keys(variables).map(v => `, $${v}: String`).join('')}) {
      issues(first: $first, ${filterString} ${orderBy}${searchQuery}) {
        nodes {
          id
          identifier
          title
          description
          priority
          estimate
          createdAt
          updatedAt
          dueDate
          url
          state {
            name
            type
          }
          assignee {
            name
            email
          }
          creator {
            name
            email
          }
          team {
            key
            name
          }
          project {
            id
            name
          }
          labels {
            nodes {
              name
              color
            }
          }
        }
      }
    }
  `;
  
  variables.first = limit;
  
  return { query, variables };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  try {
    const { query, variables } = await buildQuery(args);
    const data = await makeRequest(query, variables);
    const issues = data.issues.nodes;
    
    if (args.json) {
      formatOutput(issues, 'json');
      return;
    }
    
    if (args.csv) {
      const csvData = issues.map(issue => ({
        identifier: issue.identifier,
        title: issue.title,
        status: issue.state.name,
        priority: formatPriority(issue.priority),
        assignee: issue.assignee?.email || 'Unassigned',
        team: issue.team.key,
        project: issue.project?.name || 'No Project',
        created: formatDate(issue.createdAt),
        updated: formatDate(issue.updatedAt)
      }));
      formatOutput(csvData, 'csv');
      return;
    }
    
    console.log(`Found ${issues.length} issues:\n`);
    
    issues.forEach(issue => {
      const priorityEmoji = {
        1: '🔥', // Urgent
        2: '📍', // High
        3: '📌', // Medium
        4: '📎', // Low
        0: '⚪'  // None
      }[issue.priority] || '⚪';
      
      const statusEmoji = {
        'backlog': '📋',
        'unstarted': '⏳',
        'started': '🚀',
        'completed': '✅',
        'canceled': '❌'
      }[issue.state.type] || '📋';
      
      console.log(`${statusEmoji} ${priorityEmoji} ${issue.identifier} - ${issue.title}`);
      console.log(`   Team: ${issue.team.key} (${issue.team.name})`);
      console.log(`   Status: ${issue.state.name} | Priority: ${formatPriority(issue.priority)}`);
      
      if (issue.assignee) {
        console.log(`   Assignee: ${issue.assignee.name} (${issue.assignee.email})`);
      } else {
        console.log(`   Assignee: Unassigned`);
      }
      
      if (issue.project) {
        console.log(`   Project: ${issue.project.name}`);
      }
      
      if (issue.estimate) {
        console.log(`   Estimate: ${issue.estimate} points`);
      }
      
      if (issue.dueDate) {
        console.log(`   Due: ${formatDate(issue.dueDate)}`);
      }
      
      if (issue.labels.nodes.length > 0) {
        const labels = issue.labels.nodes.map(l => l.name).join(', ');
        console.log(`   Labels: ${labels}`);
      }
      
      console.log(`   Updated: ${formatDate(issue.updatedAt)}`);
      console.log(`   URL: ${issue.url}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();