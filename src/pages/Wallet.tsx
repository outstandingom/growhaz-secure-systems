import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Coins, ArrowUpRight, ArrowDownRight, CreditCard, Wallet as WalletIcon, TrendingUp, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const coinPackages = [
  { amount: 100, label: "₹100", popular: false },
  { amount: 500, label: "₹500", popular: false },
  { amount: 1000, label: "₹1,000", popular: true },
  { amount: 2000, label: "₹2,000", popular: false },
  { amount: 5000, label: "₹5,000", popular: false },
  { amount: 10000, label: "₹10,000", popular: false },
];

export default function Wallet() {
  const { balance, transactions, loading, fetchBalance, fetchTransactions, requestWithdrawal } = useWallet();
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [upiId, setUpiId] = useState<string>("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [processingWithdrawal, setProcessingWithdrawal] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    script.onerror = () => {
      setRazorpayLoaded(false);
      toast({
        title: "Error",
        description: "Failed to load payment gateway. Please refresh the page.",
        variant: "destructive"
      });
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleBuyCoins = async () => {
    const amount = customAmount ? parseInt(customAmount) : selectedAmount;
    
    if (amount < 100) {
      toast({
        title: "Minimum Amount",
        description: "Minimum purchase amount is ₹100",
        variant: "destructive"
      });
      return;
    }

    if (!razorpayLoaded || !window.Razorpay) {
      toast({
        title: "Error",
        description: "Payment gateway not loaded. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }

    setProcessingPayment(true);

    try {
      // ✅ FIX 1: Explicitly grab the current user's secure session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error("You must be logged in to purchase coins. Please refresh the page or log in again.");
      }

      // ✅ FIX 2: Force the token into the headers of the Edge Function request
      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: { amount },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error || !data?.orderId) {
        throw new Error(data?.error || 'Failed to create order. Please try again.');
      }

      // Get user details for Razorpay prefill
      const { data: { user } } = await supabase.auth.getUser();

      // Open Razorpay checkout
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "GROWHAZ",
        description: `Purchase ${amount} Coins`,
        order_id: data.orderId,
        handler: async (response: any) => {
          try {
            toast({
              title: "Processing",
              description: "Verifying your payment...",
            });

            // ✅ FIX 3: Also pass the token explicitly to the verification function
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount
              },
              headers: {
                Authorization: `Bearer ${session.access_token}`
              }
            });

            if (verifyError || !verifyData?.success) {
              throw new Error(verifyData?.error || 'Payment verification failed');
            }

            toast({
              title: "Payment Successful!",
              description: `${amount} coins have been added to your wallet`
            });

            // Refresh balance and transactions
            await fetchBalance();
            await fetchTransactions();

          } catch (err: any) {
            console.error('Verification error:', err);
            toast({
              title: "Verification Failed",
              description: err.message || "Please contact support if amount was deducted",
              variant: "destructive"
            });
          }
        },
        modal: {
          ondismiss: () => {
            setProcessingPayment(false);
            toast({
              title: "Payment Cancelled",
              description: "You cancelled the payment",
              variant: "default"
            });
          }
        },
        prefill: {
          email: user?.email,
        },
        theme: {
          color: "#8B5CF6"
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
      
      razorpay.on('payment.failed', (response: any) => {
        toast({
          title: "Payment Failed",
          description: response.error?.description || "Your payment was not successful",
          variant: "destructive"
        });
        setProcessingPayment(false);
      });

    } catch (error: any) {
      console.error('Payment initiation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to initiate payment",
        variant: "destructive"
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount);
    
    if (!amount || amount < 100) {
      toast({
        title: "Minimum Withdrawal",
        description: "Minimum withdrawal amount is 100 coins",
        variant: "destructive"
      });
      return;
    }

    if (!upiId) {
      toast({
        title: "UPI Required",
        description: "Please enter your UPI ID for withdrawal",
        variant: "destructive"
      });
      return;
    }

    if (balance && amount > balance.balance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough coins for this withdrawal",
        variant: "destructive"
      });
      return;
    }

    setProcessingWithdrawal(true);
    const success = await requestWithdrawal(amount, upiId);
    if (success) {
      setWithdrawAmount("");
      setUpiId("");
    }
    setProcessingWithdrawal(false);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <ArrowDownRight className="w-4 h-4 text-green-500" />;
      case 'earn':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'spend':
        return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      case 'withdrawal':
        return <ArrowUpRight className="w-4 h-4 text-orange-500" />;
      case 'refund':
        return <ArrowDownRight className="w-4 h-4 text-blue-500" />;
      default:
        return <Coins className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">My Wallet</h1>
            <p className="text-muted-foreground">Manage your coins, buy more, or withdraw earnings</p>
          </div>

          {/* Balance Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-primary/20 to-accent/20 border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <WalletIcon className="w-4 h-4" />
                  Current Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <Coins className="w-6 h-6 text-primary" />
                  <span className="text-3xl font-bold">{balance?.balance || 0}</span>
                  <span className="text-muted-foreground">coins</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">≈ ₹{balance?.balance || 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Total Earned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-green-500">{balance?.total_earned || 0}</span>
                  <span className="text-muted-foreground">coins</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-orange-500" />
                  Total Spent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-orange-500">{balance?.total_spent || 0}</span>
                  <span className="text-muted-foreground">coins</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="buy" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="buy">Buy Coins</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="buy">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Buy Coins
                  </CardTitle>
                  <CardDescription>Purchase coins to use for security tools, mentorship, and services. 1 Coin = ₹1</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {coinPackages.map((pkg) => (
                      <button
                        key={pkg.amount}
                        onClick={() => {
                          setSelectedAmount(pkg.amount);
                          setCustomAmount("");
                        }}
                        className={`relative p-4 rounded-lg border-2 transition-all ${
                          selectedAmount === pkg.amount && !customAmount
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {pkg.popular && (
                          <Badge className="absolute -top-2 -right-2 bg-primary">Popular</Badge>
                        )}
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Coins className="w-5 h-5 text-primary" />
                          <span className="text-xl font-bold">{pkg.amount}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{pkg.label}</p>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label>Or enter custom amount</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount (min ₹100)"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      min={100}
                    />
                  </div>

                  <Button 
                    onClick={handleBuyCoins} 
                    disabled={processingPayment || !razorpayLoaded}
                    className="w-full"
                    size="lg"
                  >
                    {processingPayment ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4 mr-2" />
                    )}
                    Pay ₹{customAmount || selectedAmount} with Razorpay
                  </Button>
                  
                  {!razorpayLoaded && (
                    <p className="text-xs text-center text-muted-foreground">
                      Loading payment gateway...
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="withdraw">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowUpRight className="w-5 h-5" />
                    Withdraw Earnings
                  </CardTitle>
                  <CardDescription>Convert your coins to cash. Minimum withdrawal: 100 coins</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Available for withdrawal</p>
                    <p className="text-2xl font-bold">{balance?.balance || 0} coins</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount to Withdraw</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount (min 100)"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      min={100}
                      max={balance?.balance || 0}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>UPI ID</Label>
                    <Input
                      type="text"
                      placeholder="yourname@upi"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                    />
                  </div>

                  <Button 
                    onClick={handleWithdraw} 
                    disabled={processingWithdrawal || !withdrawAmount || !upiId}
                    className="w-full"
                    size="lg"
                  >
                    {processingWithdrawal ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 mr-2" />
                    )}
                    Request Withdrawal
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Withdrawal requests are reviewed and processed within 2-3 business days
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>Your recent coin transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No transactions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex items-center gap-3">
                            {getTransactionIcon(tx.type)}
                            <div>
                              <p className="font-medium capitalize">{tx.type}</p>
                              <p className="text-sm text-muted-foreground">
                                {tx.description || format(new Date(tx.created_at), 'PPp')}
                              </p>
                              {tx.razorpay_payment_id && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Payment ID: {tx.razorpay_payment_id.slice(-8)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${
                              ['purchase', 'earn', 'refund'].includes(tx.type) 
                                ? 'text-green-500' 
                                : 'text-red-500'
                            }`}>
                              {['purchase', 'earn', 'refund'].includes(tx.type) ? '+' : '-'}
                              {tx.amount}
                            </p>
                            {getStatusBadge(tx.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
