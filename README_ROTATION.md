Rotation scheduler

This repo includes two options to run the server-side QR token rotation RPCs you added to the database.

1) GitHub Actions (recommended/simple)
- Add the following repository secrets: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE` (Service Role key).
- The workflow `.github/workflows/rotate-tokens.yml` will run every 5 minutes and call the RPCs:
  - `rotate_session_start_qr_tokens`
  - `rotate_session_end_qr_tokens`

2) Node script (1-minute cron possible)
- Use `scripts/rotate-tokens.js` and run it from anywhere with the Service Role key in env:

  SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE=<service-role-key> node scripts/rotate-tokens.js

- Deploy as a small container or run in a cron environment (cron-job.org, a server, Cloud Run, etc.) to run every minute.

Security
- Never commit the service role key to the repo. Use repo secrets or environment variables on the host.
- Service role key gives elevated privileges; restrict access to it.
