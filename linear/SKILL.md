---
name: linear
description: Linear project management integration. Create, search, update issues, manage projects and teams, track progress. Use for project management and issue tracking tasks.
---

# Linear Project Management

Command-line interface for Linear project management operations using the Linear GraphQL API.

## Setup

Install dependencies (run once):

```bash
cd {baseDir}
npm install
```

**Required:** Get your Linear API key with write permissions:

1. Go to [Linear Settings → API](https://linear.app/settings/api)
2. Create a new Personal API Key
3. **Important:** Ensure the key has `write` scope for creating/updating issues and projects
4. Add to your environment:

```bash
export LINEAR_API_KEY="your-api-key-here"
```

Or create `.env` file in the skill directory:
```bash
LINEAR_API_KEY=your-api-key-here
```

## Commands

### List Teams

```bash
{baseDir}/teams.js                    # List all teams
{baseDir}/teams.js --json             # JSON output
```

### List Projects

```bash
{baseDir}/projects.js                 # List all projects
{baseDir}/projects.js TEAM_KEY        # Projects for specific team
{baseDir}/projects.js --active        # Only active projects
```

### Search Issues

```bash
{baseDir}/issues.js                   # List recent issues
{baseDir}/issues.js --team TEAM_KEY   # Issues from specific team
{baseDir}/issues.js --status backlog  # Filter by status (backlog, todo, in_progress, done, canceled)
{baseDir}/issues.js --assignee email  # Issues assigned to user
{baseDir}/issues.js --project PROJECT_ID  # Issues in specific project
{baseDir}/issues.js --search "text"   # Text search in title/description
{baseDir}/issues.js --limit 50        # Limit results (default: 20)
```

### Get Issue Details

```bash
{baseDir}/issue.js ISSUE_ID           # Get full issue details
{baseDir}/issue.js TEAM-123           # Using issue identifier
```

### Create Issue

```bash
{baseDir}/create-issue.js             # Interactive creation
{baseDir}/create-issue.js --title "Bug fix" --team TEAM_KEY
{baseDir}/create-issue.js --title "Feature" --team TEAM_KEY --assignee email@domain.com
{baseDir}/create-issue.js --title "Task" --description "Details" --priority high
{baseDir}/create-issue.js --title "Bug Report" --team TEAM_KEY --attachment "/path/to/screenshot.png"
{baseDir}/create-issue.js --title "Feature" --team TEAM_KEY --attachment "/path/to/mockup.png" --attachment "https://example.com/spec.pdf"
```

### Update Issue

```bash
{baseDir}/update-issue.js ISSUE_ID --status "In Progress"
{baseDir}/update-issue.js ISSUE_ID --assignee email@domain.com  
{baseDir}/update-issue.js ISSUE_ID --priority high
{baseDir}/update-issue.js ISSUE_ID --title "New title"
{baseDir}/update-issue.js ISSUE_ID --attachment "https://example.com/file.png"
{baseDir}/update-issue.js ISSUE_ID --attachment "https://example.com/log.txt" --attachment "https://example.com/config.json"
```

### Delete Issue

```bash
{baseDir}/delete-issue.js ISSUE_ID        # Delete issue (move to trash)
{baseDir}/delete-issue.js MA-123          # Delete by identifier
```

⚠️ **Warning**: Deleted issues are moved to trash and can be restored via Linear web interface.

### Create Project

```bash
{baseDir}/create-project.js --name "Project Name" --team TEAM_KEY
{baseDir}/create-project.js --name "Q1 Goals" --team TEAM_KEY --description "Quarterly objectives"
```

### Project Updates

```bash
{baseDir}/project-update.js "Project Name" "Status update message"
{baseDir}/project-update.js --project "Staging Environment" "Planning phase complete"
{baseDir}/project-update.js --list "Project Name"           # List recent updates
```

### View User Info

```bash
{baseDir}/user.js                     # Current user info
{baseDir}/user.js email@domain.com    # Specific user info
```

## Status Values

Common issue status values:
- `backlog` - In backlog
- `todo` - Todo  
- `in_progress` - In progress
- `done` - Done/completed
- `canceled` - Canceled

## Priority Values

- `no_priority` - No priority (default)
- `urgent` - Urgent
- `high` - High priority
- `medium` - Medium priority
- `low` - Low priority

## File Attachments

Both `create-issue.js` and `update-issue.js` support file attachments with different capabilities:

### Auto-Resizing Image Embedding (create-issue & update-issue)

Local images of any size are automatically resized and embedded as base64 data URIs in issue descriptions:

```bash
# Auto-resize and embed any local image (create or update)
{baseDir}/create-issue.js --title "Bug Report" --team TEAM_KEY --attachment "/path/to/large-screenshot.png"
{baseDir}/update-issue.js TEAM-123 --attachment "/path/to/large-screenshot.png"

# Mixed: auto-resized image + URL attachment
{baseDir}/create-issue.js --title "Feature Request" --team TEAM_KEY \
  --attachment "/path/to/huge-mockup.png" \
  --attachment "https://example.com/requirements.pdf"
```

**Description Handling:**
- ✅ **update-issue**: Images are appended to existing description (preserves original content)
- ✅ **Mixed updates**: Combine description changes with image additions
- 🔍 **Feedback**: Shows "📄 Preserving existing description" when appending to existing content

**Auto-Resizing Features:**
- ✅ **Any size image**: Automatically resized to fit under 90KB
- ✅ **Smart optimization**: Progressive quality and dimension reduction
- ✅ **Format preservation**: Maintains original format when possible
- ✅ **Quality feedback**: Shows resize steps and final size

**Requirements:**
- Sharp library (auto-installed with: `npm install sharp`)

### External URL Attachments

Both create and update support URL-based attachments via Linear's attachment system:

```bash
# URL attachments (works with both create and update)
{baseDir}/create-issue.js --title "Bug Report" --team TEAM_KEY --attachment "https://example.com/screenshot.png"
{baseDir}/update-issue.js TEAM-123 --attachment "https://example.com/logs.txt"
```

### Supported File Types

- **Images**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`
- **Documents**: `.pdf`, `.doc`, `.docx`, `.txt`, `.md`, `.json`
- **Other**: `.zip`, `.xls`, `.xlsx` and more

### How Different Attachments Work

| Attachment Type | create-issue | update-issue | Result |
|---|---|---|---|
| Local image (any size) | ✅ Auto-resize + embed | ✅ Auto-resize + embed | Resized & embedded in description |
| Local non-image | ❌ Instructions only | ❌ Instructions only | External hosting needed |
| External URL | ✅ Attachment record | ✅ Attachment record | Linear attachment section |

**Auto-Resize Process:**
1. 🔍 **Analyze**: Check image size and format
2. 📏 **Resize**: Progressive dimension reduction (800px → 640px → 512px...)  
3. 🎨 **Optimize**: Quality adjustment (80% → 65% → 50%...)
4. ✅ **Embed**: Convert to base64 data URI when under 90KB

### Best Practices

1. **Any screenshots**: Use local paths with both `create-issue.js` and `update-issue.js` - auto-resizing handles everything!
2. **Documents/files**: Always use external hosting with URLs  
3. **Batch operations**: Mix local images + external URLs in single command
4. **Large images**: No worries - auto-resizing optimizes them perfectly

### Installation Requirements

For auto-resizing functionality:
```bash
cd /path/to/linear/skill
npm install sharp
```

**Without Sharp**: Shows manual resize instructions  
**With Sharp**: Automatic resizing of any image size ✨

## Auto-Resizing Examples

```bash
# 2.5MB screenshot → auto-resized to 65KB and embedded
{baseDir}/create-issue.js --title "Layout Bug" --team DESIGN \
  --attachment "/Users/you/Desktop/huge-screenshot.png"

# Console output:
# 📏 Image is 2518.9KB, attempting to resize...
# 📏 Resize attempt 1: 800px, quality 80% = 150.0KB
# 📏 Resize attempt 2: 640px, quality 80% = 99.3KB  
# 📏 Resize attempt 3: 512px, quality 80% = 65.2KB
# ✅ Image resized successfully to 65.2KB
# ✅ Embedded image: huge-screenshot.png

# 38MB plasma image → auto-resized to 74KB and embedded  
{baseDir}/create-issue.js --title "Graphics Test" --team ENG \
  --attachment "/tmp/massive-artwork.png"

# Console output:
# 📏 Image is 38557.0KB, attempting to resize...
# 📏 Resize attempt 1: 800px, quality 80% = 401.3KB
# 📏 Resize attempt 2: 640px, quality 80% = 251.3KB
# 📏 Resize attempt 3: 512px, quality 80% = 170.3KB  
# 📏 Resize attempt 4: 409px, quality 80% = 109.6KB
# 📏 Resize attempt 5: 327px, quality 80% = 74.0KB
# ✅ Image resized successfully to 74.0KB
```

## Output Formats

All commands support:
- `--json` - JSON output for programmatic use
- `--csv` - CSV output for spreadsheets
- `--quiet` - Minimal output (IDs only)

## Examples

### Daily Workflow

```bash
# Check your assigned issues
{baseDir}/issues.js --assignee your-email@company.com --status todo

# Create a new issue with any-size screenshot (auto-resized and embedded!)
{baseDir}/create-issue.js --title "Fix login bug" --team ENG --priority high \
  --attachment "/path/to/huge-screenshot.png"

# Update issue status and add external logs
{baseDir}/update-issue.js ENG-123 --status "in_progress" --attachment "https://logs.example.com/debug.log"

# Search for related issues
{baseDir}/issues.js --search "login" --team ENG
```

### Project Management

```bash
# Create a new project
{baseDir}/create-project.js --name "Mobile App v2.0" --team ENG

# List project issues
{baseDir}/issues.js --project PROJECT_ID --status todo

# Track team progress
{baseDir}/issues.js --team ENG --status in_progress
```

### Reporting

```bash
# Export team issues to CSV
{baseDir}/issues.js --team ENG --csv > team-issues.csv

# Get issue details for reporting
{baseDir}/issue.js ENG-123 --json | jq '.priority, .status'
```

## Error Handling

- Check API key is set: `echo $LINEAR_API_KEY`
- Verify team keys: `{baseDir}/teams.js`
- Check issue IDs: issues follow format `TEAM-NUMBER` (e.g., `ENG-123`)
- Rate limiting: API calls are automatically throttled

## Common Issues

**Invalid team key:** Use `{baseDir}/teams.js` to list valid team keys.

**Permission denied:** Ensure your API key has appropriate workspace permissions.

**Issue not found:** Verify the issue ID format and that the issue exists in your workspace.

**Rate limited:** The skill automatically handles rate limits with exponential backoff.