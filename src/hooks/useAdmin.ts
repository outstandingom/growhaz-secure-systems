import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  bio: string | null;
  skills: string[] | null;
  is_available_as_mentor: boolean | null;
  mentor_approved: boolean;
  created_at: string;
  coinBalance: number;
  roles: string[];
}

interface WithdrawalRequest {
  id: string;
  user_id: string;
  userName: string;
  amount: number;
  upi_id: string | null;
  bank_details: object | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
}

interface PartnerAdminProfile {
  user_id: string;
  partner_code: string;
  status: 'pending' | 'approved' | 'rejected';
  wallet_balance: number;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [partners, setPartners] = useState<PartnerAdminProfile[]>([]);
  const { toast } = useToast();

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Check if user has admin role using the database function
    const { data, error } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } else {
      setIsAdmin(data === true);
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase.functions.invoke('admin-operations', {
      body: { action: 'get_all_users' }
    });

    if (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive"
      });
      return;
    }

    setUsers(data.users || []);
  };

  const fetchWithdrawalRequests = async () => {
    const { data, error } = await supabase.functions.invoke('admin-operations', {
      body: { action: 'get_withdrawal_requests' }
    });

    if (error) {
      console.error('Error fetching withdrawal requests:', error);
      return;
    }

    setWithdrawalRequests(data.requests || []);
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase.functions.invoke('admin-operations', {
      body: { action: 'get_transactions' }
    });

    if (error) {
      console.error('Error fetching transactions:', error);
      return;
    }

    setTransactions(data.transactions || []);
  };

  const processWithdrawal = async (requestId: string, status: 'approved' | 'rejected' | 'completed', adminNotes?: string) => {
    const { data, error } = await supabase.functions.invoke('admin-operations', {
      body: {
        action: 'process_withdrawal',
        data: { requestId, status, adminNotes }
      }
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to process withdrawal",
        variant: "destructive"
      });
      return false;
    }

    toast({
      title: "Success",
      description: data.message
    });

    await fetchWithdrawalRequests();
    return true;
  };

  const updateUserRole = async (userId: string, role: 'admin' | 'moderator' | 'user', action: 'add' | 'remove') => {
    const { data, error } = await supabase.functions.invoke('admin-operations', {
      body: {
        action: 'update_user_role',
        data: { userId, role, action }
      }
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive"
      });
      return false;
    }

    toast({
      title: "Success",
      description: `Role ${action === 'add' ? 'added' : 'removed'} successfully`
    });

    await fetchUsers();
    return true;
  };

  const adjustCoins = async (userId: string, amount: number, type: 'earn' | 'spend', description?: string) => {
    const { data, error } = await supabase.functions.invoke('admin-operations', {
      body: { action: 'adjust_coins', data: { userId, amount, type, description } }
    });
    if (error || (data as any)?.error) {
      toast({ title: 'Error', description: (data as any)?.error || 'Failed to adjust coins', variant: 'destructive' });
      return false;
    }
    toast({ title: 'Success', description: (data as any).message });
    await fetchUsers();
    return true;
  };

  const fetchPartners = async () => {
    // Admin uses supabase client directly for this since RLS allows it
    const { data, error } = await supabase
      .from('partner_profiles')
      .select(`
        user_id, partner_code, status, wallet_balance, created_at,
        profiles ( full_name )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching partners:', error);
      return;
    }
    setPartners(data as any || []);
  };

  const updatePartnerStatus = async (userId: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('partner_profiles')
      .update({ status, is_partner: status === 'approved' })
      .eq('user_id', userId);
    
    if (error) {
      toast({ title: "Error", description: "Failed to update partner status", variant: "destructive" });
      return false;
    }
    toast({ title: "Success", description: `Partner application ${status}` });
    await fetchPartners();
    return true;
  };

  useEffect(() => {

    checkAdminStatus();
  }, []);

  return {
    isAdmin,
    loading,
    users,
    withdrawalRequests,
    transactions,
    partners,
    fetchUsers,
    fetchWithdrawalRequests,
    fetchTransactions,
    fetchPartners,
    processWithdrawal,
    updateUserRole,
    adjustCoins,
    updatePartnerStatus
  };
}
