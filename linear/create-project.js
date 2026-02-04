#!/usr/bin/env node

/**
 * Create a new Linear project
 * 
 * Usage:
 *   ./create-project.js --name "Project Name" --team TEAM_KEY
 *   ./create-project.js --name "Q1 Goals" --team ENG --description "Quarterly objectives"
 *   ./create-project.js --name "Feature X" --team ENG --lead email@domain.com
 */

import { makeRequest, parseArgs, getUserId, formatOutput } from './linear-api.js';

async function getTeams() {
  const query = `
    query GetTeams {
      teams {
        nodes {
          id
          key
          name
        }
      }
    }
  `;
  
  const data = await makeRequest(query);
  return data.teams.nodes;
}

async function createProject(projectData) {
  let leadId = null;
  
  if (projectData.leadEmail) {
    leadId = await getUserId(projectData.leadEmail);
    if (!leadId) {
      console.error(`User with email '${projectData.leadEmail}' not found`);
      process.exit(1);
    }
  }
  
  const mutation = `
    mutation CreateProject($input: ProjectCreateInput!) {
      projectCreate(input: $input) {
        success
        project {
          id
          name
          description
          state
          url
          teams {
            nodes {
              key
              name
            }
          }
          lead {
            name
            email
          }
          createdAt
        }
      }
    }
  `;
  
  const input = {
    name: projectData.name,
    teamIds: [projectData.teamId]
  };
  
  if (projectData.description) {
    input.description = projectData.description;
  }
  
  if (leadId) {
    input.leadId = leadId;
  }
  
  if (projectData.targetDate) {
    input.targetDate = projectData.targetDate;
  }
  
  const data = await makeRequest(mutation, { input });
  
  if (!data.projectCreate.success) {
    throw new Error('Failed to create project');
  }
  
  return data.projectCreate.project;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (!args.name || !args.team) {
    console.error('Usage: ./create-project.js --name "Project Name" --team TEAM_KEY');
    console.error('');
    console.error('Options:');
    console.error('  --name <name>           Project name (required)');
    console.error('  --team <team_key>       Team key (required)');
    console.error('  --description <desc>    Project description');
    console.error('  --lead <email>          Project lead email');
    console.error('  --target-date <date>    Target completion date (YYYY-MM-DD)');
    console.error('');
    console.error('Example: ./create-project.js --name "Mobile App v2.0" --team ENG --lead john@company.com');
    process.exit(1);
  }
  
  try {
    // Find the team
    const teams = await getTeams();
    const team = teams.find(t => t.key.toLowerCase() === args.team.toLowerCase());
    
    if (!team) {
      console.error(`Team '${args.team}' not found`);
      console.error('Available teams:');
      teams.forEach(t => console.error(`  ${t.key} - ${t.name}`));
      process.exit(1);
    }
    
    console.log(`Creating project in team: ${team.key} - ${team.name}\n`);
    
    const projectData = {
      name: args.name,
      description: args.description,
      leadEmail: args.lead,
      teamId: team.id
    };
    
    // Parse target date if provided
    if (args['target-date']) {
      const targetDate = new Date(args['target-date']);
      if (isNaN(targetDate.getTime())) {
        console.error('Invalid target date format. Use YYYY-MM-DD');
        process.exit(1);
      }
      projectData.targetDate = targetDate.toISOString();
    }
    
    console.log('Creating project...');
    const project = await createProject(projectData);
    
    if (args.json) {
      formatOutput(project, 'json');
    } else {
      console.log('\n✅ Project created successfully!');
      console.log(`📁 ${project.name}`);
      
      if (project.description) {
        console.log(`Description: ${project.description}`);
      }
      
      console.log(`State: ${project.state}`);
      
      const teamNames = project.teams.nodes.map(t => `${t.key} (${t.name})`).join(', ');
      console.log(`Teams: ${teamNames}`);
      
      if (project.lead) {
        console.log(`Lead: ${project.lead.name} (${project.lead.email})`);
      }
      
      console.log(`Created: ${new Date(project.createdAt).toLocaleDateString()}`);
      console.log(`URL: ${project.url}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();