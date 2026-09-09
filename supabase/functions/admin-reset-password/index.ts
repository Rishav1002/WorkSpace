// Supabase Edge Function: admin-reset-password
// Performs administrative password reset using privileged service-role credentials ONLY inside trusted server
// Deploy with: supabase functions deploy admin-reset-password

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    // Verify requesting caller is authenticated admin
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: callerProfile } = await callerClient
      .from('user_profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Now execute privileged reset
    const { targetGrNumber, newPassword } = await req.json();
    if (!targetGrNumber || !newPassword || newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Valid target GR number and password (min 6 chars) required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const targetEmail = `gr_${targetGrNumber.trim().toLowerCase()}@workspace.internal`;

    // Find user in auth.users by email
    const { data: userList, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;

    const targetUser = userList.users.find(u => u.email === targetEmail);
    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: `Account for GR ${targetGrNumber} not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUser.id, {
      password: newPassword
    });
    if (updateError) throw updateError;

    // Log to immutable audit_logs
    await adminClient.from('audit_logs').insert({
      id: `audit-${Date.now()}`,
      actor_gr: callerUser.user_metadata?.gr_number || 'admin',
      entity: 'auth.user',
      entity_id: targetGrNumber,
      change_type: 'update',
      scope: 'master',
      effective_date: new Date().toISOString(),
      new_value: { passwordReset: true }
    });

    return new Response(
      JSON.stringify({ success: true, message: `Password reset successfully for GR ${targetGrNumber}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
