import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Notification = {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const API = "http://localhost:3000/api/notifications";

// Tells the nav link to refresh its unread count
function announceChange() {
  window.dispatchEvent(new Event("notifications-changed"));
}

async function fetchNotifications(): Promise<Notification[]> {
  const token = sessionStorage.getItem("authToken");
  const response = await fetch(API, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load notifications.");
  }

  return data.notifications as Notification[];
}

// Nav link that shows how many notifications are unread
export function NotificationsLink() {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!sessionStorage.getItem("authToken")) {
      setUnread(0);
      return;
    }
    try {
      const list = await fetchNotifications();
      setUnread(list.filter((item) => !item.isRead).length);
    } catch {
      setUnread(0);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Check again every 30 seconds and whenever the page changes a notification
    const interval = setInterval(refresh, 30 * 1000);
    window.addEventListener("notifications-changed", refresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications-changed", refresh);
    };
  }, [refresh]);

  return <Link to="/notifications">Notifications{unread > 0 ? ` (${unread})` : ""}</Link>;
}

function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications()
      .then(setNotifications)
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  // Mark one notification as read
  async function markRead(id: string) {
    const response = await fetch(`${API}/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${sessionStorage.getItem("authToken")}` },
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Could not mark as read.");
    }
  }

  async function handleMarkRead(id: string) {
    setMessage("");

    try {
      await markRead(id);
      setNotifications((previous) =>
        previous.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
      announceChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect to the server.");
    }
  }

  async function handleMarkAllRead() {
    setMessage("");
    const unreadItems = notifications.filter((item) => !item.isRead);

    try {
      await Promise.all(unreadItems.map((item) => markRead(item.id)));
      setNotifications((previous) => previous.map((item) => ({ ...item, isRead: true })));
      announceChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect to the server.");
    }
  }

  if (loading) {
    return <p>Loading notifications...</p>;
  }

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <div>
      <h2>Notifications</h2>

      {message && <p role="status">{message}</p>}

      {notifications.length === 0 ? (
        <p>You have no notifications.</p>
      ) : (
        <>
          <p>{unreadCount} unread</p>

          {unreadCount > 0 && (
            <button type="button" onClick={handleMarkAllRead}>
              Mark all as read
            </button>
          )}

          <ul>
            {notifications.map((item) => (
              <li key={item.id}>
                <p>{item.isRead ? item.message : <strong>{item.message}</strong>}</p>
                <small>{new Date(item.createdAt).toLocaleString()}</small>{" "}
                {!item.isRead && (
                  <button type="button" onClick={() => handleMarkRead(item.id)}>
                    Mark as read
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default Notifications;