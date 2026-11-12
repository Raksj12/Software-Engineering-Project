import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type CheckoutSummary = {
  items: { title: string; quantity: number; unitPrice: string; lineTotal: string }[];
  subtotal: string;
  taxState: string;
  taxRate: number;
  taxAmount: string;
  total: string;
  availableCredit: string;
  storeCreditApplied: string;
  paymentDue: string;
};

function Checkout() {
  const [shippingAddress, setShippingAddress] = useState("");
  const [taxState, setTaxState] = useState("CA");
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvv: "" });
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [storeCredit, setStoreCredit] = useState(0);
  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState<{ total: number; credit: number; due: number } | null>(null);
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const token = sessionStorage.getItem("authToken");
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:3000/api/buyer/account", { headers: { Authorization: "Bearer " + (token || "") } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load store credit.");
        setStoreCredit(Number(data.user.storeCredit || 0));
      })
      .catch(() => setMessage("Could not load your store-credit balance."));
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams({ taxState, useStoreCredit: String(useStoreCredit) });
    fetch(`http://localhost:3000/api/orders/checkout-summary?${params}`, {
      headers: { Authorization: "Bearer " + (token || "") },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load order summary.");
        setSummary(data);
        setStoreCredit(Number(data.availableCredit));
      })
      .catch(() => setMessage("Could not load the current order summary."));
  }, [taxState, useStoreCredit, token]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("http://localhost:3000/api/orders/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shippingAddress, taxState, card, useStoreCredit }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Checkout failed.");
      return;
    }
    setDone(true);
    setPaymentSummary({ total: Number(data.order.total), credit: Number(data.order.storeCreditApplied), due: Number(data.order.paymentAmount) });
    setMessage(`Order #${data.order.id} confirmed.`);
  }

  if (done) return <main className="page page-narrow"><div className="form-card"><p className="eyebrow">Order confirmed</p><h2>Thank you for your order!</h2><p className="status-message">{message}</p>{paymentSummary && <p>Order total: ${paymentSummary.total.toFixed(2)} · Store credit used: ${paymentSummary.credit.toFixed(2)} · Paid by card: ${paymentSummary.due.toFixed(2)}</p>}<Link className="button" to="/buyer/orders">View order history</Link></div></main>;

  return (
    <main className="page page-narrow">
      <div className="form-card">
        <p className="eyebrow">Secure checkout</p>
        <h2>Complete your order</h2>
        <p className="muted">This demo validates card formatting locally and never stores raw card details.</p>
        <form onSubmit={submit}>
          <textarea required placeholder="Shipping address" value={shippingAddress} onChange={(event) => setShippingAddress(event.target.value)} />
          <select required value={taxState} onChange={(event) => setTaxState(event.target.value)}>
            {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
          <p className="muted">Tax is calculated from your selected state. Your connection IP is recorded for order audit only.</p>
          {summary && <aside className="checkout-summary" aria-label="Order summary">
            <div className="checkout-summary-heading">
              <div><p className="eyebrow">Order summary</p><h3>Review your purchase</h3></div>
              <span>{summary.items.reduce((count, item) => count + item.quantity, 0)} items</span>
            </div>
            <div className="checkout-summary-items">
              {summary.items.map((item) => <div className="checkout-summary-item" key={item.title}><span>{item.title} <small>× {item.quantity} · ${item.unitPrice} each</small></span><strong>${item.lineTotal}</strong></div>)}
            </div>
            <div className="checkout-summary-lines">
              <div><span>Subtotal</span><strong>${summary.subtotal}</strong></div>
              <div><span>Tax ({summary.taxState} · {(summary.taxRate * 100).toFixed(2)}%)</span><strong>${summary.taxAmount}</strong></div>
              <div className="checkout-summary-total"><span>Order total</span><strong>${summary.total}</strong></div>
              {useStoreCredit && <div className="checkout-summary-credit"><span>Store credit applied</span><strong>−${summary.storeCreditApplied}</strong></div>}
              <div className="checkout-summary-due"><span>Due today</span><strong>${summary.paymentDue}</strong></div>
            </div>
          </aside>}
          <section className="checkout-credit-card" aria-labelledby="credit-heading">
            <div className="checkout-credit-header">
              <div>
                <p className="eyebrow">Payment option</p>
                <h3 id="credit-heading">Use BookHaven store credit</h3>
              </div>
              <span className="checkout-credit-balance">${Number(summary?.availableCredit ?? storeCredit).toFixed(2)} available</span>
            </div>
            <label className="checkout-credit-toggle">
              <input type="checkbox" checked={useStoreCredit} onChange={(event) => setUseStoreCredit(event.target.checked)} />
              <span>
                <strong>Apply store credit to this order</strong>
                <small>Credit is applied first. Only the remaining balance is charged to your card.</small>
              </span>
            </label>
            {useStoreCredit && <p className="checkout-credit-note">Your available credit will be applied automatically at checkout.</p>}
          </section>
          <fieldset className="checkout-payment-card">
            <legend>Card payment for remaining balance</legend>
            <p className="muted">Required only if store credit does not cover the full order total.</p>
            <input placeholder="Name on card" value={card.name} onChange={(event) => setCard({ ...card, name: event.target.value })} />
            <input placeholder="Card number" value={card.number} onChange={(event) => setCard({ ...card, number: event.target.value })} />
            <div className="button-row">
              <input placeholder="MM/YY" value={card.expiry} onChange={(event) => setCard({ ...card, expiry: event.target.value })} />
              <input placeholder="CVV" value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value })} />
            </div>
          </fieldset>
          <button type="submit">Place order</button>
        </form>
        {message && <p className="status-message">{message}</p>}
        <button className="secondary" type="button" onClick={() => navigate("/buyer/cart")}>Back to cart</button>
      </div>
    </main>
  );
}

export default Checkout;
