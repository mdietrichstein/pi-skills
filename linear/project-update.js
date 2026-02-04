#!/usr/bin/env node

/**
 * Create a Linear project update
 * 
 * Usage:
 *   ./project-update.js PROJECT_ID "Update message"
 *   ./project-update.js --project "Project Name" "Update message"
 *   ./project-update.js --json                  # JSON output
 */

import { makeRequest, parseArgs, formatOutput, formatDate } from './linear-api.js';

async function findProjectByName(projectName) {
  const query = `
    query GetProjects {
      projects {
        nodes {
          id
          name
        }
      }
    }
  `;
  
  const data = await makeRequest(query);
  return data.projects.nodes.find(p => 
    p.name.toLowerCase() === projectName.toLowerCase()
  );
}

async function createProjectUpdate(projectId, updateText) {
  const mutation = `
    mutation ProjectUpdateCreate($input: ProjectUpdateCreateInput!) {
      projectUpdateCreate(input: $input) {
        success
        projectUpdate {
          id
          body
          createdAt
          user {
            name
            email
          }
          project {
            id
            name
          }
        }
      }
    }
  `;
  
  const input = {
    projectId: projectId,
    body: updateText
  };
  
  const data = await makeRequest(mutation, { input });
  
  if (!data.projectUpdateCreate.success) {
    throw new Error('Failed to create project update');
  }
  
  return data.projectUpdateCreate.projectUpdate;
}

async function getProjectUpdates(projectId, limit = 5) {
  const query = `
    query GetProjectUpdates($projectId: String!, $first: Int!) {
      project(id: $projectId) {
        name
        projectUpdates(first: $first, orderBy: createdAt) {
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
      }
    }
  `;
  
  const data = await makeRequest(query, { projectId, first: limit });
  return data.project;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  // Handle --list flag
  if (args.list) {
    const projectIdOrName = typeof args.list === 'string' ? args.list : args._positional?.[0];
    if (!projectIdOrName) {
      console.error('Project name or ID required for --list');
      console.error('Example: ./project-update.js --list "Staging Environment"');
      process.exit(1);
    }
    args.projectForList = projectIdOrName;
  }
  
  const projectIdOrName = args.projectForList || args.project || args._positional?.[0];
  const updateText = args._positional?.[args.project ? 0 : 1];
  
  if (!projectIdOrName) {
    console.error('Usage: ./project-update.js <PROJECT_ID_OR_NAME> "<update_message>"');
    console.error('   or: ./project-update.js --project "Project Name" "<update_message>"');
    console.error('   or: ./project-update.js --list PROJECT_ID  # List recent updates');
    console.error('');
    console.error('Examples:');
    console.error('  ./project-update.js "Staging Environment" "Planning setup steps"');
    console.error('  ./project-update.js --list "Staging Environment"');
    process.exit(1);
  }
  
  try {
    // Find project ID if name was provided
    let projectId = projectIdOrName;
    
    // Check if it's a project name (contains spaces or not a UUID)
    if (projectIdOrName.includes(' ') || !/^[a-f0-9-]{36}$/i.test(projectIdOrName)) {
      const project = await findProjectByName(projectIdOrName);
      if (!project) {
        console.error(`Project '${projectIdOrName}' not found`);
        process.exit(1);
      }
      projectId = project.id;
      console.log(`Found project: ${project.name} (${projectId})`);
    }
    
    // List updates if requested
    if (args.list) {
      const projectData = await getProjectUpdates(projectId, args.limit || 10);
      
      if (args.json) {
        formatOutput(projectData, 'json');
        return;
      }
      
      console.log(`\n📋 Recent updates for: ${projectData.name}\n`);
      
      if (projectData.projectUpdates.nodes.length === 0) {
        console.log('No updates found');
        return;
      }
      
      projectData.projectUpdates.nodes.forEach(update => {
        console.log(`📄 ${formatDate(update.createdAt)} - ${update.user.name}`);
        console.log(`   ${update.body}`);
        console.log('');
      });
      
      return;
    }
    
    // Create update
    if (!updateText) {
      console.error('Update message is required');
      console.error('Example: ./project-update.js "Staging Environment" "Planning setup steps"');
      process.exit(1);
    }
    
    console.log('Creating project update...');
    const update = await createProjectUpdate(projectId, updateText);
    
    if (args.json) {
      formatOutput(update, 'json');
    } else {
      console.log('\n✅ Project update created successfully!');
      console.log(`📋 Project: ${update.project.name}`);
      console.log(`👤 Author: ${update.user.name} (${update.user.email})`);
      console.log(`📅 Created: ${formatDate(update.createdAt)}`);
      console.log(`💬 Update: ${update.body}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();