# Commands Learned

## Docker

| Command | What It Does |
|---------|-------------|
| `docker compose up` | Starts all containers. Reads `docker-compose.yml` and launches everything defined inside. |
| `docker compose up --build` | Same as above, but also rebuilds images first. Use when you changed the Dockerfile or requirements.txt. |
| `docker compose down` | Stops and removes all containers, but keeps volumes (database data survives). |
| `docker compose build --no-cache` | Rebuilds images from scratch, ignoring cached layers. Use when pip cache is corrupted. |
| `docker ps` | Shows all currently running containers. If empty, nothing is running. |
| `docker compose logs` | Shows logs from all services without starting them. Useful for debugging. |
| `docker compose logs api` | Shows logs for only the `api` service. |

## Git

| Command | What It Does |
|---------|-------------|
| `git status` | Shows which files are changed, staged, or untracked. |
| `git add -A` | Stages all changes (new, modified, deleted files). |
| `git commit -m "message"` | Saves staged changes as a commit with a description. |
| `git push` | Uploads commits to GitHub. |
| `git pull` | Downloads commits from GitHub (only needed on a different machine). |

## Testing the API

| Command | What It Does |
|---------|-------------|
| `curl http://localhost:8000/health` | Checks if the FastAPI app is running. Should return `{"status":"ok"}`. |
| `curl -X POST url -H "Content-Type: application/json" -d "{...}"` | Sends a POST request with JSON data. Used for signup and login. |

## Why Pull vs Build

| Situation | What to do |
|-----------|-----------|
| You changed Python code only | Just restart docker compose (bind mount handles it) |
| You changed Dockerfile or requirements.txt | `docker compose up --build` |
| You're on a different computer | `git pull` first, then `docker compose up --build` |
