import { useState } from "react";
import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";

function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignup(event) {
    event.preventDefault();

    setMessage("Creating account...");

    const { error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
  "Account created! Check your email to confirm your account. If you don't see it, check your spam folder!"
);
  }

  return (
    <div>
      <h2>Create an Account</h2>

      <form onSubmit={handleSignup}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <button type="submit">Sign Up</button>
      </form>

      <p>{message}</p>
      <button onClick={() => navigate("/")}>
            Already have an account? Log In
        </button>
    </div>
  );
}

export default Signup;