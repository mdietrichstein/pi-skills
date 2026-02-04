#!/usr/bin/env node

/**
 * Update Linear project properties
 * 
 * Usage:
 *   ./update-project.js PROJECT_NAME --description "New description"
 */

import { makeRequest, parseArgs, formatOutput } from './linear-api.js';

async function findProjectByName(projectName) {
  const query = `
    query GetProjects {
      projects {
        nodes {
          id
          name
          description
        }
      }
    }
  `;
  
  const data = await makeRequest(query);
  return data.projects.nodes.find(p => 
    p.name.toLowerCase() === projectName.toLowerCase()
  );
}

async function updateProject(projectId, updates) {
  const mutation = `
    mutation ProjectUpdate($id: String!, $input: ProjectUpdateInput!) {
      projectUpdate(id: $id, input: $input) {
        success
        project {
          id
          name
          description
          state
          updatedAt
        }
      }
    }
  `;
  
  const data = await makeRequest(mutation, { id: projectId, input: updates });
  
  if (!data.projectUpdate.success) {
    throw new Error('Failed to update project');
  }
  
  return data.projectUpdate.project;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectName = args._positional?.[0];
  
  if (!projectName) {
    console.error('Usage: ./update-project.js "Project Name" --description "New description"');
    process.exit(1);
  }
  
  try {
    const project = await findProjectByName(projectName);
    if (!project) {
      console.error(`Project '${projectName}' not found`);
      process.exit(1);
    }
    
    const updates = {};
    
    if (args.description) {
      updates.description = args.description;
      console.log(`Updating description for: ${project.name}`);
    }
    
    if (Object.keys(updates).length === 0) {
      console.error('No updates specified. Use --description');
      process.exit(1);
    }
    
    const updatedProject = await updateProject(project.id, updates);
    
    if (args.json) {
      formatOutput(updatedProject, 'json');
    } else {
      console.log('\n✅ Project updated successfully!');
      console.log(`📋 ${updatedProject.name}`);
      console.log(`📝 Description: ${updatedProject.description}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
