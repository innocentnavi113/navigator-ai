import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  )

  const { data, error } = await supabaseAdmin.auth.admin.listUsers()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.status(200).json({ users: data.users })
}
