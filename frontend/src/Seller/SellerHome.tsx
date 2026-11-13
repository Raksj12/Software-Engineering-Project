import { useEffect, useState } from "react";

type Listing = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  genre: string;
  condition: string;
  price: string;
  stock: number;
  imagePath: string | null;
  status: string;
  rejectionReason: string | null;
};
type Sale = { orderId: number; productId: number; title: string; quantity: number; fulfillmentStatus: string; carrier: string | null; trackingNumber: string | null };
type Refund = { id: number; orderId: number; buyerName: string; reason: string; status: string; refundMethod?: string; refundAmount?: string };
type EarningsLine = { title: string; itemsSold: number; grossSales: string; orderCount: number };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending Review",
  approved: "Published",
  rejected: "Rejected",
  archived: "Disabled by admin",
};

function isValidPrice(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.trim()) && Number(value) > 0;
}

// Get the logged-in seller's own listings
async function fetchMyListings() {
  const token = sessionStorage.getItem("authToken");
  const response = await fetch("http://localhost:3000/api/seller/listings", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load your listings.");
  }

  return data.listings as Listing[];
}

function SellerHome() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [genre, setGenre] = useState("");
  const [genreOptions, setGenreOptions] = useState<string[]>([]);
  const [condition, setCondition] = useState("new");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [image, setImage] = useState<File | null>(null);
  // Changing this key clears the file input after an upload
  const [fileInputKey, setFileInputKey] = useState(0);
  const [message, setMessage] = useState("");
  const [listMessage, setListMessage] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [earnings, setEarnings] = useState<{ grossSales: string; itemsSold: number; orderCount: number } | null>(null);
  const [earningsBreakdown, setEarningsBreakdown] = useState<EarningsLine[]>([]);

  useEffect(() => {
    fetchMyListings()
      .then(setListings)
      .catch((error) => setListMessage(error.message));
  }, []);

  // Load the genres sellers can choose from
  useEffect(() => {
    fetch("http://localhost:3000/api/listings/genres")
      .then((r) => r.json())
      .then((d) => setGenreOptions(d.genres || []))
      .catch(() => setGenreOptions([]));
  }, []);

  useEffect(() => {
    fetch("http://localhost:3000/api/seller/orders/earnings/breakdown", { headers: { Authorization: "Bearer " + (sessionStorage.getItem("authToken") || "") } })
      .then((response) => response.json())
      .then((data) => setEarningsBreakdown(data.breakdown || []))
      .catch(() => setListMessage("Could not load earnings breakdown."));
  }, []);

  useEffect(() => {
    fetch("http://localhost:3000/api/seller/orders/earnings", { headers: { Authorization: "Bearer " + (sessionStorage.getItem("authToken") || "") } })
      .then((response) => response.json())
      .then(setEarnings)
      .catch(() => setListMessage("Could not load earnings."));
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem("authToken");
    Promise.all([
      fetch("http://localhost:3000/api/seller/orders", { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()),
      fetch("http://localhost:3000/api/seller/orders/refunds", { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()),
    ]).then(([orders, refundData]) => {
      setSales(orders.items || []);
      setRefunds(refundData.refunds || []);
    }).catch(() => setListMessage("Could not load sales or refund requests."));
  }, []);

  async function updateSale(sale: Sale, action: "process" | "ship" | "cancel") {
    const token = sessionStorage.getItem("authToken");
    const body = action === "ship" ? { carrier: "USPS", trackingNumber: "DEMO123456" } : action === "cancel" ? { reason: "Unable to fulfill" } : {};
    const response = await fetch(`http://localhost:3000/api/seller/orders/${sale.orderId}/items/${sale.productId}/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    const data = await response.json();
    setListMessage(data.error || (response.ok ? "Order updated." : "Could not update order."));
    if (response.ok) setSales((await fetch("http://localhost:3000/api/seller/orders", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())).items);
  }

  async function decideRefund(id: number, decision: "approve" | "reject") {
    const token = sessionStorage.getItem("authToken");
    const response = await fetch(`http://localhost:3000/api/seller/orders/refunds/${id}/${decision}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    setListMessage(data.error || (response.ok ? "Refund request updated." : "Could not update refund."));
    if (response.ok) setRefunds((await fetch("http://localhost:3000/api/seller/orders/refunds", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())).refunds);
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!isValidPrice(price)) {
      setMessage("Enter a valid price greater than 0 with no more than two decimal places (for example, 12.99).");
      return;
    }

    // Send the listing as form data so the cover image file can be included
    const formData = new FormData();
    formData.append("title", title);
    formData.append("author", author);
    formData.append("isbn", isbn);
    formData.append("genre", genre);
    formData.append("condition", condition);
    formData.append("description", description);
    formData.append("price", price);
    formData.append("stock", stock);
    if (image) {
      formData.append("image", image);
    }

    try {
      const response = await fetch("http://localhost:3000/api/seller/listings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("authToken")}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not upload the listing.");
        return;
      }

      setMessage(data.message);

      // Clear the form for the next listing
      setTitle("");
      setAuthor("");
      setIsbn("");
      setGenre("");
      setCondition("new");
      setDescription("");
      setPrice("");
      setStock("");
      setImage(null);
      setFileInputKey((key) => key + 1);

      setListings(await fetchMyListings());
    } catch {
      setMessage("Could not connect to the server.");
    }
  }

  const pendingSales = sales.filter((sale) => sale.fulfillmentStatus === "pending").length;
  const openRefunds = refunds.filter((refund) => refund.status === "requested").length;

  return (
    <main className="page seller-workspace">
      <header className="seller-hero">
        <div><p className="eyebrow">Seller workspace</p><h1>Operate your bookstore.</h1><p className="muted">A focused view of your catalog, fulfillment, earnings, and customer care.</p></div>
        <span className="seller-live-status"><span /> Store active</span>
      </header>
      {listMessage && <p className="status-message">{listMessage}</p>}
      <section className="seller-dashboard-metrics">
        <div><span>Gross sales</span><strong>${Number(earnings?.grossSales || 0).toFixed(2)}</strong><small>eligible orders</small></div>
        <div><span>Active listings</span><strong>{listings.filter((listing) => listing.status === "approved").length}</strong><small>published books</small></div>
        <div><span>Fulfillment queue</span><strong>{pendingSales}</strong><small>orders to process</small></div>
        <div><span>Customer care</span><strong>{openRefunds}</strong><small>refunds awaiting review</small></div>
      </section>
      {earnings && (
        <section className="panel seller-control-panel">
          <div className="seller-section-heading"><div><p className="eyebrow">Performance</p><h2>Earnings overview</h2></div><span className="pill">{earnings.itemsSold} items sold</span></div>
          <div className="earnings-metrics">
            <div><span className="muted">Gross sales</span><strong>${Number(earnings.grossSales).toFixed(2)}</strong></div>
            <div><span className="muted">Items sold</span><strong>{earnings.itemsSold}</strong></div>
            <div><span className="muted">Orders</span><strong>{earnings.orderCount}</strong></div>
          </div>
          <h3>Sales by listing</h3>
          {earningsBreakdown.length === 0 ? <p className="muted">No completed sales yet.</p> : (
            <div className="earnings-breakdown">
              {earningsBreakdown.map((line) => (
                <div className="earnings-line" key={line.title}>
                  <strong>{line.title}</strong>
                  <span>{line.itemsSold} items · {line.orderCount} orders</span>
                  <b>${Number(line.grossSales || 0).toFixed(2)}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      <div className="seller-workspace-grid">
      <section className="panel seller-control-panel">
      <div className="seller-section-heading"><div><p className="eyebrow">Catalog</p><h2>Add a book</h2></div></div>

      <form onSubmit={handleUpload}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Author"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          required
        />

        <input
          type="text"
          placeholder="ISBN-10 or ISBN-13"
          value={isbn}
          onChange={(event) => setIsbn(event.target.value)}
          required
        />

        <select value={genre} onChange={(event) => setGenre(event.target.value)} required>
          <option value="">Select a genre</option>
          {genreOptions.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <select value={condition} onChange={(event) => setCondition(event.target.value)}>
          <option value="new">New</option>
          <option value="used">Used</option>
        </select>

        <textarea
          placeholder="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Price"
          min="0.01"
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Stock"
          min="0"
          step="1"
          value={stock}
          onChange={(event) => setStock(event.target.value)}
          required
        />

        <label>
          Cover image (optional, JPEG, PNG, or WebP, up to 2 MB)
          <input
            key={fileInputKey}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setImage(event.target.files?.[0] || null)}
          />
        </label>

        <button type="submit">Upload</button>
      </form>

      {message && <p className="status-message">{message}</p>}

      {listings.length === 0 && !listMessage && <p>You have not listed any books yet.</p>}

      <h3 className="seller-subheading">My listings</h3>
      <ul className="seller-list">
        {listings.map((listing) => (
          <li className="seller-list-item" key={listing.id}>
            <div><strong>{listing.title}</strong><p className="muted">{listing.author} · ${Number(listing.price).toFixed(2)} · {listing.stock} in stock</p></div>
            <span className="pill">{STATUS_LABELS[listing.status] || listing.status}</span>
            {listing.status === "rejected" && listing.rejectionReason && (
              <small>Reason: {listing.rejectionReason}</small>
            )}
          </li>
        ))}
      </ul>
      </section>
      <section className="panel seller-control-panel">
        <div className="seller-section-heading"><div><p className="eyebrow">Operations</p><h2>Fulfillment queue</h2></div><span className="pill">{pendingSales} pending</span></div>
        {sales.length === 0 ? <p className="muted">No sales yet.</p> : <div className="seller-queue">{sales.map((sale) => <article className="seller-queue-item" key={`${sale.orderId}-${sale.productId}`}><div><strong>Order #{sale.orderId} · {sale.title}</strong><p className="muted">{sale.quantity} copy/copies · {sale.fulfillmentStatus}</p></div><div className="seller-action-row">{sale.fulfillmentStatus === "pending" && <button type="button" onClick={() => updateSale(sale, "process")}>Process</button>}{sale.fulfillmentStatus === "processing" && <button type="button" onClick={() => updateSale(sale, "ship")}>Mark shipped</button>}{["pending", "processing"].includes(sale.fulfillmentStatus) && <button className="danger" type="button" onClick={() => updateSale(sale, "cancel")}>Cancel</button>}</div></article>)}</div>}
      </section>
      <section className="panel seller-control-panel">
        <div className="seller-section-heading"><div><p className="eyebrow">Customer care</p><h2>Refund requests</h2></div><span className="pill">{openRefunds} open</span></div>
        {refunds.length === 0 ? <p className="muted">No refund requests.</p> : <div className="seller-queue">{refunds.map((refund) => <article className="seller-queue-item" key={refund.id}><div><strong>Order #{refund.orderId}</strong><p className="muted">{refund.buyerName} · ${Number(refund.refundAmount || 0).toFixed(2)} via {refund.refundMethod === "store_credit" ? "store credit" : "original payment"}</p><small>{refund.reason}</small></div>{refund.status === "requested" && <div className="seller-action-row"><button type="button" onClick={() => decideRefund(refund.id, "approve")}>Approve</button><button className="danger" type="button" onClick={() => decideRefund(refund.id, "reject")}>Deny</button></div>}</article>)}</div>}
      </section>
      </div>
    </main>
  );
}

export default SellerHome;