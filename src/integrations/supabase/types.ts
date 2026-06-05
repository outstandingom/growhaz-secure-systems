export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      blockchain_access_grants: {
        Row: {
          block_hash: string
          block_number: number
          contract_address: string
          created_at: string
          document_id: string
          event_type: string
          expires_at: number | null
          id: string
          indexed_at: string
          is_active: boolean
          on_chain_timestamp: number | null
          owner_wallet: string
          transaction_hash: string
          viewer_wallet: string
        }
        Insert: {
          block_hash: string
          block_number: number
          contract_address: string
          created_at?: string
          document_id: string
          event_type?: string
          expires_at?: number | null
          id?: string
          indexed_at?: string
          is_active?: boolean
          on_chain_timestamp?: number | null
          owner_wallet: string
          transaction_hash: string
          viewer_wallet: string
        }
        Update: {
          block_hash?: string
          block_number?: number
          contract_address?: string
          created_at?: string
          document_id?: string
          event_type?: string
          expires_at?: number | null
          id?: string
          indexed_at?: string
          is_active?: boolean
          on_chain_timestamp?: number | null
          owner_wallet?: string
          transaction_hash?: string
          viewer_wallet?: string
        }
        Relationships: []
      }
      blockchain_blocks: {
        Row: {
          block_index: number
          created_at: string
          data: Json
          hash: string
          nonce: number
          previous_hash: string
          timestamp: string
        }
        Insert: {
          block_index: number
          created_at?: string
          data: Json
          hash: string
          nonce: number
          previous_hash: string
          timestamp?: string
        }
        Update: {
          block_index?: number
          created_at?: string
          data?: Json
          hash?: string
          nonce?: number
          previous_hash?: string
          timestamp?: string
        }
        Relationships: []
      }
      blockchain_document_registry: {
        Row: {
          block_hash: string
          block_number: number
          content_hash: string | null
          contract_address: string
          contract_version: string
          created_at: string
          document_id: string | null
          document_name: string | null
          document_type: string | null
          event_type: string
          file_hash: string | null
          id: string
          indexed_at: string
          ipfs_cid: string | null
          ipfs_metadata_cid: string | null
          ipfs_url: string | null
          issuer_name: string | null
          merkle_root: string | null
          on_chain_timestamp: number | null
          transaction_hash: string
          verified_document_id: string | null
          wallet_address: string
        }
        Insert: {
          block_hash: string
          block_number: number
          content_hash?: string | null
          contract_address: string
          contract_version?: string
          created_at?: string
          document_id?: string | null
          document_name?: string | null
          document_type?: string | null
          event_type?: string
          file_hash?: string | null
          id?: string
          indexed_at?: string
          ipfs_cid?: string | null
          ipfs_metadata_cid?: string | null
          ipfs_url?: string | null
          issuer_name?: string | null
          merkle_root?: string | null
          on_chain_timestamp?: number | null
          transaction_hash: string
          verified_document_id?: string | null
          wallet_address: string
        }
        Update: {
          block_hash?: string
          block_number?: number
          content_hash?: string | null
          contract_address?: string
          contract_version?: string
          created_at?: string
          document_id?: string | null
          document_name?: string | null
          document_type?: string | null
          event_type?: string
          file_hash?: string | null
          id?: string
          indexed_at?: string
          ipfs_cid?: string | null
          ipfs_metadata_cid?: string | null
          ipfs_url?: string | null
          issuer_name?: string | null
          merkle_root?: string | null
          on_chain_timestamp?: number | null
          transaction_hash?: string
          verified_document_id?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      blockchain_merkle_documents: {
        Row: {
          block_hash: string
          block_number: number
          content_hash: string | null
          contract_address: string
          created_at: string
          document_name: string | null
          document_type: string | null
          event_type: string
          file_hash: string | null
          id: string
          indexed_at: string
          ipfs_cid: string | null
          ipfs_metadata_cid: string | null
          ipfs_url: string | null
          issuer_name: string | null
          merkle_root: string
          on_chain_timestamp: number | null
          total_chunks: number | null
          total_tokens: number | null
          transaction_hash: string
          verified_document_id: string | null
          wallet_address: string
        }
        Insert: {
          block_hash: string
          block_number: number
          content_hash?: string | null
          contract_address: string
          created_at?: string
          document_name?: string | null
          document_type?: string | null
          event_type?: string
          file_hash?: string | null
          id?: string
          indexed_at?: string
          ipfs_cid?: string | null
          ipfs_metadata_cid?: string | null
          ipfs_url?: string | null
          issuer_name?: string | null
          merkle_root: string
          on_chain_timestamp?: number | null
          total_chunks?: number | null
          total_tokens?: number | null
          transaction_hash: string
          verified_document_id?: string | null
          wallet_address: string
        }
        Update: {
          block_hash?: string
          block_number?: number
          content_hash?: string | null
          contract_address?: string
          created_at?: string
          document_name?: string | null
          document_type?: string | null
          event_type?: string
          file_hash?: string | null
          id?: string
          indexed_at?: string
          ipfs_cid?: string | null
          ipfs_metadata_cid?: string | null
          ipfs_url?: string | null
          issuer_name?: string | null
          merkle_root?: string
          on_chain_timestamp?: number | null
          total_chunks?: number | null
          total_tokens?: number | null
          transaction_hash?: string
          verified_document_id?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      blockchain_user_registrations: {
        Row: {
          block_hash: string
          block_number: number
          contract_address: string
          created_at: string
          event_type: string
          id: string
          indexed_at: string
          ipfs_cid: string | null
          on_chain_timestamp: number | null
          phone_hash: string | null
          profession: string | null
          transaction_hash: string
          user_name: string | null
          wallet_address: string
        }
        Insert: {
          block_hash: string
          block_number: number
          contract_address: string
          created_at?: string
          event_type?: string
          id?: string
          indexed_at?: string
          ipfs_cid?: string | null
          on_chain_timestamp?: number | null
          phone_hash?: string | null
          profession?: string | null
          transaction_hash: string
          user_name?: string | null
          wallet_address: string
        }
        Update: {
          block_hash?: string
          block_number?: number
          contract_address?: string
          created_at?: string
          event_type?: string
          id?: string
          indexed_at?: string
          ipfs_cid?: string | null
          on_chain_timestamp?: number | null
          phone_hash?: string | null
          profession?: string | null
          transaction_hash?: string
          user_name?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string
          category: string
          content: string
          created_at: string
          excerpt: string
          featured_image: string | null
          id: string
          is_published: boolean
          meta_description: string | null
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          category?: string
          content: string
          created_at?: string
          excerpt: string
          featured_image?: string | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          category?: string
          content?: string
          created_at?: string
          excerpt?: string
          featured_image?: string | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_messages: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          message: string
          sender_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          message: string
          sender_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "mentorship_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_balances: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          reference_id: string | null
          status: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          reference_id?: string | null
          status?: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          reference_id?: string | null
          status?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      demo_chain_wallets: {
        Row: {
          created_at: string
          display_balance: string | null
          id: string
          label: string | null
          network: string
          owner_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          display_balance?: string | null
          id?: string
          label?: string | null
          network?: string
          owner_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          display_balance?: string | null
          id?: string
          label?: string | null
          network?: string
          owner_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      demo_process_steps: {
        Row: {
          assignee_name: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          data: Json | null
          description: string | null
          id: string
          process_id: string
          status: string
          step_index: number
          title: string
          updated_at: string
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          assignee_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          process_id: string
          status?: string
          step_index: number
          title: string
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          assignee_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          process_id?: string
          status?: string
          step_index?: number
          title?: string
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_process_steps_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "demo_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_processes: {
        Row: {
          created_at: string
          description: string | null
          entity_ref: string | null
          entity_type: string
          id: string
          name: string
          owner_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_ref?: string | null
          entity_type?: string
          id?: string
          name: string
          owner_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_ref?: string | null
          entity_type?: string
          id?: string
          name?: string
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      demo_user_registry: {
        Row: {
          id: string
          ipfs_cid: string | null
          name: string
          owner_id: string
          phone_hash: string | null
          profession: string | null
          registered_at: string
          wallet_address: string
        }
        Insert: {
          id?: string
          ipfs_cid?: string | null
          name: string
          owner_id: string
          phone_hash?: string | null
          profession?: string | null
          registered_at?: string
          wallet_address: string
        }
        Update: {
          id?: string
          ipfs_cid?: string | null
          name?: string
          owner_id?: string
          phone_hash?: string | null
          profession?: string | null
          registered_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      learning_request_responses: {
        Row: {
          created_at: string
          id: string
          message: string
          proposed_rate: number | null
          request_id: string
          responder_id: string
          responder_name: string
          responder_skills: string[]
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          proposed_rate?: number | null
          request_id: string
          responder_id: string
          responder_name: string
          responder_skills?: string[]
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          proposed_rate?: number | null
          request_id?: string
          responder_id?: string
          responder_name?: string
          responder_skills?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_request_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "learning_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_requests: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          created_at: string
          description: string
          id: string
          preferred_duration: string | null
          request_type: Database["public"]["Enums"]["learning_request_type"]
          skills: string[]
          status: Database["public"]["Enums"]["learning_request_status"]
          title: string
          updated_at: string
          urgency: string | null
          user_id: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          description: string
          id?: string
          preferred_duration?: string | null
          request_type?: Database["public"]["Enums"]["learning_request_type"]
          skills?: string[]
          status?: Database["public"]["Enums"]["learning_request_status"]
          title: string
          updated_at?: string
          urgency?: string | null
          user_id: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          description?: string
          id?: string
          preferred_duration?: string | null
          request_type?: Database["public"]["Enums"]["learning_request_type"]
          skills?: string[]
          status?: Database["public"]["Enums"]["learning_request_status"]
          title?: string
          updated_at?: string
          urgency?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mentors: {
        Row: {
          avatar_url: string | null
          bio: string
          calendly_url: string | null
          created_at: string
          experience_years: number
          expertise: string[]
          hourly_rate: number
          id: string
          is_active: boolean
          is_verified: boolean
          linkedin_url: string | null
          name: string
          title: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio: string
          calendly_url?: string | null
          created_at?: string
          experience_years?: number
          expertise?: string[]
          hourly_rate: number
          id?: string
          is_active?: boolean
          is_verified?: boolean
          linkedin_url?: string | null
          name: string
          title: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          calendly_url?: string | null
          created_at?: string
          experience_years?: number
          expertise?: string[]
          hourly_rate?: number
          id?: string
          is_active?: boolean
          is_verified?: boolean
          linkedin_url?: string | null
          name?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentorship_bookings: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          meeting_link: string | null
          meeting_type: string
          mentor_id: string
          notes: string | null
          scheduled_at: string
          status: string
          topic_id: string
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_link?: string | null
          meeting_type?: string
          mentor_id: string
          notes?: string | null
          scheduled_at: string
          status?: string
          topic_id: string
          total_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_link?: string | null
          meeting_type?: string
          mentor_id?: string
          notes?: string | null
          scheduled_at?: string
          status?: string
          topic_id?: string
          total_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_bookings_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_bookings_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "mentorship_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_topics: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      private_secrets: {
        Row: {
          created_at: string | null
          id: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          certificates: Json | null
          chain_contract_address: string | null
          chain_tx_hash: string | null
          chain_wallet_address: string | null
          created_at: string
          experience_years: number | null
          full_name: string
          github_url: string | null
          hourly_rate: number | null
          id: string
          is_available_as_mentor: boolean | null
          leetcode_url: string | null
          linkedin_url: string | null
          mentor_approved: boolean
          phone: string | null
          skills: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          certificates?: Json | null
          chain_contract_address?: string | null
          chain_tx_hash?: string | null
          chain_wallet_address?: string | null
          created_at?: string
          experience_years?: number | null
          full_name: string
          github_url?: string | null
          hourly_rate?: number | null
          id?: string
          is_available_as_mentor?: boolean | null
          leetcode_url?: string | null
          linkedin_url?: string | null
          mentor_approved?: boolean
          phone?: string | null
          skills?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          certificates?: Json | null
          chain_contract_address?: string | null
          chain_tx_hash?: string | null
          chain_wallet_address?: string | null
          created_at?: string
          experience_years?: number | null
          full_name?: string
          github_url?: string | null
          hourly_rate?: number | null
          id?: string
          is_available_as_mentor?: boolean | null
          leetcode_url?: string | null
          linkedin_url?: string | null
          mentor_approved?: boolean
          phone?: string | null
          skills?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          price: number
          purchased_at: string
          service_name: string
          service_type: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          price: number
          purchased_at?: string
          service_name: string
          service_type: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          price?: number
          purchased_at?: string
          service_name?: string
          service_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      security_reports: {
        Row: {
          created_at: string
          id: string
          report_data: Json | null
          report_status: string
          report_url: string | null
          risk_level: string
          scan_type: string
          scanned_at: string
          scanner_name: string | null
          scanner_phone: string | null
          user_id: string
          vulnerabilities_found: number
          website_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_data?: Json | null
          report_status?: string
          report_url?: string | null
          risk_level?: string
          scan_type?: string
          scanned_at?: string
          scanner_name?: string | null
          scanner_phone?: string | null
          user_id: string
          vulnerabilities_found?: number
          website_url: string
        }
        Update: {
          created_at?: string
          id?: string
          report_data?: Json | null
          report_status?: string
          report_url?: string | null
          risk_level?: string
          scan_type?: string
          scanned_at?: string
          scanner_name?: string | null
          scanner_phone?: string | null
          user_id?: string
          vulnerabilities_found?: number
          website_url?: string
        }
        Relationships: []
      }
      session_reviews: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          mentor_id: string
          rating: number
          review_text: string | null
          reviewer_id: string
          session_completed: boolean
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          mentor_id: string
          rating: number
          review_text?: string | null
          reviewer_id: string
          session_completed?: boolean
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          mentor_id?: string
          rating?: number
          review_text?: string | null
          reviewer_id?: string
          session_completed?: boolean
        }
        Relationships: []
      }
      trigger_error_log: {
        Row: {
          created_at: string | null
          error_message: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_logs: {
        Row: {
          content_hash: string
          content_hash_match: boolean
          created_at: string
          document_name: string
          extracted_data: Json | null
          file_hash: string
          file_hash_match: boolean
          id: string
          matched_document_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          content_hash: string
          content_hash_match?: boolean
          created_at?: string
          document_name: string
          extracted_data?: Json | null
          file_hash: string
          file_hash_match?: boolean
          id?: string
          matched_document_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          content_hash?: string
          content_hash_match?: boolean
          created_at?: string
          document_name?: string
          extracted_data?: Json | null
          file_hash?: string
          file_hash_match?: boolean
          id?: string
          matched_document_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      verified_documents: {
        Row: {
          ai_validation: Json | null
          blockchain_tx: string | null
          chain_block_number: number | null
          chain_contract_address: string | null
          chain_issuer_address: string | null
          chain_tx_hash: string | null
          content_hash: string
          created_at: string
          document_name: string
          document_type: string | null
          extracted_data: Json | null
          file_hash: string
          id: string
          ipfs_cid: string | null
          ipfs_url: string | null
          issuer_name: string | null
          knowledge_graph: Json | null
          status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_validation?: Json | null
          blockchain_tx?: string | null
          chain_block_number?: number | null
          chain_contract_address?: string | null
          chain_issuer_address?: string | null
          chain_tx_hash?: string | null
          content_hash: string
          created_at?: string
          document_name: string
          document_type?: string | null
          extracted_data?: Json | null
          file_hash: string
          id?: string
          ipfs_cid?: string | null
          ipfs_url?: string | null
          issuer_name?: string | null
          knowledge_graph?: Json | null
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_validation?: Json | null
          blockchain_tx?: string | null
          chain_block_number?: number | null
          chain_contract_address?: string | null
          chain_issuer_address?: string | null
          chain_tx_hash?: string | null
          content_hash?: string
          created_at?: string
          document_name?: string
          document_type?: string | null
          extracted_data?: Json | null
          file_hash?: string
          id?: string
          ipfs_cid?: string | null
          ipfs_url?: string | null
          issuer_name?: string | null
          knowledge_graph?: Json | null
          status?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          bank_details: Json | null
          created_at: string
          id: string
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          upi_id: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          bank_details?: Json | null
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          upi_id?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          bank_details?: Json | null
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          upi_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bytea_to_text: { Args: { data: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      text_to_bytea: { Args: { data: string }; Returns: string }
      trigger_security_scan: { Args: { scan_url: string }; Returns: undefined }
      update_coin_balance: {
        Args: {
          p_amount: number
          p_description?: string
          p_razorpay_order_id?: string
          p_razorpay_payment_id?: string
          p_reference_id?: string
          p_type: Database["public"]["Enums"]["transaction_type"]
          p_user_id: string
        }
        Returns: undefined
      }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      learning_request_status:
        | "open"
        | "in_progress"
        | "completed"
        | "cancelled"
      learning_request_type: "learn" | "consulting" | "project_help"
      transaction_type: "purchase" | "spend" | "earn" | "withdrawal" | "refund"
      withdrawal_status: "pending" | "approved" | "rejected" | "completed"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      learning_request_status: [
        "open",
        "in_progress",
        "completed",
        "cancelled",
      ],
      learning_request_type: ["learn", "consulting", "project_help"],
      transaction_type: ["purchase", "spend", "earn", "withdrawal", "refund"],
      withdrawal_status: ["pending", "approved", "rejected", "completed"],
    },
  },
} as const
