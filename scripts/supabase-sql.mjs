// Runs SQL on the live database through the Supabase Management API, with the SUPABASE_ACCESS_TOKEN
// that CI already uses to deploy the edge function. Shared by the scripts that change the database.

export const token = process.env.SUPABASE_ACCESS_TOKEN;
export const project = process.env.SUPABASE_PROJECT_ID;

export async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Database query failed (${res.status}): ${text}`);
  return text ? JSON.parse(text) : [];
}

export const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;
