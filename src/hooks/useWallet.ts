import { useState, useEffect } from 'react';
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

  const fetchBalance = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('coin_balances')
      .select('balance, total_earned, total_spent')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching balance:', error);
    }

    setBalance(data || { balance: 0, total_earned: 0, total_spent: 0 });
  };

  const fetchTransactions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching transactions:', error);
    }

    setTransactions(data || []);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchBalance(), fetchTransactions()]);
      setLoading(false);
    };

    loadData();

    // Subscribe to balance changes
    const channel = supabase
      .channel('wallet_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coin_balances' },
        () => {
          fetchBalance();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'coin_transactions' },
        () => {
          fetchTransactions();
          fetchBalance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const requestWithdrawal = async (amount: number, upiId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
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
      // Create transaction record first
      const { data: transaction, error: transactionError } = await supabase
        .from('coin_transactions')
        .insert({
          user_id: user.id,
          type: 'withdrawal',
          amount: amount,
          description: `Withdrawal request of ${amount} coins to UPI: ${upiId}`,
          status: 'pending'
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Deduct coins from balance
      const { error: deductError } = await supabase.rpc('update_coin_balance', {
        p_user_id: user.id,
        p_amount: amount,
        p_type: 'withdrawal',
        p_description: `Withdrawal request: ${amount} coins`
      });

      if (deductError) throw deductError;

      // Create withdrawal request
      const { error: withdrawalError } = await supabase
        .from('withdrawal_requests')
        .insert({
          user_id: user.id,
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
