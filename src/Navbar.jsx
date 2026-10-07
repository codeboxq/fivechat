import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
  let channel;

  async function loadUnreadCount() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUnreadCount(0);
      return;
    }

    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .neq("sender_id", user.id)
      .is("read_at", null);

    if (error) {
      console.error("Error loading unread messages:", error);
      return;
    }

    setUnreadCount(count || 0);
  }

  loadUnreadCount();

  channel = supabase
    .channel("navbar-unread-messages")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
      },
      () => {
        loadUnreadCount();
      }
    )
    .subscribe();

  return () => {
    if (channel) {
      supabase.removeChannel(channel);
    }
  };
}, []);
  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);
  }
async function handleLogout() {
  const confirmed = window.confirm(
    "Are you sure you want to log out?"
  );

  if (!confirmed) return;

  await supabase.auth.signOut();
  navigate("/");
}

  // Don't show the navbar when logged out
  if (!user) {
    return null;
  }

return (
  <nav className="navbar">
    <button onClick={() => navigate("/browse")}>
      ❤️ Browse
    </button>

    <button onClick={() => navigate("/extras")}>
      Extras
    </button>

<button onClick={() => navigate("/matches")}>
  <span className="matches-nav-label">
    {unreadCount > 0 && (
      <span className="matches-unread-badge">
        {unreadCount > 9 ? "9+" : unreadCount}
      </span>
    )}
    Matches
  </span>
</button>

    <button onClick={() => navigate("/profile")}>
      Profile
    </button>

    <button onClick={handleLogout}>
      Log Out
    </button>
  </nav>
);
}

export default Navbar;