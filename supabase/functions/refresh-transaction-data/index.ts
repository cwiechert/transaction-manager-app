import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const githubToken = Deno.env.get('GITHUB_TOKEN');
    
    if (!githubToken) {
      console.error('GitHub token not found');
      return new Response(
        JSON.stringify({ error: 'GitHub token not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Triggering GitHub repository dispatch to run data update...');

    // Trigger GitHub repository dispatch event
    const dispatchResponse = await fetch(
      'https://api.github.com/repos/cwiechert/transaction-manager-data/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'transaction-manager-refresh'
        },
        body: JSON.stringify({
          event_type: 'refresh-data',
          client_payload: {
            timestamp: new Date().toISOString(),
            triggered_by: 'web-app'
          }
        })
      }
    );

    if (!dispatchResponse.ok) {
      const errorText = await dispatchResponse.text();
      console.error('GitHub API error:', dispatchResponse.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to trigger data refresh',
          details: errorText,
          status: dispatchResponse.status
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Successfully triggered GitHub repository dispatch');

    return new Response(
      JSON.stringify({ 
        message: 'Data refresh triggered successfully',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in refresh-transaction-data function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});