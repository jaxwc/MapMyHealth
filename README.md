# Health care in your hands

## Run locally

1) Prerequisites
- Node.js 18+ and npm installed

2) Install dependencies
```bash
cd /home/priva/repos/MapMyHealth
npm install
```

3) Set environment variables
- Copy the sample env and edit values:
```bash
cp "env copy.local" .env.local
```
- Set your base URL and Google AI key in `.env.local`:
```
NEXT_PUBLIC_BASE_URL=http://localhost:3000
GOOGLE_GENERATIVE_AI_API_KEY=YOUR_API_KEY
# Some utilities may read GEMINI_API_KEY; set it to the same value if needed
# GEMINI_API_KEY=YOUR_API_KEY
```

4) Start the dev server
```bash
npm run dev
```

5) Open the app
- Visit http://localhost:3000

---

Additional commands
- Lint: `npm run lint`
- Test: `npm run test`
- Production build: `npm run build` then `npm start`

Notes
- The `my-mastra-app/` folder is a separate learning subproject and is excluded from the Next.js build.
