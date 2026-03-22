import { supabase } from "@/integrations/supabase/client";

export const useGoogleAuth = () => {
  const signInWithGoogle = async (): Promise<void> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
    });

    if (error) {
      console.error("Google login error:", error.message);
    }
  };

  return { signInWithGoogle };
};
