// Implementation of secure user deletion via Supabase Admin API
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    // 1. Setup Supabase Admin Client (Requires Service Role Key)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Get the User ID from the Authorization Header (The JWT of the user requesting deletion)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization Header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 3. Delete the user from Auth (This will cascade to public tables if ON DELETE CASCADE is set)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (deleteError) {
      throw deleteError
    }

    return new Response(
      JSON.stringify({ message: 'User account deleted successfully' }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Delete Function Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})