import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  )

  let allUsers = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    allUsers = allUsers.concat(data.users)

    if (data.users.length < perPage) break
    page++
  }

  res.status(200).json({ users: allUsers })
}
