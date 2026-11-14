import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Order = {
  id: number;
  status: string;
  totalAmount: string;
  shippingAddress: string;
  createdAt: string;
  items: { title: string; quantity: number; unitPrice: string; fulfillmentStatus: string; cancelReason: string | null; refundAmount: string }[];
  refundStatus?: string | null;
  refundDeadline: string;
  refundWindowOpen: boolean;
};
type BuyerAccount = { storeCredit: string };

function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [reason, setReason] = useState<Record<number, string>>({});
  const [refundMethod, setRefundMethod] = useState<Record<number, "original_payment" | "store_credit">>({});
  const [address, setAddress] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("Loading...");
  const [storeCredit, setStoreCredit] = useState("0.00");
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

  useEffect(() => {
    fetch("http://localhost:3000/api/buyer/account", { headers: { Authorization: "Bearer " + (token || "") } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load store credit.");
        setStoreCredit((data.user as BuyerAccount).storeCredit);
      })
      .catch(() => setMessage("Could not load your store-credit balance."));
  }, [token]);

  async function requestRefund(orderId: number) {
    const response = await fetch(`http://localhost:3000/api/orders/${orderId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: reason[orderId] || "", refundMethod: refundMethod[orderId] || "original_payment" }),
    });
    const data = await response.json();
    setMessage(data.message || data.error || "Refund request submitted.");
    if (response.ok) await loadOrders();
  }

  async function editOrder(orderId: number) {
    const response = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (sessionStorage.getItem("authToken") || "") },
      body: JSON.stringify({ shippingAddress: address[orderId] || "" }),
    });
    const data = await response.json();
    setMessage(data.message || data.error || "Could not edit order.");
    if (response.ok) await loadOrders();
  }

  return (
    <main className="page">
      <div className="page-heading"><div><p className="eyebrow">Your BookHaven journey</p><h2>Order history</h2></div></div>
      <section className="panel form-card">
        <h3>Available store credit: ${Number(storeCredit).toFixed(2)}</h3>
        <p className="muted">For each eligible order, choose whether your refund should go to the original payment method or BookHaven store credit.</p>
      </section>
      {message && <p className="status-message">{message}</p>}
      {orders.length === 0 && !message.includes("Loading") && <div className="panel form-card"><h3>No orders yet.</h3><p className="muted">Your next favorite book is waiting in the collection.</p><Link className="button" to="/buyer">Browse books</Link></div>}
      <div className="stack">
      {orders.map((order) => (
        <article className="order-card form-card" key={order.id}>
          <div className="page-heading"><div><h3>Order #{order.id}</h3><p className="muted">Placed {new Date(order.createdAt).toLocaleString()}</p></div><span className="pill">{order.status}</span></div>
          <p className="price">${Number(order.totalAmount).toFixed(2)}</p>
          <p className="muted">Shipping to: {order.shippingAddress}</p>
          <ul>{order.items.map((item) => <li key={item.title}>
            {item.quantity} x {item.title} (${Number(item.unitPrice).toFixed(2)})
            {item.fulfillmentStatus === "cancelled" && (
              <span className="muted"> · Cancelled by seller{item.cancelReason ? `: ${item.cancelReason}` : ""} · ${Number(item.refundAmount).toFixed(2)} refunded</span>
            )}
          </li>)}</ul>
          {(!order.refundStatus || order.refundStatus === "none") && !["cancelled", "refunded"].includes(order.status) && (
            <p className="muted">
              {order.refundWindowOpen
                ? `Refund available until ${new Date(order.refundDeadline).toLocaleDateString()}`
                : `Return window closed on ${new Date(order.refundDeadline).toLocaleDateString()}`}
            </p>
          )}
          {(!order.refundStatus || order.refundStatus === "none") && !["cancelled", "refunded"].includes(order.status) && order.refundWindowOpen && (
            <>
              <input
                placeholder="Reason for refund request"
                value={reason[order.id] || ""}
                onChange={(event) => setReason({ ...reason, [order.id]: event.target.value })}
              />
              <select
                aria-label={`Refund destination for order ${order.id}`}
                value={refundMethod[order.id] || "original_payment"}
                onChange={(event) => setRefundMethod({ ...refundMethod, [order.id]: event.target.value as "original_payment" | "store_credit" })}
              >
                <option value="original_payment">Refund to original payment</option>
                <option value="store_credit">Refund as BookHaven store credit</option>
              </select>
              <button type="button" onClick={() => requestRefund(order.id)}>Request Refund</button>
            </>
          )}
          {order.status === "paid" && (!order.refundStatus || order.refundStatus === "none") && (
            <div className="order-edit">
              <input
                placeholder="Edit shipping address"
                value={address[order.id] ?? order.shippingAddress}
                onChange={(event) => setAddress({ ...address, [order.id]: event.target.value })}
              />
              <button type="button" onClick={() => editOrder(order.id)}>Save Order Edit</button>
            </div>
          )}
          {order.refundStatus && <p>Refund request: {order.refundStatus}</p>}
        </article>
      ))}
      </div>
    </main>
  );
}

export default OrderHistory;
