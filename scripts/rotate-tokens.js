#!/usr/bin/env node
// Simple scheduler script to call Supabase RPCs that rotate QR tokens.
// Usage: Set env vars SUPABASE_URL and SUPABASE_SERVICE_ROLE, then run:
//   node scripts/rotate-tokens.js

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE env var');
  process.exit(1);
}

async function callRpc(name) {
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${name} failed: ${res.status} ${text}`);
  }
  return res.json();
}

(async () => {
  try {
    console.log(new Date().toISOString(), 'Calling rotate_session_start_qr_tokens');
    const a = await callRpc('rotate_session_start_qr_tokens');
    console.log('start rotation result:', JSON.stringify(a));

    console.log(new Date().toISOString(), 'Calling rotate_session_end_qr_tokens');
    const b = await callRpc('rotate_session_end_qr_tokens');
    console.log('end rotation result:', JSON.stringify(b));

    console.log('Rotation completed');
  } catch (err) {
    console.error('Rotation error:', err);
    process.exit(2);
  }
})();
