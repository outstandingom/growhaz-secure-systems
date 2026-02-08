import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin using the has_role function
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      console.error('User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, data } = await req.json();
    console.log('Admin action:', action, 'by user:', user.id);

    switch (action) {
      case 'get_all_users': {
        const { data: profiles, error } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Get coin balances for all users
        const { data: balances } = await supabaseAdmin
          .from('coin_balances')
          .select('*');

        // Get user roles
        const { data: roles } = await supabaseAdmin
          .from('user_roles')
          .select('*');

        const usersWithData = profiles?.map(profile => ({
          ...profile,
          coinBalance: balances?.find(b => b.user_id === profile.user_id)?.balance || 0,
          roles: roles?.filter(r => r.user_id === profile.user_id).map(r => r.role) || []
        }));

        return new Response(
          JSON.stringify({ users: usersWithData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_withdrawal_requests': {
        const { data: requests, error } = await supabaseAdmin
          .from('withdrawal_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Get user profiles for the requests
        const userIds = [...new Set(requests?.map(r => r.user_id) || [])];
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const requestsWithUser = requests?.map(req => ({
          ...req,
          userName: profiles?.find(p => p.user_id === req.user_id)?.full_name || 'Unknown'
        }));

        return new Response(
          JSON.stringify({ requests: requestsWithUser }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'process_withdrawal': {
        const { requestId, status, adminNotes } = data;
        
        // Get the withdrawal request
        const { data: request, error: fetchError } = await supabaseAdmin
          .from('withdrawal_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (fetchError || !request) {
          return new Response(
            JSON.stringify({ error: 'Withdrawal request not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (request.status !== 'pending') {
          return new Response(
            JSON.stringify({ error: 'Request already processed' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update the request
        const { error: updateError } = await supabaseAdmin
          .from('withdrawal_requests')
          .update({
            status,
            admin_notes: adminNotes,
            processed_by: user.id,
            processed_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (updateError) throw updateError;

        // If rejected, refund the coins
        if (status === 'rejected') {
          await supabaseAdmin.rpc('update_coin_balance', {
            p_user_id: request.user_id,
            p_amount: request.amount,
            p_type: 'refund',
            p_description: `Withdrawal request rejected: ${adminNotes || 'No reason provided'}`,
            p_reference_id: requestId
          });
        }

        console.log('Withdrawal processed:', requestId, status);

        return new Response(
          JSON.stringify({ success: true, message: `Withdrawal ${status}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_user_role': {
        const { userId, role, action: roleAction } = data;

        if (roleAction === 'add') {
          const { error } = await supabaseAdmin
            .from('user_roles')
            .insert({ user_id: userId, role });

          if (error && error.code !== '23505') throw error; // Ignore duplicate
        } else if (roleAction === 'remove') {
          const { error } = await supabaseAdmin
            .from('user_roles')
            .delete()
            .eq('user_id', userId)
            .eq('role', role);

          if (error) throw error;
        }

        console.log('Role updated:', userId, role, roleAction);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_transactions': {
        const { data: transactions, error } = await supabaseAdmin
          .from('coin_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        return new Response(
          JSON.stringify({ transactions }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Admin operation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
