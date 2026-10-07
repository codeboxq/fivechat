import { BrowserRouter, Routes, Route } from "react-router-dom";

import Signup from "./Signup";
import Login from "./Login";
import Profile from "./Profile";
import Browse from "./Browse";
import Matches from "./Matches";
import Navbar from "./Navbar";
import ProtectedRoute from "./ProtectedRoute";
import Chat from "./Chat";
import Games from "./Games";
import { useEffect } from "react";
import { supabase } from "./supabaseClient";

function App() {
  useEffect(() => {
  let interval;

  async function updateLastSeen() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", user.id);
  }

  updateLastSeen();

  interval = setInterval(updateLastSeen, 60000);

  return () => clearInterval(interval);
}, []);
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/signup" element={<Signup />} />

        {/* Profile only requires the user to be logged in.
            Incomplete profiles are allowed here so they can finish setup. */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute requireCompleteProfile={false}>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* All other protected pages require a complete profile. */}
        <Route
          path="/browse"
          element={
            <ProtectedRoute>
              <Browse />
            </ProtectedRoute>
          }
        />

        <Route
          path="/extras"
          element={
            <ProtectedRoute>
              <Games />
            </ProtectedRoute>
          }
        />

        <Route
          path="/matches"
          element={
            <ProtectedRoute>
              <Matches />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat/:matchId"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;