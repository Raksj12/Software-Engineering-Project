import { useEffect, useState } from "react";

type PendingListing = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  genre: string;
  condition: string;
  description: string;
  price: string;
  stock: number;
  sellerName: string;
  imagePath: string | null;
  createdAt: string;
  flagged: boolean;
  matchedPhrases: string[];
  isbnValid: boolean;
};
type AdminOrder = { id: number; buyerName: string; status: string; totalAmount: string; refundStatus: string };
type AdminRefund = { id: number; orderId: number; buyerName: string; reason: string; status: string };

// Get listings waiting for review, oldest first
async function fetchPendingListings() {
  const token = sessionStorage.getItem("authToken");
  const response = await fetch("http://localhost:3000/api/admin/listings?status=pending", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load pending listings.");
  }

  return data.listings as PendingListing[];
}

function AdminHome() {
  const [listings, setListings] = useState<PendingListing[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [refunds, setRefunds] = useState<AdminRefund[]>([]);

  useEffect(() => {
    fetchPendingListings()
      .then(setListings)
      .catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem("authToken");
    Promise.all([
      fetch("http://localhost:3000/api/admin/orders", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("http://localhost:3000/api/admin/refunds", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ]).then(([orderData, refundData]) => {
      setOrders(orderData.orders || []);
      setRefunds(refundData.refunds || []);
    }).catch(() => setMessage("Could not load orders or refunds."));
  }, []);

  async function decideRefund(id: number, decision: "approve" | "reject") {
    const token = sessionStorage.getItem("authToken");
    const response = await fetch(`http://localhost:3000/api/admin/refunds/${id}/${decision}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    setMessage(data.error || (response.ok ? "Refund updated." : "Could not update refund."));
  }

  // Approve or reject a listing, then refresh the queue
  async function reviewListing(id: string, action: "approve" | "reject") {
    setMessage("");

    try {
      const response = await fetch(`http://localhost:3000/api/admin/listings/${id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({ reason: reasons[id] || "" }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || `Could not ${action} the listing.`);
        return;
      }

      setMessage(action === "approve" ? "Listing approved." : "Listing rejected.");
      setListings(await fetchPendingListings());
    } catch {
      setMessage("Could not connect to the server.");
    }
  }

  return (
    <main className="page">
      <div className="page-heading"><div><p className="eyebrow">Platform control</p><h2>Administration dashboard</h2><p className="muted">Review marketplace activity and keep BookHaven trustworthy.</p></div></div>
      <section className="panel form-card">
      <h3>Book upload requests</h3>

      {message && <p className="status-message">{message}</p>}

      {listings.length === 0 && <p>There are no listings waiting for review.</p>}

      <ul className="admin-list">
        {listings.map((listing) => (
          <li className="admin-item panel" key={listing.id}>
            {listing.imagePath ? (
              <img src={`http://localhost:3000${listing.imagePath}`} alt={`Cover of ${listing.title}`} width={150} />
            ) : (
              <p>No cover image</p>
            )}
            <h3>{listing.title}</h3>
            <p>by {listing.author}</p>
            <p>Seller: {listing.sellerName}</p>
            <p>Submitted: {new Date(listing.createdAt).toLocaleString()}</p>
            <p>
              ${Number(listing.price).toFixed(2)} | {listing.stock} in stock | Genre: {listing.genre} |
              Condition: {listing.condition}
            </p>
            <p>ISBN: {listing.isbn} {listing.isbnValid ? "(valid)" : "(INVALID)"}</p>
            <p>{listing.description}</p>

            {listing.flagged && (
              <p>Warning: contains prohibited words: {listing.matchedPhrases.join(", ")}</p>
            )}

            <button type="button" onClick={() => reviewListing(listing.id, "approve")}>
              Approve
            </button>

            <input
              type="text"
              placeholder="Reason for rejection"
              value={reasons[listing.id] || ""}
              onChange={(event) => setReasons({ ...reasons, [listing.id]: event.target.value })}
            />

            <button type="button" onClick={() => reviewListing(listing.id, "reject")}>
              Reject
            </button>
          </li>
        ))}
      </ul>
      </section>
      <section className="panel form-card">
      <h3>Platform orders</h3>
      {orders.length === 0 ? <p>No orders.</p> : orders.map((order) => <p key={order.id}>Order #{order.id} — {order.buyerName} — {order.status} — ${Number(order.totalAmount).toFixed(2)} — refund: {order.refundStatus}</p>)}
      <h3>Platform refunds</h3>
      {refunds.length === 0 ? <p>No refunds.</p> : refunds.map((refund) => (
        <div key={refund.id}>
          <p>Order #{refund.orderId} — {refund.buyerName} — {refund.reason} — {refund.status}</p>
          {refund.status === "requested" && <><button type="button" onClick={() => decideRefund(refund.id, "approve")}>Approve Refund</button><button type="button" onClick={() => decideRefund(refund.id, "reject")}>Deny Refund</button></>}
        </div>
      ))}
      </section>
    </main>
  );
}

export default AdminHome;
