/**
 * NovaDeskOnline — Secure Config Endpoint
 * ─────────────────────────────────────────
 * Add these in Vercel → Settings → Environment Variables:
 *
 *   SUPABASE_URL      https://ihkwomhxdfthxaynljuw.supabase.co
 *   SUPABASE_ANON_KEY eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *   WA_NUMBER         254111923477
 *   SITE_URL          https://your-project.vercel.app
 *   ADMIN_SECRET      your-strong-secret
 *   ALLOWED_ORIGIN    https://your-project.vercel.app
 */
export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(200).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Server misconfigured — set environment variables in Vercel dashboard' });
  }

  res.setHeader('Cache-Control',              'no-store');
  res.setHeader('Content-Type',               'application/json');
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');

  return res.status(200).json({
    supabaseUrl:   process.env.SUPABASE_URL,
    supabaseKey:   process.env.SUPABASE_ANON_KEY,
    waNumber:      process.env.WA_NUMBER      || '254111923477',
    siteUrl:       process.env.SITE_URL       || 'https://novadesk.vercel.app',
    adminSecret:   process.env.ADMIN_SECRET   || 'novadesk-admin-2024',
    version:       '2.0.0',
  });
}
