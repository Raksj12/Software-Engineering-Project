import { useEffect, useState } from "react";

type InboxMessage = { id?: number; message: string; createdAt: string; isRead?: boolean };

function RoleInbox({ role }: { role: "admin" | "seller" | "buyer" }) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [wishlistInterest, setWishlistInterest] = useState<InboxMessage[]>([]);

  useEffect(() => {
    const token = sessionStorage.getItem("authToken") || "";
    const path = role === "admin" ? "admin/inbox" : role === "seller" ? "seller/orders/inbox" : "notifications";
    fetch(`http://localhost:3000/api/${path}`, { headers: { Authorization: "Bearer " + token } })
      .then((response) => response.json())
      .then((data) => {
        setMessages(data.messages || data.notifications || []);
        setWishlistInterest(data.wishlistInterest || []);
      })
      .catch(() => {
        setMessages([{ message: "Inbox could not be loaded.", createdAt: new Date().toISOString() }]);
      });
  }, [role]);

  async function markRead(id: number) {
    const token = sessionStorage.getItem("authToken") || "";
    await fetch(`http://localhost:3000/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + token },
    });
    setMessages((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
    window.dispatchEvent(new Event("notifications-changed"));
  }

  const allMessages = [...wishlistInterest, ...messages]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <section className="panel form-card role-inbox">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{role === "admin" ? "Supervision inbox" : role === "seller" ? "Buyer requests" : "Your notifications"}</p>
          <h3>{role === "admin" ? "Marketplace activity inbox" : role === "seller" ? "Seller inbox" : "Buyer inbox"}</h3>
          <p className="muted">
            {role === "admin"
              ? "Review buyer orders, edits, returns, wishlist activity, and seller-facing events."
              : role === "seller"
                ? "Review buyer return requests, order messages, and wishlist interest in your books."
                : "Review order updates, return/refund decisions, shipping updates, and other marketplace notifications."}
          </p>
        </div>
      </div>
      {allMessages.length === 0 ? <p className="muted">No new messages.</p> : (
        <div className="stack">
          {allMessages.map((item, index) => (
            <div className={`inbox-message ${item.isRead ? "read" : "unread"}`} key={`${item.id ?? "wishlist"}-${item.createdAt}-${index}`}>
              <div>
                <strong>{item.message}</strong>
                <p className="muted">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
              {item.id && !item.isRead && <button type="button" onClick={() => markRead(item.id!)}>Mark read</button>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default RoleInbox;
