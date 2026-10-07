import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "./supabaseClient";
import "./Chat.css";

function Chat() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [message, setMessage] = useState("Loading chat...");
  const [showMenu, setShowMenu] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadChat();
  }, [matchId]);

  useEffect(() => {
    if (!matchId || !currentUserId || message) {
      return;
    }

    const channel = supabase
      .channel(`chat-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          setMessages((currentMessages) => {
            if (
              currentMessages.some(
                (msg) => msg.id === payload.new.id
              )
            ) {
              return currentMessages;
            }

            return [...currentMessages, payload.new];
          });

          if (
            payload.new.sender_id !== currentUserId &&
            payload.new.read_at === null
          ) {
            markMessageAsRead(payload.new.id);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          setMessages((currentMessages) =>
            currentMessages.map((msg) =>
              msg.id === payload.new.id
                ? payload.new
                : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, currentUserId, message]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  async function loadChat() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    setCurrentUserId(user.id);

    const { data: match, error: matchError } =
      await supabase
        .from("matches")
        .select("id, user1_id, user2_id")
        .eq("id", matchId)
        .maybeSingle();

    if (matchError) {
      setMessage(matchError.message);
      return;
    }

    if (!match) {
      setMessage("Match not found.");
      return;
    }

    if (
      match.user1_id !== user.id &&
      match.user2_id !== user.id
    ) {
      setMessage("You don't have access to this chat.");
      return;
    }

    const otherUserId =
      match.user1_id === user.id
        ? match.user2_id
        : match.user1_id;

    const { data: blocks, error: blockError } =
      await supabase
        .from("blocks")
        .select("id, blocker_id, blocked_id")
        .or(
          `and(blocker_id.eq.${user.id},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${user.id})`
        );

    if (blockError) {
      setMessage(blockError.message);
      return;
    }

    if (blocks && blocks.length > 0) {
      setMessage(
        "This conversation is unavailable because one of you has blocked the other."
      );
      return;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", otherUserId)
        .maybeSingle();

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    setOtherUser(profile);

    const {
      data: messageData,
      error: messageError,
    } = await supabase
      .from("messages")
      .select(
        "id, sender_id, content, created_at, read_at"
      )
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (messageError) {
      setMessage(messageError.message);
      return;
    }

    setMessages(messageData || []);

    const unreadMessageIds = (messageData || [])
      .filter(
        (msg) =>
          msg.sender_id !== user.id &&
          msg.read_at === null
      )
      .map((msg) => msg.id);

    if (unreadMessageIds.length > 0) {
      const readTime = new Date().toISOString();

      const { error: readError } = await supabase
        .from("messages")
        .update({
          read_at: readTime,
        })
        .in("id", unreadMessageIds);

      if (readError) {
        console.error(
          "Error marking messages as read:",
          readError
        );
      } else {
        setMessages((currentMessages) =>
          currentMessages.map((msg) =>
            unreadMessageIds.includes(msg.id)
              ? {
                  ...msg,
                  read_at: readTime,
                }
              : msg
          )
        );
      }
    }

    setMessage("");
  }

  async function markMessageAsRead(messageId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const readTime = new Date().toISOString();

    const { error } = await supabase
      .from("messages")
      .update({
        read_at: readTime,
      })
      .eq("id", messageId)
      .eq("match_id", matchId)
      .neq("sender_id", user.id)
      .is("read_at", null);

    if (error) {
      console.error(
        "Error marking message as read:",
        error
      );
      return;
    }

    setMessages((currentMessages) =>
      currentMessages.map((msg) =>
        msg.id === messageId
          ? { ...msg, read_at: readTime }
          : msg
      )
    );
  }

  async function sendMessage(event) {
    event.preventDefault();

    const trimmedMessage = messageText.trim();

    if (!trimmedMessage) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    if (!otherUser) {
      return;
    }

    const { data: blocks, error: blockError } =
      await supabase
        .from("blocks")
        .select("id")
        .or(
          `and(blocker_id.eq.${user.id},blocked_id.eq.${otherUser.id}),and(blocker_id.eq.${otherUser.id},blocked_id.eq.${user.id})`
        );

    if (blockError) {
      setMessage(blockError.message);
      return;
    }

    if (blocks && blocks.length > 0) {
      setMessage(
        "This conversation is unavailable because one of you has blocked the other."
      );
      setMessageText("");
      return;
    }

    const {
      data: newMessage,
      error,
    } = await supabase
      .from("messages")
      .insert({
        match_id: matchId,
        sender_id: user.id,
        content: trimmedMessage,
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      newMessage,
    ]);

    setMessageText("");
  }

  async function blockUser() {
    if (!otherUser) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to block ${otherUser.display_name}? You will no longer be able to message each other.`
    );

    if (!confirmed) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    const { error } = await supabase
      .from("blocks")
      .insert({
        blocker_id: user.id,
        blocked_id: otherUser.id,
      });

    if (error) {
      if (error.message.includes("duplicate")) {
        setMessage("You already blocked this person.");
      } else {
        setMessage(error.message);
      }

      return;
    }

    navigate("/matches");
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (message) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 20px",
        }}
      >
        <p>{message}</p>

        <button
          onClick={() => navigate("/matches")}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Back to Matches
        </button>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <button onClick={() => navigate("/matches")}>
          ←
        </button>

        <h2>{otherUser?.display_name}</h2>

        <div
          style={{
            position: "relative",
            marginLeft: "auto",
          }}
        >
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              padding: "5px 10px",
            }}
          >
            ⋯
          </button>

          {showMenu && (
            <div
              style={{
                position: "absolute",
                top: "45px",
                right: "0",
                background: "white",
                border: "1px solid #ddd",
                borderRadius: "10px",
                boxShadow:
                  "0 4px 12px rgba(0, 0, 0, 0.15)",
                overflow: "hidden",
                zIndex: 10,
                minWidth: "150px",
              }}
            >
              <button
                onClick={blockUser}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "white",
                  border: "none",
                  color: "#d00",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "15px",
                }}
              >
                🚫 Block
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <p>No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => {
            const isMine =
              msg.sender_id === currentUserId;

            return (
              <div
                key={msg.id}
                className={
                  isMine
                    ? "message-row message-row-mine"
                    : "message-row message-row-theirs"
                }
              >
                <div
                  className={
                    isMine
                      ? "message-bubble message-bubble-mine"
                      : "message-bubble message-bubble-theirs"
                  }
                >
                  {!isMine && (
                    <strong>
                      {otherUser?.display_name}
                    </strong>
                  )}

                  <p>{msg.content}</p>

                  <small>
                    {formatTime(msg.created_at)}

                    {isMine && msg.read_at && (
                      <> · Read</>
                    )}
                  </small>
                </div>
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        className="chat-input"
        onSubmit={sendMessage}
      >
        <input
          type="text"
          placeholder="Message..."
          value={messageText}
          onChange={(event) =>
            setMessageText(event.target.value)
          }
        />

        <button type="submit">
          Send
        </button>
      </form>
    </div>
  );
}

export default Chat;