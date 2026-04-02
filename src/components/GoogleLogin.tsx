import { FC } from "react";
import { useGoogleAuth } from "../hooks/useGoogleAuth";

const GoogleLogin: FC = () => {
  const { signInWithGoogle } = useGoogleAuth();

  return (
    <button
      onClick={signInWithGoogle}
      style={{
        padding: "10px 16px",
        borderRadius: "6px",
        border: "1px solid #ddd",
        cursor: "pointer",
      }}
    >
      Continue with Google
    </button>
  );
};

export default GoogleLogin;
