import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/hooks/useWallet';

export function useSpendCoins() {
  const { balance, fetchBalance, fetchTransactions } = useWallet();
  const { toast } = useToast();

  const spendCoins = async (amount: number, description: string): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      toast({ title: "Error", description: "Please log in first", variant: "destructive" });
      return false;
    }

    if (!balance || balance.balance < amount) {
      toast({ title: "Insufficient Balance", description: `You need ${amount} coins. Current balance: ${balance?.balance || 0}`, variant: "destructive" });
      return false;
    }

    try {
      const { error } = await supabase.rpc('update_coin_balance', {
        p_user_id: session.user.id,
        p_amount: amount,
        p_type: 'spend',
        p_description: description,
      });

      if (error) throw error;

      toast({ title: "Coins Spent", description: `${amount} coins deducted for: ${description}` });
      await Promise.all([fetchBalance(), fetchTransactions()]);
      return true;
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to process payment", variant: "destructive" });
      return false;
    }
  };

  return { spendCoins, balance, loading: !balance };
}
