import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  async function handleLogin(event) {
    event.preventDefault();

    setMessage("Logging in...");

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      setMessage(error.message);
      return;
    }

    const user = data.user;

    if (!user) {
      setMessage("Could not find your account.");
      return;
    }

    // Check whether the user has created a profile yet.
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select(
          "display_name, date_of_birth, gender, fiveC, bio"
        )
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    // No profile exists yet.
    if (!profile) {
      navigate("/profile");
      return;
    }

    // Check whether the required profile information
    // has been filled out.
    const profileIsComplete =
      profile.display_name &&
      profile.date_of_birth &&
      profile.gender &&
      profile.fiveC &&
      profile.bio;

    if (!profileIsComplete) {
      navigate("/profile");
      return;
    }

    // Profile is complete.
    navigate("/browse");
  }

  return (
    <div
      style={{
        maxWidth: "400px",
        margin: "0 auto",
        padding: "40px 20px 100px",
      }}
    >
      <h1>FiveChat</h1>

      <h2 style={{ marginTop: "20px" }}>
        Log In
      </h2>

      <form onSubmit={handleLogin}>
        <div style={{ marginTop: "20px" }}>
          <label>Email</label>

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            required
            style={{
              display: "block",
              width: "100%",
              padding: "10px",
              marginTop: "5px",
            }}
          />
        </div>

        <div style={{ marginTop: "15px" }}>
          <label>Password</label>

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
            style={{
              display: "block",
              width: "100%",
              padding: "10px",
              marginTop: "5px",
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            marginTop: "20px",
            width: "100%",
            padding: "12px",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Log In
        </button>
      </form>

      {message && (
        <p style={{ marginTop: "15px" }}>
          {message}
        </p>
      )}

      <button
        onClick={() => navigate("/signup")}
        style={{
          marginTop: "15px",
          width: "100%",
          padding: "12px",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        Don't have an account? Sign Up
      </button>
    </div>
  );
}

export default Login;