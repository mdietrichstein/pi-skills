#!/usr/bin/env node

/**
 * List Linear teams
 * 
 * Usage:
 *   ./teams.js              # List all teams
 *   ./teams.js --json       # JSON output
 */

import { makeRequest, parseArgs, formatOutput } from './linear-api.js';

const query = `
  query GetTeams {
    teams {
      nodes {
        id
        key
        name
        description
        private
        activeCycle {
          name
          startsAt
          endsAt
        }
      }
    }
  }
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  try {
    const data = await makeRequest(query);
    const teams = data.teams.nodes;
    
    if (args.json) {
      formatOutput(teams, 'json');
      return;
    }
    
    console.log(`Found ${teams.length} teams:\n`);
    
    teams.forEach(team => {
      console.log(`📋 ${team.key} - ${team.name}`);
      if (team.description) {
        console.log(`   ${team.description}`);
      }
      console.log(`   Private: ${team.private ? 'Yes' : 'No'}`);
      
      if (team.activeCycle) {
        console.log(`   Active Cycle: ${team.activeCycle.name}`);
      }
      
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();