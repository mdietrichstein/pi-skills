#!/usr/bin/env node

/**
 * List Linear projects
 * 
 * Usage:
 *   ./projects.js                 # List all projects
 *   ./projects.js TEAM_KEY        # Projects for specific team
 *   ./projects.js --active        # Only active projects
 *   ./projects.js --json          # JSON output
 */

import { makeRequest, parseArgs, formatOutput, formatDate } from './linear-api.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const teamKey = args._positional?.[0];
  
  let query;
  let variables = {};
  
  if (teamKey) {
    query = `
      query GetTeamProjects($teamKey: String!) {
        team(id: $teamKey) {
          projects {
            nodes {
              id
              name
              description
              state
              progress
              targetDate
              createdAt
              lead {
                name
                email
              }

              members {
                nodes {
                  name
                }
              }
            }
          }
        }
      }
    `;
    variables = { teamKey };
  } else {
    query = `
      query GetProjects {
        projects {
          nodes {
            id
            name
            description
            state
            progress
            targetDate
            createdAt
            lead {
              name
              email
            }

            teams {
              nodes {
                key
                name
              }
            }
            members {
              nodes {
                name
              }
            }
          }
        }
      }
    `;
  }
  
  try {
    const data = await makeRequest(query, variables);
    let projects;
    
    if (teamKey) {
      if (!data.team) {
        console.error(`Team '${teamKey}' not found`);
        process.exit(1);
      }
      projects = data.team.projects.nodes;
    } else {
      projects = data.projects.nodes;
    }
    
    // Filter active projects if requested
    if (args.active) {
      projects = projects.filter(p => p.state !== 'completed' && p.state !== 'canceled');
    }
    
    if (args.json) {
      formatOutput(projects, 'json');
      return;
    }
    
    const teamFilter = teamKey ? ` for team ${teamKey}` : '';
    const activeFilter = args.active ? ' (active only)' : '';
    console.log(`Found ${projects.length} projects${teamFilter}${activeFilter}:\n`);
    
    projects.forEach(project => {
      const stateEmoji = {
        'planned': '📋',
        'started': '🚀',
        'paused': '⏸️',
        'completed': '✅',
        'canceled': '❌'
      }[project.state] || '📋';
      
      console.log(`${stateEmoji} ${project.name}`);
      
      if (project.description) {
        console.log(`   ${project.description}`);
      }
      
      console.log(`   State: ${project.state} | Progress: ${project.progress}%`);
      console.log(`   Members: ${project.members.nodes.length}`);
      
      if (project.lead) {
        console.log(`   Lead: ${project.lead.name} (${project.lead.email})`);
      }
      
      if (project.targetDate) {
        console.log(`   Target Date: ${formatDate(project.targetDate)}`);
      }
      
      if (!teamKey && project.teams?.nodes?.length > 0) {
        const teamNames = project.teams.nodes.map(t => `${t.key} (${t.name})`).join(', ');
        console.log(`   Teams: ${teamNames}`);
      }
      
      console.log(`   Created: ${formatDate(project.createdAt)}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();