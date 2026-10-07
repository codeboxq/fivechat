import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import "./Matches.css";

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return "";

  const birthDate = new Date(dateOfBirth);
  const today = new Date();

  let age =
    today.getFullYear() -
    birthDate.getFullYear();

  const monthDifference =
    today.getMonth() -
    birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

function formatLastSeen(lastSeen) {
  if (!lastSeen) {
    return "Offline";
  }

  const difference =
    Date.now() -
    new Date(lastSeen).getTime();

  if (difference < 0) {
    return "Online now";
  }

  const minutes = Math.floor(
    difference / 60000
  );

  if (minutes < 2) {
    return "Online now";
  }

  if (minutes < 60) {
    return `Online ${minutes} ${
      minutes === 1
        ? "minute"
        : "minutes"
    } ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `Online ${hours} ${
      hours === 1
        ? "hour"
        : "hours"
    } ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  return `Online ${days} ${
    days === 1
      ? "day"
      : "days"
  } ago`;
}

function Matches() {
  const navigate = useNavigate();

  const [matches, setMatches] = useState([]);
  const [message, setMessage] =
    useState("Loading matches...");

  const [showHeartMenu, setShowHeartMenu] =
    useState(false);

  const [sendingHeart, setSendingHeart] =
    useState(false);

  useEffect(() => {
    loadMatches();

    let channel;

    async function setupRealtime() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      channel = supabase
        .channel("matches-message-updates")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          async (payload) => {
            if (payload.new.sender_id === user.id) {
              return;
            }

            await loadMatches();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
          },
          async () => {
            await loadMatches();
          }
        )
        .subscribe();
    }

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  async function loadMatches() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    // --------------------------------
    // GET BLOCKED USERS
    // --------------------------------

    const {
      data: blocks,
      error: blockError,
    } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id);

    if (blockError) {
      setMessage(blockError.message);
      return;
    }

    const blockedUserIds =
      (blocks || []).map(
        (block) => block.blocked_id
      );

    // --------------------------------
    // GET MATCHES
    // --------------------------------

    const {
      data: matchData,
      error: matchError,
    } = await supabase
      .from("matches")
      .select(
        "id, user1_id, user2_id, created_at"
      )
      .or(
        `user1_id.eq.${user.id},user2_id.eq.${user.id}`
      )
      .order("created_at", {
        ascending: false,
      });

    if (matchError) {
      setMessage(matchError.message);
      return;
    }

    // --------------------------------
    // REMOVE BLOCKED MATCHES
    // --------------------------------

    const visibleMatches =
      (matchData || []).filter(
        (match) => {
          const otherUserId =
            match.user1_id === user.id
              ? match.user2_id
              : match.user1_id;

          return !blockedUserIds.includes(
            otherUserId
          );
        }
      );

    // --------------------------------
    // GET OTHER USER IDS
    // --------------------------------

    const otherUserIds =
      visibleMatches.map(
        (match) =>
          match.user1_id === user.id
            ? match.user2_id
            : match.user1_id
      );

    // --------------------------------
    // GET PROFILES
    // --------------------------------

    let profileData = [];

    if (otherUserIds.length > 0) {
      const {
        data: profiles,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, display_name, date_of_birth, fiveC, gender, bio, tags, last_seen"
        )
        .in("id", otherUserIds);

      if (profileError) {
        setMessage(profileError.message);
        return;
      }

      profileData = profiles || [];
    }

    // --------------------------------
    // GET PHOTOS
    // --------------------------------

    let photoData = [];

    if (otherUserIds.length > 0) {
      const {
        data: photos,
        error: photoError,
      } = await supabase
        .from("profile_photos")
        .select(
          "id, user_id, photo_url, position"
        )
        .in("user_id", otherUserIds)
        .order("position", {
          ascending: true,
        });

      if (photoError) {
        setMessage(photoError.message);
        return;
      }

      photoData = photos || [];
    }

    // --------------------------------
    // GET MESSAGES
    // --------------------------------

    let messageData = [];

    if (visibleMatches.length > 0) {
      const matchIds =
        visibleMatches.map(
          (match) => match.id
        );

      const {
        data: messages,
        error: messagesError,
      } = await supabase
        .from("messages")
        .select(
          "id, match_id, sender_id, created_at, read_at"
        )
        .in("match_id", matchIds)
        .order("created_at", {
          ascending: false,
        });

      if (messagesError) {
        setMessage(messagesError.message);
        return;
      }

      messageData = messages || [];
    }

    // --------------------------------
    // COMBINE EVERYTHING
    // --------------------------------

    const matchesWithProfiles =
      visibleMatches
        .map((match) => {
          const otherUserId =
            match.user1_id === user.id
              ? match.user2_id
              : match.user1_id;

          const profile =
            profileData.find(
              (profile) =>
                profile.id === otherUserId
            );

          if (!profile) {
            return null;
          }

          const userPhotos =
            photoData
              .filter(
                (photo) =>
                  photo.user_id ===
                  otherUserId
              )
              .sort(
                (a, b) =>
                  a.position -
                  b.position
              );

          const matchMessages =
            messageData.filter(
              (msg) =>
                msg.match_id === match.id
            );

          const latestMessage =
            matchMessages.length > 0
              ? matchMessages[0]
              : null;

          const unreadMessages =
            matchMessages.filter(
              (msg) =>
                msg.sender_id !== user.id &&
                msg.read_at === null
            );

          return {
            ...match,
            profile,
            photo:
              userPhotos[0] ||
              null,
            latestMessage,
            unreadCount:
              unreadMessages.length,
          };
        })
        .filter(Boolean);

    // --------------------------------
    // SORT
    // --------------------------------
    // Matches with unread messages first.
    // Within that, most recently
    // messaged matches come first.

    matchesWithProfiles.sort(
      (a, b) => {
        const aUnread =
          a.unreadCount > 0;

        const bUnread =
          b.unreadCount > 0;

        if (aUnread && !bUnread) {
          return -1;
        }

        if (!aUnread && bUnread) {
          return 1;
        }

        const aTime =
          a.latestMessage
            ? new Date(
                a.latestMessage.created_at
              ).getTime()
            : new Date(
                a.created_at
              ).getTime();

        const bTime =
          b.latestMessage
            ? new Date(
                b.latestMessage.created_at
              ).getTime()
            : new Date(
                b.created_at
              ).getTime();

        return bTime - aTime;
      }
    );

    setMatches(
      matchesWithProfiles
    );

    setMessage("");
  }

  // --------------------------------
  // DELETE MATCH
  // --------------------------------

  async function deleteMatch(match) {
    const confirmed =
      window.confirm(
        `Are you sure you want to delete your chat with ${match.profile.display_name}?`
      );

    if (!confirmed) {
      return;
    }

    const { error } =
      await supabase
        .from("matches")
        .delete()
        .eq("id", match.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMatches(
      (currentMatches) =>
        currentMatches.filter(
          (currentMatch) =>
            currentMatch.id !==
            match.id
        )
    );
  }

  // --------------------------------
  // SEND BLUE HEART
  // --------------------------------

  async function sendBlueHeart(match) {
    if (sendingHeart) {
      return;
    }

    const confirmed =
      window.confirm(
        `Send ${match.profile.display_name} a 💙 for 25C?`
      );

    if (!confirmed) {
      return;
    }

    setSendingHeart(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in.");
      setSendingHeart(false);
      return;
    }

    const { error } =
      await supabase.rpc(
        "send_blue_heart",
        {
          p_match_id: match.id,
          p_recipient_id:
            match.profile.id,
        }
      );

    if (error) {
      setMessage(error.message);
      setSendingHeart(false);
      return;
    }

    setMessage(
      `You sent ${match.profile.display_name} a 💙!`
    );

    setShowHeartMenu(false);
    setSendingHeart(false);

    await loadMatches();
  }

  // --------------------------------
  // LOADING
  // --------------------------------

  if (message === "Loading matches...") {
    return (
      <div className="matches-page">
        <p>Loading matches...</p>
      </div>
    );
  }

  // --------------------------------
  // MATCHES PAGE
  // --------------------------------

  return (
    <div className="matches-page">

      {/* HEADER */}

      <div className="matches-header">
        <h1>Matches</h1>

        <button
          className="matches-heart-button"
          onClick={() =>
            setShowHeartMenu(
              (current) => !current
            )
          }
        >
          Send a 💙: 25C
        </button>

        {/* HEART MENU */}

        {showHeartMenu && (
          <div className="matches-heart-menu">
            <h3>Send a 💙</h3>

            {matches.length === 0 ? (
              <p>
                You don't have any
                matches yet.
              </p>
            ) : (
              matches.map((match) => (
                <button
                  key={match.id}
                  className="matches-heart-recipient"
                  onClick={() =>
                    sendBlueHeart(match)
                  }
                  disabled={sendingHeart}
                >
                  {match.profile.display_name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* NO MATCHES */}

      {matches.length === 0 ? (
        <div className="matches-empty">
          <h2>No matches yet.</h2>

          <p>
            When you match with someone,
            they'll appear here.
          </p>
        </div>
      ) : (
        <div className="matches-list">
          {matches.map((match) => {
            const profile =
              match.profile;

            const age =
              calculateAge(
                profile.date_of_birth
              );

            const lastSeenText =
              formatLastSeen(
                profile.last_seen
              );

            const isOnline =
              lastSeenText ===
              "Online now";

            return (
              <div
                key={match.id}
                className={`matches-row ${
                  match.unreadCount > 0
                    ? "has-unread"
                    : ""
                }`}
                onClick={() =>
                  navigate(
                    `/chat/${match.id}`
                  )
                }
              >

                {/* PROFILE PHOTO */}

                <div className="matches-photo-wrapper">
                  {match.photo ? (
                    <img
                      src={
                        match.photo
                          .photo_url
                      }
                      alt={`${profile.display_name}'s profile`}
                      className="matches-photo"
                    />
                  ) : (
                    <div className="matches-no-photo">
                      No photo
                    </div>
                  )}

                  {/* UNREAD RED DOT */}

                  {match.unreadCount >
                    0 && (
                    <span className="matches-unread-dot" />
                  )}
                </div>

                {/* PROFILE INFO */}

                <div className="matches-row-info">
                  <div className="matches-row-top">
                    <h2>
                      {profile.display_name}
                      {age &&
                        `, ${age}`}
                    </h2>

                    <span
                      className={
                        isOnline
                          ? "matches-online"
                          : "matches-last-seen"
                      }
                    >
                      {isOnline
                        ? "Online"
                        : lastSeenText}
                    </span>
                  </div>

                  <p className="matches-row-school">
                    {profile.fiveC}
                  </p>

                  <p className="matches-row-preview">
                    {match.latestMessage
                      ? match.latestMessage.sender_id ===
                        profile.id
                        ? "New message"
                        : "You sent a message"
                      : "You matched!"}
                  </p>
                </div>

                {/* DELETE */}

                <button
                  className="matches-delete-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteMatch(match);
                  }}
                  aria-label={`Delete chat with ${profile.display_name}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* STATUS MESSAGE */}

      {message &&
        message !==
          "Loading matches..." && (
          <p className="matches-status-message">
            {message}
          </p>
        )}
    </div>
  );
}

export default Matches;