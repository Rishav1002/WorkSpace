// Supabase Edge Function: resolve-gr-login
// Bridges university GR Number to Supabase Auth deterministic identity
// Deploy with: supabase functions deploy resolve-gr-login

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { grNumber } = await req.json();
    if (!grNumber || typeof grNumber !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid GR number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanGr = grNumber.trim().toLowerCase();
    // Deterministic internal identity used to bridge Supabase Auth without exposing email to user
    const internalIdentity = `gr_${cleanGr}@workspace.internal`;

    return new Response(
      JSON.stringify({
        success: true,
        grNumber: cleanGr,
        internalIdentity
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
