---
name: dify
description: Inspect Dify AI workflows, apps, and datasets. List all apps in a workspace, view workflow definitions (nodes, edges, variables), check execution history with inputs/outputs, and explore knowledge bases. Read-only access via the Dify console API.
---

# Dify Workflow Inspection (Read-Only)

Use `curl` to interact with the Dify **console API** (the same API the Dify dashboard uses). This gives read access to all apps in the workspace.

Environment variables: `DIFY_API_URL` (base URL, e.g. `https://dify.example.com`), `DIFY_EMAIL`, `DIFY_PASSWORD`.

**Read-only** — do NOT create, update, delete, or execute anything.

## Authentication

Dify uses **cookie-based auth** with **CSRF protection**. The password must be **base64-encoded** in the login request. The access token is returned as an `__Host-access_token` cookie, and a `__Host-csrf_token` cookie must be sent as an `X-Csrf-Token` header on all subsequent requests.

### Step 1: Login (saves cookies to a cookie jar file)

```bash
B64_PASS=$(echo -n "$DIFY_PASSWORD" | base64)
curl -s -c /tmp/dify_cookies.txt -X POST "${DIFY_API_URL}/console/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${DIFY_EMAIL}\", \"password\": \"${B64_PASS}\"}"
```

### Step 2: Extract CSRF token for subsequent requests

```bash
DIFY_CSRF=$(grep '__Host-csrf_token' /tmp/dify_cookies.txt | awk '{print $NF}')
echo "CSRF token: ${DIFY_CSRF:0:20}..."
```

### Making authenticated requests

All API calls must include the cookie jar (`-b /tmp/dify_cookies.txt`) and the CSRF header:

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/..."
```

If a request returns 401, re-run the login + CSRF extraction steps to refresh the session.

## List & Search Apps

### List all apps in the workspace

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps?page=1&limit=100" | jq '.data[] | {id, name, mode, description, created_at}'
```

### Search apps by name

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps?page=1&limit=100&name=search-term" | jq '.data[] | {id, name, mode, description}'
```

App modes: `workflow`, `chat`, `completion`, `agent-chat`, `advanced-chat`

### Get app details

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}" | jq '{id, name, mode, description, created_at, updated_at}'
```

## Workflow Definitions

### Get full workflow definition (nodes, edges, variables)

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}/workflows/draft" | jq '.graph'
```

### List all nodes with types

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}/workflows/draft" | jq '.graph.nodes[] | {id, data: {title, type}}'
```

### List edges (connections between nodes)

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}/workflows/draft" | jq '.graph.edges[] | {source, target, sourceHandle, targetHandle}'
```

### Get workflow input variables (start node)

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}/workflows/draft" | jq '.graph.nodes[] | select(.data.type == "start") | .data.variables'
```

### Get workflow output variables (end node)

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}/workflows/draft" | jq '.graph.nodes[] | select(.data.type == "end") | .data.outputs'
```

## Inspect Specific Nodes

### Find node by title

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}/workflows/draft" | jq '.graph.nodes[] | select(.data.title == "Node Name")'
```

### Find nodes by type

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}/workflows/draft" | jq '.graph.nodes[] | select(.data.type == "llm")'
```

Common node types: `start`, `end`, `llm`, `code`, `http-request`, `knowledge-retrieval`, `if-else`, `variable-aggregator`, `template-transform`, `question-classifier`, `parameter-extractor`, `iteration`, `tool`

### Read LLM node prompts

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}/workflows/draft" | jq '.graph.nodes[] | select(.data.type == "llm") | {title: .data.title, model: .data.model, prompt_template: .data.prompt_template}'
```

### Read code node source

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}/workflows/draft" | jq '.graph.nodes[] | select(.data.type == "code") | {title: .data.title, code: .data.code, code_language: .data.code_language}'
```

### Read HTTP request node config

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}/workflows/draft" | jq '.graph.nodes[] | select(.data.type == "http-request") | {title: .data.title, url: .data.url, method: .data.method}'
```

## Execution History

### List recent workflow runs

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}/workflow-runs?page=1&limit=20" | jq '.data[] | {id, status, created_at, elapsed_time, total_tokens}'
```

### Get a specific run with inputs/outputs

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}/workflow-runs/{run_id}" | jq '{id, status, inputs, outputs, elapsed_time, total_tokens, total_steps}'
```

### Get node executions for a run (step-by-step trace)

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/apps/{app_id}/workflow-runs/{run_id}/node-executions" | jq '.data[] | {node_id, title, node_type, status, inputs, outputs, elapsed_time}'
```

## Datasets (Knowledge Bases)

### List all datasets

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/datasets?page=1&limit=100" | jq '.data[] | {id, name, description, document_count, word_count}'
```

### List documents in a dataset

```bash
curl -s -b /tmp/dify_cookies.txt -H "X-Csrf-Token: ${DIFY_CSRF}" \
  "${DIFY_API_URL}/console/api/datasets/{dataset_id}/documents?page=1&limit=100" | jq '.data[] | {id, name, word_count, tokens, enabled, created_at}'
```

## Tips

- Always login first to get cookies before making any other calls
- **Password must be base64-encoded** in the login request body
- **Auth is cookie-based** — use `-c` (save) and `-b` (send) with a cookie jar file
- **CSRF token is required** — extract `__Host-csrf_token` from the cookie jar and send it as `X-Csrf-Token` header
- If you get a 401, re-login — the access token expires after ~1 hour
- The workflow graph is at `/console/api/apps/{app_id}/workflows/draft` — this is the current draft version
- Use `jq` to filter — workflow definitions can be very large
- Node connections flow `source` → `target` in edges
- LLM nodes: prompt in `.data.prompt_template` or `.data.text`
- Code nodes: source in `.data.code`
- HTTP nodes: `.data.url`, `.data.method`, `.data.headers`, `.data.body`
- To understand a workflow: start with node list + edges for the flow, then drill into individual nodes
- This skill is **read-only** — never POST/PUT/DELETE to modify apps, workflows, or datasets
