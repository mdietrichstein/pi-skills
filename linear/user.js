#!/usr/bin/env node

/**
 * Get Linear user information
 * 
 * Usage:
 *   ./user.js                    # Current user info
 *   ./user.js email@domain.com   # Specific user info
 *   ./user.js --json             # JSON output
 */

import { makeRequest, parseArgs, formatOutput, formatDate } from './linear-api.js';

async function getCurrentUser() {
  const query = `
    query GetCurrentUser {
      viewer {
        id
        name
        displayName
        email
        avatarUrl
        active
        admin
        guest
        createdAt
        lastSeen
        timezone
        organization {
          name
          urlKey
        }
        assignedIssues {
          nodes {
            id
            identifier
            title
            state {
              name
            }
          }
        }
        createdIssues {
          nodes {
            id
            identifier
            title
            state {
              name
            }
          }
        }
        teamMemberships {
          nodes {
            team {
              key
              name
            }
          }
        }
      }
    }
  `;
  
  const data = await makeRequest(query);
  return data.viewer;
}

async function getUserByEmail(email) {
  const query = `
    query GetUsers {
      users {
        nodes {
          id
          name
          displayName
          email
          avatarUrl
          active
          admin
          guest
          createdAt
          lastSeen
          timezone
          assignedIssues {
            nodes {
              id
              identifier
              title
              state {
                name
              }
            }
          }
          createdIssues {
            nodes {
              id
              identifier
              title
              state {
                name
              }
            }
          }
          teamMemberships {
            nodes {
              team {
                key
                name
              }
            }
          }
        }
      }
    }
  `;
  
  const data = await makeRequest(query);
  return data.users.nodes.find(u => u.email.toLowerCase() === email.toLowerCase());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = args._positional?.[0];
  
  try {
    let user;
    
    if (email) {
      user = await getUserByEmail(email);
      if (!user) {
        console.error(`User with email '${email}' not found`);
        process.exit(1);
      }
    } else {
      user = await getCurrentUser();
    }
    
    if (args.json) {
      formatOutput(user, 'json');
      return;
    }
    
    console.log(`\n👤 ${user.displayName || user.name}`);
    
    if (user.organization) {
      console.log(`Organization: ${user.organization.name} (${user.organization.urlKey})`);
    }
    
    console.log(`Email: ${user.email}`);
    
    const roles = [];
    if (user.admin) roles.push('Admin');
    if (user.guest) roles.push('Guest');
    if (!user.active) roles.push('Inactive');
    if (roles.length > 0) {
      console.log(`Roles: ${roles.join(', ')}`);
    }
    
    if (user.timezone) {
      console.log(`Timezone: ${user.timezone}`);
    }
    
    console.log(`Member since: ${formatDate(user.createdAt)}`);
    
    if (user.lastSeen) {
      console.log(`Last seen: ${formatDate(user.lastSeen)}`);
    }
    
    // Team memberships
    if (user.teamMemberships.nodes.length > 0) {
      console.log('\nTeam Memberships:');
      user.teamMemberships.nodes.forEach(membership => {
        console.log(`  🏢 ${membership.team.key} - ${membership.team.name}`);
      });
    }
    
    // Assigned issues
    const activeAssignedIssues = user.assignedIssues.nodes.filter(i => 
      i.state.name !== 'Done' && i.state.name !== 'Canceled'
    );
    
    if (activeAssignedIssues.length > 0) {
      console.log('\nActive Assigned Issues:');
      activeAssignedIssues.slice(0, 10).forEach(issue => {
        console.log(`  📋 ${issue.identifier} - ${issue.title} (${issue.state.name})`);
      });
      
      if (activeAssignedIssues.length > 10) {
        console.log(`  ... and ${activeAssignedIssues.length - 10} more`);
      }
    }
    
    // Created issues stats
    const totalCreatedIssues = user.createdIssues.nodes.length;
    const recentCreatedIssues = user.createdIssues.nodes.slice(0, 5);
    
    if (totalCreatedIssues > 0) {
      console.log(`\nIssues Created: ${totalCreatedIssues} total`);
      
      if (recentCreatedIssues.length > 0) {
        console.log('Recent Issues:');
        recentCreatedIssues.forEach(issue => {
          console.log(`  📝 ${issue.identifier} - ${issue.title} (${issue.state.name})`);
        });
      }
    }
    
    console.log('');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();