import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CoinBalance {
  balance: number;
  total_earned: number;
  total_spent: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  reference_id?: string;
}

export function useWallet() {
  const [balance, setBalance] = useState<CoinBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Used useCallback so we can safely include these in the useEffect dependency array
  const fetchBalance = useCallback(async () => {
    // FIX 1: Using getSession() instead of getUser() prevents unnecessary server API calls
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data, error } = await supabase
      .from('coin_balances')
      .select('balance, total_earned, total_spent')
      .eq('user_id', session.user.id)
      .single();

    // PGRST116 means "No rows found" - we ignore it because new users won't have a row yet
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching balance:', error);
    }

    setBalance(data || { balance: 0, total_earned: 0, total_spent: 0 });
  }, []);

  const fetchTransactions = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data, error } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching transactions:', error);
    }

    setTransactions(data || []);
  }, []);

  useEffect(() => {
    let channel: any;
    let isMounted = true;

    const loadData = async () => {
      if (isMounted) setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      // FIX 2: Only attempt to fetch data if we are absolutely sure the session is loaded
      if (session?.user) {
        await Promise.all([fetchBalance(), fetchTransactions()]);
        
        // FIX 3: Added filters to the real-time subscription.
        // Now it ONLY listens to this specific user's changes, saving huge amounts of performance.
        if (isMounted) {
          if (channel) {
            supabase.removeChannel(channel);
          }
          channel = supabase
            .channel(`wallet_changes_${session.user.id}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'coin_balances', filter: `user_id=eq.${session.user.id}` },
              () => fetchBalance()
            )
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'coin_transactions', filter: `user_id=eq.${session.user.id}` },
              () => {
                fetchTransactions();
                fetchBalance();
              }
            )
            .subscribe();
        }
      } else {
         if (isMounted) {
             setBalance(null);
             setTransactions([]);
         }
      }
      
      if (isMounted) setLoading(false);
    };

    // FIX 4: Listen for auth state changes. If the user refreshes the page, 
    // this ensures data is loaded exactly when the session is restored from local storage.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
        loadData();
    });

    loadData();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchBalance, fetchTransactions]);

  const requestWithdrawal = async (amount: number, upiId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      toast({
        title: "Error",
        description: "Please log in to request withdrawal",
        variant: "destructive"
      });
      return false;
    }

    if (!balance || balance.balance < amount) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough coins for this withdrawal",
        variant: "destructive"
      });
      return false;
    }

    try {
      // Create transaction record
      const { error: transactionError } = await supabase
        .from('coin_transactions')
        .insert({
          user_id: session.user.id,
          type: 'withdrawal',
          amount: amount,
          description: `Withdrawal request of ${amount} coins to UPI: ${upiId}`,
          status: 'pending'
        });

      if (transactionError) throw transactionError;

      // Deduct coins from balance
      const { error: deductError } = await supabase.rpc('update_coin_balance', {
        p_user_id: session.user.id,
        p_amount: amount,
        p_type: 'withdrawal',
        p_description: `Withdrawal request: ${amount} coins`
      });

      if (deductError) throw deductError;

      // Create withdrawal request
      const { error: withdrawalError } = await supabase
        .from('withdrawal_requests')
        .insert({
          user_id: session.user.id,
          amount,
          upi_id: upiId,
          status: 'pending'
        });

      if (withdrawalError) throw withdrawalError;

      toast({
        title: "Request Submitted",
        description: `Withdrawal of ${amount} coins submitted for review`
      });

      await fetchBalance();
      await fetchTransactions();
      return true;

    } catch (error: any) {
      console.error('Withdrawal error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    balance,
    transactions,
    loading,
    fetchBalance,
    fetchTransactions,
    requestWithdrawal
  };
}
