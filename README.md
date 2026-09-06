# MCA-DS Workspace

React + Vite + Supabase academic workspace.

## Run locally

```bash
npm install
```

Create `.env` in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

Then:

```bash
npm run dev
```

## Database

Run `supabase/migrations/001_initial_schema.sql` in Supabase SQL Editor.

The app uses Supabase Auth + Row Level Security. Create/sign in to an account before adding data.

## Current build

- Supabase authentication
- Today dashboard with academic-day resolution
- Weekly schedule
- Attendance marking
- Tasks CRUD
- Hostel mess/laundry display
- Profile + active-term settings
- Responsive desktop/mobile UI
