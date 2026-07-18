import React, { useState, useEffect } from 'react';
import './BecomePartner.css';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from "lucide-react";

interface PartnerProfile {
  user_id: string;
  is_partner: boolean;
  status: 'pending' | 'approved' | 'rejected';
  partner_code: string | null;
  wallet_balance: number;
}

export const BecomePartner: React.FC = () => {
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // On mount, fetch the current user's partner profile
  useEffect(() => {
    const fetchPartnerProfile = async () => {
      setIsFetching(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsFetching(false);
        return;
      }
      setUserId(session.user.id);

      const { data, error } = await supabase
        .from('partner_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (!error && data) {
        setPartnerProfile(data);
      } else {
        // No partner record yet, user is not a partner
        setPartnerProfile(null);
      }
      setIsFetching(false);
    };
    fetchPartnerProfile();
  }, []);

  const handleBecomePartner = async () => {
    if (!userId) return;
    setIsLoading(true);

    // Generate a unique partner code
    const uniqueCode = 'PARTNER-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Save to the database as pending
    const { data, error } = await supabase
      .from('partner_profiles')
      .insert({
        user_id: userId,
        is_partner: false,
        status: 'pending',
        partner_code: uniqueCode,
        wallet_balance: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating partner profile:', error);
      alert('Something went wrong. Please try again.');
    } else {
      setPartnerProfile(data);
    }
    setIsLoading(false);
  };

  const copyToClipboard = () => {
    if (partnerProfile?.partner_code) {
      navigator.clipboard.writeText(partnerProfile.partner_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isFetching) {
    return (
      <div className="partner-card">
        <div className="partner-header">
          <h2>Partner Program</h2>
        </div>
        <div style={{ textAlign: 'center', padding: '40px', color: '#a0a0b0', display: 'flex', justifyContent: 'center' }}>
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="partner-card">
        <div className="partner-header">
          <h2>Partner Program</h2>
        </div>
        <div style={{ textAlign: 'center', padding: '20px', color: '#a0a0b0' }}>Please log in to access the partner program.</div>
      </div>
    );
  }

  return (
    <div className="partner-card">
      <div className="partner-header">
        <h2>Partner Program</h2>
        {partnerProfile?.status === 'approved' && <span className="badge">Active Partner</span>}
        {partnerProfile?.status === 'pending' && <span className="badge" style={{ background: '#f59e0b' }}>Pending</span>}
      </div>

      {!partnerProfile ? (
        <div className="partner-content unrolled">
          <p>
            Turn your network into income! Become an official partner today.
            Share your unique code to give your friends <strong>20% off</strong> our
            Website-to-App Converter, and you'll earn <strong>30%</strong> of the sale amount directly to your wallet!
          </p>
          <button
            className={`partner-btn ${isLoading ? 'loading' : ''}`}
            onClick={handleBecomePartner}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
            {isLoading ? 'Submitting Application...' : 'Apply to Become a Partner'}
          </button>
        </div>
      ) : partnerProfile.status === 'pending' ? (
        <div className="partner-content unrolled">
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Application Pending</h3>
            <p style={{ color: '#a0a0b0' }}>
              Your application to join the Partner Program is currently under review by our team.
              We'll notify you once it has been approved, so you can start sharing your code and earning rewards!
            </p>
          </div>
        </div>
      ) : partnerProfile.status === 'rejected' ? (
        <div className="partner-content unrolled">
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#ef4444' }}>Application Rejected</h3>
            <p style={{ color: '#a0a0b0' }}>
              Unfortunately, your application to join the Partner Program was not approved at this time.
            </p>
          </div>
        </div>
      ) : (
        <div className="partner-content enrolled">
          <div className="wallet-section">
            <div className="wallet-balance">
              <span className="label">Wallet Balance</span>
              <span className="amount">🪙 {(partnerProfile.wallet_balance ?? 0).toFixed(2)} Coins</span>
            </div>
          </div>

          <div className="code-section">
            <p className="code-description">
              Share your partner code below! Users get 20% off the <strong>Website-to-App Converter</strong>,
              and you receive 30% of the sale as coins.
            </p>
            <div className="code-box" onClick={copyToClipboard} title="Click to copy">
              <span className="code">{partnerProfile.partner_code}</span>
              <button className="copy-btn" title={copied ? 'Copied!' : 'Copy'}>
                {copied ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17L4 12" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 4V16C8 17.1046 8.89543 18 10 18H20C21.1046 18 22 17.1046 22 16V4C22 2.89543 21.1046 2 20 2H10C8.89543 2 8 2.89543 8 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 18V20C16 21.1046 15.1046 22 14 22H4C2.89543 22 2 21.1046 2 20V8C2 6.89543 2.89543 6 4 6H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
            {copied && <p style={{ color: '#10b981', fontSize: '0.8rem', textAlign: 'center', marginTop: '8px' }}>Copied to clipboard!</p>}
          </div>
        </div>
      )}
    </div>
  );
};

