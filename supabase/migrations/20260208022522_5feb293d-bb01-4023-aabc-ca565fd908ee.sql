-- Create app_role enum for admin system
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table for admin management
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create coin_balances table
CREATE TABLE public.coin_balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
    total_earned numeric NOT NULL DEFAULT 0,
    total_spent numeric NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on coin_balances
ALTER TABLE public.coin_balances ENABLE ROW LEVEL SECURITY;

-- RLS policies for coin_balances
CREATE POLICY "Users can view their own balance"
ON public.coin_balances FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own balance"
ON public.coin_balances FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all balances"
ON public.coin_balances FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create transaction_type enum
CREATE TYPE public.transaction_type AS ENUM ('purchase', 'spend', 'earn', 'withdrawal', 'refund');

-- Create coin_transactions table
CREATE TABLE public.coin_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type transaction_type NOT NULL,
    amount numeric NOT NULL,
    description text,
    reference_id text,
    razorpay_payment_id text,
    razorpay_order_id text,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on coin_transactions
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for coin_transactions
CREATE POLICY "Users can view their own transactions"
ON public.coin_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
ON public.coin_transactions FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create withdrawal_status enum
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'approved', 'rejected', 'completed');

-- Create withdrawal_requests table
CREATE TABLE public.withdrawal_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount numeric NOT NULL CHECK (amount > 0),
    status withdrawal_status NOT NULL DEFAULT 'pending',
    bank_details jsonb,
    upi_id text,
    admin_notes text,
    processed_by uuid REFERENCES auth.users(id),
    processed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on withdrawal_requests
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for withdrawal_requests
CREATE POLICY "Users can view their own withdrawal requests"
ON public.withdrawal_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own withdrawal requests"
ON public.withdrawal_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all withdrawal requests"
ON public.withdrawal_requests FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update withdrawal requests"
ON public.withdrawal_requests FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Function to update coin balance (used by edge functions)
CREATE OR REPLACE FUNCTION public.update_coin_balance(
    p_user_id uuid,
    p_amount numeric,
    p_type transaction_type,
    p_description text DEFAULT NULL,
    p_reference_id text DEFAULT NULL,
    p_razorpay_payment_id text DEFAULT NULL,
    p_razorpay_order_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert or update coin balance
    INSERT INTO public.coin_balances (user_id, balance, total_earned, total_spent)
    VALUES (
        p_user_id,
        CASE WHEN p_type IN ('purchase', 'earn', 'refund') THEN p_amount ELSE 0 END,
        CASE WHEN p_type IN ('purchase', 'earn') THEN p_amount ELSE 0 END,
        CASE WHEN p_type IN ('spend', 'withdrawal') THEN p_amount ELSE 0 END
    )
    ON CONFLICT (user_id) DO UPDATE SET
        balance = coin_balances.balance + 
            CASE WHEN p_type IN ('purchase', 'earn', 'refund') THEN p_amount 
                 WHEN p_type IN ('spend', 'withdrawal') THEN -p_amount 
                 ELSE 0 END,
        total_earned = coin_balances.total_earned + 
            CASE WHEN p_type IN ('purchase', 'earn') THEN p_amount ELSE 0 END,
        total_spent = coin_balances.total_spent + 
            CASE WHEN p_type IN ('spend', 'withdrawal') THEN p_amount ELSE 0 END,
        updated_at = now();
    
    -- Record transaction
    INSERT INTO public.coin_transactions (
        user_id, type, amount, description, reference_id, 
        razorpay_payment_id, razorpay_order_id, status
    ) VALUES (
        p_user_id, p_type, p_amount, p_description, p_reference_id,
        p_razorpay_payment_id, p_razorpay_order_id, 'completed'
    );
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_coin_balances_updated_at
BEFORE UPDATE ON public.coin_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_withdrawal_requests_updated_at
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();