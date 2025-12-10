# Suggested Development Commands

## Project Setup
```bash
# Install dependencies
npm install

# Set up environment variables (copy from .env.example)
cp .env.example .env.local
# Then edit .env.local with your Vercel KV credentials
```

## Development
```bash
# Start Vite development server (port 3000)
npm run dev

# Alternative: Use Python HTTP server for legacy single-file version
python -m http.server 8000
# Then open http://localhost:8000/guodan_calc.html
```

## Build and Preview
```bash
# Build for production (outputs to dist/)
npm run build

# Preview production build locally
npm run preview
```

## Testing
```bash
# No automated tests configured yet
# Manual testing recommended:
# 1. Test all game modes (4/6/8 players)
# 2. Test drag-drop on desktop and mobile
# 3. Test room sharing (create/join/sync)
# 4. Test voting system
# 5. Test all export formats
```

## Deployment
```bash
# Deploy to Vercel (configured via vercel.json)
vercel --prod

# Or use GitHub integration for automatic deployment
git push origin main
```

## Useful System Commands (macOS)
```bash
# Search for code patterns
grep -r "pattern" src/

# Find files by name
find src/ -name "*.js"

# List directory structure
ls -R src/

# Check git status
git status

# View recent commits
git log --oneline -10

# Create and switch to new branch
git checkout -b feature/branch-name
```

## Vercel KV Management
```bash
# List all KV storage keys (requires Vercel CLI)
vercel kv list

# Get value for a specific key
vercel kv get "key-name"

# Delete a key
vercel kv del "key-name"
```

## Code Quality
```bash
# No linting/formatting configured yet
# Future recommendation: Add ESLint and Prettier
# npm install --save-dev eslint prettier
# npm run lint
# npm run format
```
