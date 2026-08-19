# CLAUDE.md

Key Stash Manager is a secrets manager application with a React/TypeScript
frontend and Express.js backend. It organizes secrets into folders within
profiles, with localStorage persistence and optional server sync.

**Stack:**

- Frontend: React 18 + TypeScript, Vite, Zustand, React Router, shadcn/ui +
  Radix, TailwindCSS
- Backend: Express.js + Zod validation
- Deployment: Docker/Docker Compose, PM2 for production

## Development

We will only focus on client-side for this release, so run
`npm run dev --prefix frontend` and then use chrome devtools MCP to visually
verify everything is working on localhost:5173
