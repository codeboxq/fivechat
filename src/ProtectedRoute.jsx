import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

function ProtectedRoute({ children, requireCompleteProfile = true }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setUser(user);

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("display_name, date_of_birth, gender, fiveC, bio")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error checking profile:", error);
      setLoading(false);
      return;
    }

    if (!profile) {
      setProfileComplete(false);
      setLoading(false);
      return;
    }

    const complete =
      Boolean(profile.display_name) &&
      Boolean(profile.date_of_birth) &&
      Boolean(profile.gender) &&
      Boolean(profile.fiveC) &&
      Boolean(profile.bio);

    setProfileComplete(complete);
    setLoading(false);
  }

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requireCompleteProfile && !profileComplete) {
    return <Navigate to="/profile" replace />;
  }

  return children;
}

export default ProtectedRoute;