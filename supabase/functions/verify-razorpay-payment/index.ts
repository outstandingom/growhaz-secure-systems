import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Helper function to securely verify Razorpay signature using native Web Crypto
async function verifySignature(orderId: string, paymentId: string, signature: string, secret: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${orderId}|${paymentId}`);
  const keyData = encoder.encode(secret);
  
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  
  const signatureArrayBuffer = await crypto.subtle.sign('HMAC', key, data);
  const signatureArray = new Uint8Array(signatureArrayBuffer);
  const computedSignature = Array.from(signatureArray)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
    
  return computedSignature === signature;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Use service role for updating balances safely bypassing RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Parse payload
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amount) {
      return new Response(JSON.stringify({ error: 'Missing payment details' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!razorpayKeySecret) {
      return new Response(JSON.stringify({ error: 'Payment gateway not configured' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verify signature
    const isValid = await verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, razorpayKeySecret);

    if (!isValid) {
      console.error('Invalid payment signature');
      return new Response(JSON.stringify({ error: 'Invalid payment signature' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Payment verified for user:', user.id, 'Amount:', amount);

    // Check if this payment was already processed
    const { data: existingTransaction } = await supabaseAdmin
      .from('coin_transactions')
      .select('id, status')
      .eq('razorpay_payment_id', razorpay_payment_id)
      .maybeSingle();

    if (existingTransaction) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Payment already processed',
        alreadyProcessed: true,
        transactionId: existingTransaction.id
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Use the RPC to update balance AND create the transaction in one call
    const { error: updateError } = await supabaseAdmin.rpc('update_coin_balance', {
      p_user_id: user.id,
      p_amount: amount,
      p_type: 'purchase',
      p_description: `Purchased ${amount} coins via Razorpay`,
      p_razorpay_payment_id: razorpay_payment_id,
      p_razorpay_order_id: razorpay_order_id,
      p_reference_id: razorpay_payment_id
    });

    if (updateError) {
      console.error('Error updating balance:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to credit coins: ' + updateError.message }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get updated balance
    const { data: balanceData } = await supabaseAdmin
      .from('coin_balances')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    return new Response(JSON.stringify({
      success: true,
      message: `${amount} coins credited successfully`,
      newBalance: balanceData?.balance || amount,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error verifying payment:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
        
