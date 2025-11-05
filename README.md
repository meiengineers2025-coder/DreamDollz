# Dream Jobs — Blue•Pink (SQLite + Render ready)

## Run locally
1. `npm install`
2. Copy `.env.example` → `.env`
3. `npm start`
4. visit: http://localhost:3000

Demo logins:
- employer@example.com / 123456
- candidate@example.com / 123456

## Deploy to Render
1. New Web Service → Connect GitHub repo
2. Start command: `node server.js`
3. Add Disk → `/data` (1 GB)
4. Add environment variables from `.env`