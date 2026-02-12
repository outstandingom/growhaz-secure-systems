import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

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

    // Use service role for updating balances
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing payment details' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!razorpayKeySecret) {
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = createHmac("sha256", razorpayKeySecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error('Invalid payment signature');
      return new Response(
        JSON.stringify({ error: 'Invalid payment signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Payment verified for user:', user.id, 'Amount:', amount);

    // Check if this payment was already processed
    const { data: existingTransaction } = await supabaseAdmin
      .from('coin_transactions')
      .select('id, status')
      .eq('razorpay_payment_id', razorpay_payment_id)
      .maybeSingle();

    if (existingTransaction) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment already processed',
          alreadyProcessed: true,
          transactionId: existingTransaction.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create transaction record with Razorpay details
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('coin_transactions')
      .insert({
        user_id: user.id,
        type: 'purchase',
        amount: amount,
        description: `Purchased ${amount} coins via Razorpay`,
        status: 'completed',
        razorpay_payment_id: razorpay_payment_id,
        razorpay_order_id: razorpay_order_id,
        reference_id: razorpay_payment_id
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      return new Response(
        JSON.stringify({ error: 'Failed to record transaction' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update coin balance using the database function - REMOVED the extra parameters
    const { error: updateError } = await supabaseAdmin.rpc('update_coin_balance', {
      p_user_id: user.id,
      p_amount: amount,
      p_type: 'purchase',
      p_description: `Purchased ${amount} coins (Payment ID: ${razorpay_payment_id})`
    });

    if (updateError) {
      console.error('Error updating balance:', updateError);
      
      // Update transaction status to failed if balance update fails
      await supabaseAdmin
        .from('coin_transactions')
        .update({ status: 'failed' })
        .eq('id', transaction.id);
      
      return new Response(
        JSON.stringify({ error: 'Failed to credit coins' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get updated balance
    const { data: balanceData } = await supabaseAdmin
      .from('coin_balances')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    console.log('Coins credited successfully. New balance:', balanceData?.balance);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${amount} coins credited successfully`,
        newBalance: balanceData?.balance || amount,
        transactionId: transaction.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error verifying payment:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
