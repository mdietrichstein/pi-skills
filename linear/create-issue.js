#!/usr/bin/env node

/**
 * Create a new Linear issue
 * 
 * Usage:
 *   ./create-issue.js                                    # Interactive creation
 *   ./create-issue.js --title "Bug fix" --team ENG      # Quick creation
 *   ./create-issue.js --title "Feature" --team ENG --assignee email@domain.com
 *   ./create-issue.js --title "Task" --description "Details" --priority high
 *   ./create-issue.js --title "Bug" --team ENG --attachment "https://example.com/file.png"
 *   ./create-issue.js --title "Bug" --team ENG --attachment "https://example.com/file1.png" --attachment "https://example.com/file2.pdf"
 */

import { makeRequest, parseArgs, getUserId, formatOutput, processLocalImagesForDescription, createAttachment } from './linear-api.js';
import { createInterface } from 'readline';
import path from 'path';

const priorities = {
  'urgent': 1,
  'high': 2,
  'medium': 3,
  'low': 4,
  'none': 0
};

async function promptInput(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

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

async function getTeamStates(teamId) {
  const query = `
    query GetTeamStates($teamId: String!) {
      team(id: $teamId) {
        states {
          nodes {
            id
            name
            type
          }
        }
      }
    }
  `;
  
  const data = await makeRequest(query, { teamId });
  return data.team.states.nodes;
}

async function interactiveMode() {
  console.log('🚀 Creating a new Linear issue\n');
  
  // Get teams
  const teams = await getTeams();
  console.log('Available teams:');
  teams.forEach((team, i) => {
    console.log(`  ${i + 1}. ${team.key} - ${team.name}`);
  });
  
  const teamChoice = await promptInput('\nSelect team (number or key): ');
  let selectedTeam;
  
  if (/^\d+$/.test(teamChoice)) {
    const index = parseInt(teamChoice) - 1;
    selectedTeam = teams[index];
  } else {
    selectedTeam = teams.find(t => t.key.toLowerCase() === teamChoice.toLowerCase());
  }
  
  if (!selectedTeam) {
    console.error('Invalid team selection');
    process.exit(1);
  }
  
  console.log(`Selected team: ${selectedTeam.key} - ${selectedTeam.name}\n`);
  
  const title = await promptInput('Issue title: ');
  if (!title) {
    console.error('Title is required');
    process.exit(1);
  }
  
  const description = await promptInput('Description (optional): ');
  const priorityInput = await promptInput('Priority (urgent/high/medium/low/none, default: none): ');
  const assigneeEmail = await promptInput('Assignee email (optional): ');
  
  const priority = priorities[priorityInput.toLowerCase()] ?? 0;
  
  return {
    title,
    description: description || undefined,
    priority,
    assigneeEmail: assigneeEmail || undefined,
    teamId: selectedTeam.id
  };
}

async function createIssue(issueData) {
  let assigneeId = null;
  
  if (issueData.assigneeEmail) {
    assigneeId = await getUserId(issueData.assigneeEmail);
    if (!assigneeId) {
      console.error(`User with email '${issueData.assigneeEmail}' not found`);
      process.exit(1);
    }
  }
  
  // Process local images for embedding and separate URL attachments
  let description = issueData.description || '';
  let urlAttachments = [];
  
  if (issueData.attachments && issueData.attachments.length > 0) {
    const { markdown, remaining } = await processLocalImagesForDescription(issueData.attachments);
    
    // Add embedded images to description
    description += markdown;
    
    // Keep URL attachments for later processing
    urlAttachments = remaining.filter(att => att.startsWith('http://') || att.startsWith('https://'));
  }
  
  // Get team states to find the default state
  const states = await getTeamStates(issueData.teamId);
  const defaultState = states.find(s => s.type === 'unstarted') || states[0];
  
  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          url
          state {
            name
          }
          team {
            key
            name
          }
        }
      }
    }
  `;
  
  const input = {
    title: issueData.title,
    teamId: issueData.teamId,
    stateId: defaultState.id,
    priority: issueData.priority
  };
  
  if (description.trim()) {
    input.description = description;
  }
  
  if (assigneeId) {
    input.assigneeId = assigneeId;
  }
  
  const data = await makeRequest(mutation, { input });
  
  if (!data.issueCreate.success) {
    throw new Error('Failed to create issue');
  }
  
  const issue = data.issueCreate.issue;
  
  // Process URL attachments after issue creation
  const attachmentResults = [];
  for (const urlAttachment of urlAttachments) {
    try {
      console.log(`📎 Creating attachment for ${urlAttachment}...`);
      const filename = path.basename(new URL(urlAttachment).pathname) || 'Attachment';
      const attachmentId = await createAttachment(issue.id, filename, urlAttachment);
      attachmentResults.push(`✅ Created attachment: ${filename}`);
      console.log(`✅ Created attachment: ${filename} (${attachmentId})`);
    } catch (error) {
      console.error(`❌ Failed to create attachment for ${urlAttachment}: ${error.message}`);
      attachmentResults.push(`❌ Failed: ${path.basename(urlAttachment)} - ${error.message}`);
    }
  }
  
  if (attachmentResults.length > 0) {
    issue._attachmentResult = '\n\n**📎 URL Attachment Results:**\n' + attachmentResults.join('\n');
  }
  
  return issue;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  try {
    let issueData;
    
    if (args.title && args.team) {
      // Non-interactive mode
      const teams = await getTeams();
      const team = teams.find(t => t.key.toLowerCase() === args.team.toLowerCase());
      
      if (!team) {
        console.error(`Team '${args.team}' not found`);
        console.error('Available teams:');
        teams.forEach(t => console.error(`  ${t.key} - ${t.name}`));
        process.exit(1);
      }
      
      const priority = args.priority ? (priorities[args.priority.toLowerCase()] ?? 0) : 0;
      
      // Handle attachments - support multiple files
      let attachments = [];
      if (args.attachment) {
        if (Array.isArray(args.attachment)) {
          attachments = args.attachment;
        } else {
          attachments = [args.attachment];
        }
      }
      
      issueData = {
        title: args.title,
        description: args.description,
        priority,
        assigneeEmail: args.assignee,
        teamId: team.id,
        attachments
      };
    } else {
      // Interactive mode
      issueData = await interactiveMode();
    }
    
    console.log('\nCreating issue...');
    const issue = await createIssue(issueData);
    
    if (args.json) {
      formatOutput(issue, 'json');
    } else {
      console.log('\n✅ Issue created successfully!');
      console.log(`📋 ${issue.identifier} - ${issue.title}`);
      console.log(`Team: ${issue.team.key} (${issue.team.name})`);
      console.log(`Status: ${issue.state.name}`);
      console.log(`URL: ${issue.url}`);
      
      // Display attachment results if any
      if (issue._attachmentResult) {
        console.log(issue._attachmentResult);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();