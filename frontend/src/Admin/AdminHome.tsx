import { useEffect, useState } from "react";

type PendingListing = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  price: string;
  stock: number;
  sellerName: string;
  createdAt: string;
  flagged: boolean;
  matchedPhrases: string[];
  isbnValid: boolean;
};
type AdminRefund = { id: number; orderId: number; buyerEmail: string; reason: string; status: string; refundMethod: string; refundAmount: string };
type User = { id: number; email: string; fullName: string; role: string; status: string };
type Word = { id: number; phrase: string };

const authHeaders = () => ({ Authorization: "Bearer " + (sessionStorage.getItem("authToken") || "") });

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`http://localhost:3000${path}`, { headers: authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load admin data.");
  return data as T;
}

function AdminHome() {
  const [listings, setListings] = useState<PendingListing[]>([]);
  const [refunds, setRefunds] = useState<AdminRefund[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [phrase, setPhrase] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  async function loadControlCenter() {
    const [listingData, refundData, userData, wordData] = await Promise.all([
      getJson<{ listings: PendingListing[] }>("/api/admin/listings?status=pending"),
      getJson<{ refunds: AdminRefund[] }>("/api/admin/refunds"),
      getJson<{ users: User[] }>("/api/admin/users?status=pending"),
      getJson<{ words: Word[] }>("/api/admin/prohibited-words"),
    ]);
    setListings(listingData.listings);
    setRefunds(refundData.refunds);
    setUsers(userData.users);
    setWords(wordData.words);
  }

  useEffect(() => {
    // Load the initial control-center snapshot after mounting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadControlCenter().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load control center."));
  }, []);

  async function post(path: string, body?: unknown) {
    const response = await fetch(`http://localhost:3000${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Command failed.");
    return data;
  }

  async function reviewListing(id: string, action: "approve" | "reject") {
    try {
      await post(`/api/admin/listings/${id}/${action}`, { reason: reasons[id] || "" });
      setMessage(action === "approve" ? "Listing approved and published." : "Listing rejected with an audit record.");
      await loadControlCenter();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Listing review failed."); }
  }

  async function decideRefund(id: number, decision: "approve" | "reject") {
    try {
      await post(`/api/admin/refunds/${id}/${decision}`);
      setMessage(decision === "approve" ? "Refund processed and notifications sent." : "Refund denied.");
      await loadControlCenter();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Refund decision failed."); }
  }

  async function changeUser(id: number, action: "approve" | "disable") {
    try {
      await post(`/api/admin/users/${id}/${action}`);
      setMessage(action === "approve" ? "Account approved." : "Account disabled.");
      await loadControlCenter();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Account command failed."); }
  }

  async function addPhrase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await post("/api/admin/prohibited-words", { phrase });
      setPhrase("");
      setMessage("Safety phrase added.");
      await loadControlCenter();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add safety phrase."); }
  }

  async function removePhrase(id: number) {
    const response = await fetch(`http://localhost:3000/api/admin/prohibited-words/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!response.ok) {
      const data = await response.json();
      setMessage(data.error || "Could not remove safety phrase.");
      return;
    }
    setMessage("Safety phrase removed.");
    await loadControlCenter();
  }

  async function rescan() {
    try {
      const data = await post("/api/admin/prohibited-words/rescan");
      setMessage(`Safety scan complete: ${data.flaggedCount} pending listing(s) flagged.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Safety scan failed."); }
  }

  const openRefunds = refunds.filter((refund) => refund.status === "requested");

  return (
    <main className="page admin-control-center">
      <header className="admin-hero">
        <div>
          <p className="eyebrow">Admin control center</p>
          <h1>Run the marketplace.</h1>
          <p className="muted">Moderate listings, resolve trust issues, manage accounts, and keep BookHaven healthy.</p>
        </div>
        <div className="admin-live-status"><span /> Systems operational</div>
      </header>
      {message && <p className="status-message">{message}</p>}

      <section className="admin-metrics" aria-label="Marketplace overview">
        <div><span>Listing queue</span><strong>{listings.length}</strong><small>awaiting review</small></div>
        <div><span>Refund queue</span><strong>{openRefunds.length}</strong><small>needs a decision</small></div>
        <div><span>Account queue</span><strong>{users.length}</strong><small>awaiting approval</small></div>
        <div><span>Safety rules</span><strong>{words.length}</strong><small>active phrases</small></div>
      </section>

      <div className="admin-workspace">
        <section className="panel admin-control-panel">
          <div className="admin-section-heading"><div><p className="eyebrow">Moderation queue</p><h2>Book upload requests</h2></div><span className="pill">{listings.length} open</span></div>
          {listings.length === 0 ? <p className="muted">No listing decisions are waiting.</p> : <div className="admin-queue">
            {listings.map((listing) => <article className="admin-queue-item" key={listing.id}>
              <div><strong>{listing.title}</strong><p className="muted">by {listing.sellerName} · ${Number(listing.price).toFixed(2)} · {listing.stock} in stock</p><small>ISBN {listing.isbn} {listing.isbnValid ? "· valid" : "· invalid"} {listing.flagged ? `· flagged: ${listing.matchedPhrases.join(", ")}` : ""}</small></div>
              <div className="admin-action-row"><button type="button" onClick={() => reviewListing(listing.id, "approve")}>Approve</button><input aria-label={`Rejection reason for ${listing.title}`} placeholder="Rejection reason" value={reasons[listing.id] || ""} onChange={(event) => setReasons({ ...reasons, [listing.id]: event.target.value })} /><button className="danger" type="button" onClick={() => reviewListing(listing.id, "reject")}>Reject</button></div>
            </article>)}
          </div>}
        </section>

        <section className="panel admin-control-panel">
          <div className="admin-section-heading"><div><p className="eyebrow">Customer care</p><h2>Refund command queue</h2></div><span className="pill">{openRefunds.length} open</span></div>
          {openRefunds.length === 0 ? <p className="muted">No refund decisions are waiting.</p> : <div className="admin-queue">
            {openRefunds.map((refund) => <article className="admin-queue-item" key={refund.id}><div><strong>Order #{refund.orderId}</strong><p className="muted">{refund.buyerEmail} · ${Number(refund.refundAmount).toFixed(2)} via {refund.refundMethod === "store_credit" ? "store credit" : "original payment"}</p><small>Reason: {refund.reason}</small></div><div className="admin-action-row"><button type="button" onClick={() => decideRefund(refund.id, "approve")}>Process refund</button><button className="danger" type="button" onClick={() => decideRefund(refund.id, "reject")}>Deny</button></div></article>)}
          </div>}
        </section>
      </div>

      <div className="admin-workspace">
        <section className="panel admin-control-panel">
          <div className="admin-section-heading"><div><p className="eyebrow">Access governance</p><h2>Account approvals</h2></div></div>
          {users.length === 0 ? <p className="muted">No accounts are waiting for approval.</p> : <div className="admin-queue">{users.map((user) => <article className="admin-queue-item" key={user.id}><div><strong>{user.fullName}</strong><p className="muted">{user.email} · {user.role}</p></div><div className="admin-action-row"><button type="button" onClick={() => changeUser(user.id, "approve")}>Approve account</button><button className="danger" type="button" onClick={() => changeUser(user.id, "disable")}>Disable</button></div></article>)}</div>}
        </section>

        <section className="panel admin-control-panel">
          <div className="admin-section-heading"><div><p className="eyebrow">Trust tools</p><h2>Safety command set</h2></div><button className="secondary" type="button" onClick={rescan}>Run pending scan</button></div>
          <form className="admin-phrase-form" onSubmit={addPhrase}><input required value={phrase} onChange={(event) => setPhrase(event.target.value)} placeholder="Add prohibited word or phrase" /><button type="submit">Add rule</button></form>
          <div className="admin-tag-list">{words.map((word) => <span className="admin-tag" key={word.id}>{word.phrase}<button type="button" aria-label={`Remove ${word.phrase}`} onClick={() => removePhrase(word.id)}>×</button></span>)}</div>
        </section>
      </div>
    </main>
  );
}

export default AdminHome;
