import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Order = {
  id: number;
  status: string;
  totalAmount: string;
  shippingAddress: string;
  createdAt: string;
  items: { title: string; quantity: number; unitPrice: string }[];
  refundStatus?: string | null;
};

function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [reason, setReason] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("Loading...");
  const token = sessionStorage.getItem("authToken");

  async function loadOrders() {
    const response = await fetch("http://localhost:3000/api/orders", { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load orders.");
    setOrders(data.orders);
    setMessage("");
  }

  useEffect(() => {
    // The request synchronizes this component with the server-side order history.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load orders."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestRefund(orderId: number) {
    const response = await fetch(`http://localhost:3000/api/orders/${orderId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: reason[orderId] || "" }),
    });
    const data = await response.json();
    setMessage(data.message || data.error || "Refund request submitted.");
    if (response.ok) await loadOrders();
  }

  return (
    <main className="page">
      <div className="page-heading"><div><p className="eyebrow">Your BookHaven journey</p><h2>Order history</h2></div></div>
      {message && <p className="status-message">{message}</p>}
      {orders.length === 0 && !message.includes("Loading") && <div className="panel form-card"><h3>No orders yet.</h3><p className="muted">Your next favorite book is waiting in the collection.</p><Link className="button" to="/buyer">Browse books</Link></div>}
      <div className="stack">
      {orders.map((order) => (
        <article className="order-card form-card" key={order.id}>
          <div className="page-heading"><div><h3>Order #{order.id}</h3><p className="muted">Placed {new Date(order.createdAt).toLocaleString()}</p></div><span className="pill">{order.status}</span></div>
          <p className="price">${Number(order.totalAmount).toFixed(2)}</p>
          <p className="muted">Shipping to: {order.shippingAddress}</p>
          <ul>{order.items.map((item) => <li key={item.title}>{item.quantity} x {item.title} (${Number(item.unitPrice).toFixed(2)})</li>)}</ul>
          {!order.refundStatus && !["cancelled", "refunded"].includes(order.status) && (
            <>
              <input
                placeholder="Reason for refund"
                value={reason[order.id] || ""}
                onChange={(event) => setReason({ ...reason, [order.id]: event.target.value })}
              />
              <button type="button" onClick={() => requestRefund(order.id)}>Request Refund</button>
            </>
          )}
          {order.refundStatus && <p>Refund request: {order.refundStatus}</p>}
        </article>
      ))}
      </div>
    </main>
  );
}

export default OrderHistory;
