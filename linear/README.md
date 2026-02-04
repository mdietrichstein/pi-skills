# Linear Project Management Skill

A comprehensive Linear integration for pi that provides project management capabilities via Linear's GraphQL API.

## Features

- **Teams**: List and manage teams
- **Projects**: Create and list projects
- **Issues**: Create, search, update, and view detailed issue information
- **Users**: Get user information and assignments
- **Flexible Output**: Support for table, JSON, and CSV output formats

## Quick Start

1. **Install dependencies:**
   ```bash
   cd ~/.pi/agent/skills/linear
   npm install
   ```

2. **Get your Linear API key:**
   - Go to [Linear Settings → API](https://linear.app/settings/api)
   - Create a new Personal API Key
   - Copy the key

3. **Set up environment:**
   ```bash
   export LINEAR_API_KEY="your-api-key-here"
   ```
   
   Or create a `.env` file:
   ```bash
   cp .env.example .env
   # Edit .env and add your API key
   ```

4. **Test the setup:**
   ```bash
   ./teams.js
   ```

## Commands Reference

### Teams
```bash
./teams.js                    # List all teams
./teams.js --json             # JSON output
```

### Projects
```bash
./projects.js                 # List all projects
./projects.js TEAM_KEY        # Projects for specific team
./projects.js --active        # Only active projects
```

### Issues
```bash
# Search and filter
./issues.js                   # List recent issues
./issues.js --team ENG        # Issues from specific team
./issues.js --status todo     # Filter by status
./issues.js --assignee email  # Issues assigned to user
./issues.js --search "bug"    # Text search

# Get details
./issue.js ENG-123            # Full issue details

# Create new
./create-issue.js             # Interactive creation
./create-issue.js --title "Fix bug" --team ENG --priority high

# Update existing
./update-issue.js ENG-123 --status "In Progress"
./update-issue.js ENG-123 --assignee email@domain.com
```

### Projects
```bash
./create-project.js --name "Project Name" --team ENG
./create-project.js --name "Q1 Goals" --team ENG --description "Objectives"
```

### Users
```bash
./user.js                     # Current user info
./user.js email@domain.com    # Specific user info
```

## Output Formats

All commands support multiple output formats:
- **Default**: Human-readable table format
- **`--json`**: JSON format for programmatic use
- **`--csv`**: CSV format for spreadsheets

## Common Workflows

### Daily Issue Management
```bash
# Check your assigned issues
./issues.js --assignee your-email@company.com --status todo

# Create a new issue
./create-issue.js --title "Fix login bug" --team ENG --priority high

# Move issue to in progress
./update-issue.js ENG-123 --status "in_progress"

# Get issue details
./issue.js ENG-123
```

### Project Planning
```bash
# Create a new project
./create-project.js --name "Mobile App v2.0" --team ENG --lead john@company.com

# List team projects
./projects.js ENG --active

# Create issues for the project
./create-issue.js --title "Setup authentication" --team ENG --project PROJECT_ID
```

### Team Management
```bash
# List teams
./teams.js

# View team member assignments
./issues.js --team ENG --status in_progress

# Check user workload
./user.js team-member@company.com
```

### Reporting
```bash
# Export team issues to CSV
./issues.js --team ENG --csv > team-issues.csv

# Get project status
./projects.js ENG --json | jq '.[] | {name, state, progress}'

# Team velocity report
./issues.js --team ENG --status done --limit 100 --csv
```

## Status Values

Linear uses different status types:
- `backlog` - In backlog
- `todo` / `unstarted` - Todo
- `in_progress` / `started` - In progress  
- `done` / `completed` - Done
- `canceled` - Canceled

## Priority Values

- `urgent` - Urgent (1)
- `high` - High priority (2)
- `medium` - Medium priority (3)
- `low` - Low priority (4)
- `none` - No priority (0)

## Error Handling

The skill includes comprehensive error handling:
- API authentication validation
- Rate limiting with automatic retry
- Input validation
- Helpful error messages with suggestions

## Troubleshooting

**"LINEAR_API_KEY is required"**
- Ensure your API key is set in environment or `.env` file
- Verify the key is valid at [Linear Settings](https://linear.app/settings/api)

**"Team 'XXX' not found"**
- Use `./teams.js` to list available teams
- Team keys are case-insensitive

**"Issue not found"**
- Verify issue identifier format (TEAM-123)
- Ensure you have access to the issue

**Rate limited**
- The skill automatically handles rate limits
- Linear API has generous rate limits for normal use

## API Reference

This skill uses Linear's GraphQL API. For advanced usage, refer to:
- [Linear API Documentation](https://developers.linear.app/docs/graphql/working-with-the-graphql-api)
- [Linear GraphQL Schema](https://studio.apollographql.com/public/Linear-API/variant/current/home)