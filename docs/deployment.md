# Expense Tracker Deployment

## Preview app

This project can deploy as a separate Vercel app. It is intentionally separate from the current `ppinvestedu.com` domain-owner project so `/`, `/10outof10`, `/calculator`, and `/founders/*` stay untouched.

Required Vercel environment variables for accounts and encrypted cloud sync:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Without these variables, the tracker still works locally in the browser, but account creation will show a configuration message.

## Supabase

1. Create a Supabase project.
2. Enable Email/Password auth.
3. Run `docs/supabase-setup.sql` in the Supabase SQL editor.
4. Add the project URL and anon key to Vercel.

Records are encrypted in the browser before they are sent to Supabase. The database stores `encrypted_payload` and `iv`, not readable expense/income details.

## Domain path after preview approval

After the separate preview is approved, add only these rewrites to the current `ppinvestedu.com` domain-owner Vercel project:

```json
{
  "source": "/expensetracker",
  "destination": "https://YOUR-EXPENSE-TRACKER-PREVIEW-OR-PROD.vercel.app"
},
{
  "source": "/expensetracker/:path*",
  "destination": "https://YOUR-EXPENSE-TRACKER-PREVIEW-OR-PROD.vercel.app/:path*"
}
```

Do not change existing `/calculator`, `/10outof10`, `/_next/:path*`, or `/founders/:path*` rewrites.
