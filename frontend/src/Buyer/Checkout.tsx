import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type SummaryItem = {
  productId: number;
  title: string;
  author: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  issue: string | null;
};
type CheckoutSummary = {
  items: SummaryItem[];
  canCheckout: boolean;
  subtotal: string;
  taxState: string;
  taxRate: number;
  taxAmount: string;
  total: string;
  availableCredit: string;
  storeCreditApplied: string;
  paymentDue: string;
};
type Card = { name: string; number: string; expiry: string; cvv: string };

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

// Same format checks the server applies, so mistakes surface before the review step.
function cardError(card: Card): string | null {
  if (!card.name.trim()) return "Cardholder name is required.";
  if (!/^\d{12,19}$/.test(card.number.replace(/[\s-]/g, ""))) return "Card number must be 12 to 19 digits.";
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry.trim())) return "Expiry must be in MM/YY format.";
  if (!/^\d{3,4}$/.test(card.cvv.trim())) return "CVV must be 3 or 4 digits.";
  return null;
}

// REQ-030: the itemized summary shown on both checkout steps.
function OrderSummary({ summary, useStoreCredit }: { summary: CheckoutSummary; useStoreCredit: boolean }) {
  const itemCount = summary.items.reduce((count, item) => count + item.quantity, 0);
  return (
    <aside className="checkout-summary" aria-label="Order summary">
      <div className="checkout-summary-heading">
        <div><p className="eyebrow">Order summary</p><h3>Your items</h3></div>
        <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
      </div>
      <div className="checkout-summary-items">
        {summary.items.map((item) => (
          <div className="checkout-summary-item" key={item.productId}>
            <span>
              {item.title} <small>by {item.author} · × {item.quantity} · ${item.unitPrice} each</small>
              {item.issue && <small className="checkout-summary-issue">{item.issue}. Update your cart to continue.</small>}
            </span>
            <strong>${item.lineTotal}</strong>
          </div>
        ))}
      </div>
      <div className="checkout-summary-lines">
        <div><span>Subtotal</span><strong>${summary.subtotal}</strong></div>
        <div><span>Tax ({summary.taxState} · {(summary.taxRate * 100).toFixed(2)}%)</span><strong>${summary.taxAmount}</strong></div>
        <div className="checkout-summary-total"><span>Order total</span><strong>${summary.total}</strong></div>
        {useStoreCredit && <div className="checkout-summary-credit"><span>Store credit applied</span><strong>−${summary.storeCreditApplied}</strong></div>}
        <div className="checkout-summary-due"><span>Due by card</span><strong>${summary.paymentDue}</strong></div>
      </div>
    </aside>
  );
}

function Checkout() {
  const [step, setStep] = useState<"details" | "review">("details");
  const [shippingAddress, setShippingAddress] = useState("");
  const [taxState, setTaxState] = useState("CA");
  const [card, setCard] = useState<Card>({ name: "", number: "", expiry: "", cvv: "" });
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [storeCredit, setStoreCredit] = useState(0);
  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState<{ total: number; credit: number; due: number } | null>(null);
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  // Bumping this reloads the summary, e.g. after the server reports the total changed.
  const [summaryVersion, setSummaryVersion] = useState(0);
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
  }, [taxState, useStoreCredit, token, summaryVersion]);

  const cardNeeded = Number(summary?.paymentDue ?? 0) > 0;
  const cardDigits = card.number.replace(/[\s-]/g, "");

  function goToReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!summary?.canCheckout) {
      setMessage("Fix the items flagged in your order summary before continuing.");
      return;
    }
    if (!shippingAddress.trim()) {
      setMessage("Shipping address is required.");
      return;
    }
    const invalidCard = cardNeeded ? cardError(card) : null;
    if (invalidCard) {
      setMessage(invalidCard);
      return;
    }
    setMessage("");
    setStep("review");
    window.scrollTo({ top: 0 });
  }

  async function placeOrder() {
    if (!summary || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("http://localhost:3000/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shippingAddress, taxState, card, useStoreCredit, expectedTotal: summary.total }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Checkout failed.");
        // Prices, stock, or availability moved: show the buyer the current numbers before they try again.
        setSummaryVersion((version) => version + 1);
        return;
      }
      setDone(true);
      setPaymentSummary({ total: Number(data.order.total), credit: Number(data.order.storeCreditApplied), due: Number(data.order.paymentAmount) });
      setMessage(`Order #${data.order.id} confirmed.`);
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return <main className="page page-narrow"><div className="form-card"><p className="eyebrow">Order confirmed</p><h2>Thank you for your order!</h2><p className="status-message">{message}</p>{paymentSummary && <p>Order total: ${paymentSummary.total.toFixed(2)} · Store credit used: ${paymentSummary.credit.toFixed(2)} · Paid by card: ${paymentSummary.due.toFixed(2)}</p>}<Link className="button" to="/buyer/orders">View order history</Link></div></main>;

  if (summary && summary.items.length === 0) {
    return (
      <main className="page page-narrow">
        <div className="form-card">
          <p className="eyebrow">Secure checkout</p>
          <h2>Your cart is empty</h2>
          <p className="muted">Add a book to your cart before checking out.</p>
          <Link className="button" to="/buyer">Browse books</Link>
        </div>
      </main>
    );
  }

  const steps = (
    <ol className="checkout-steps" aria-label="Checkout progress">
      <li aria-current={step === "details" ? "step" : undefined}>1. Details</li>
      <li aria-current={step === "review" ? "step" : undefined}>2. Review and place order</li>
    </ol>
  );

  if (step === "review" && summary) {
    const creditUsed = useStoreCredit ? Number(summary.storeCreditApplied) : 0;
    return (
      <main className="page page-narrow">
        <div className="form-card">
          <p className="eyebrow">Secure checkout</p>
          <h2>Review your order</h2>
          {steps}
          <p className="muted">Nothing is charged until you select Place order.</p>
          <OrderSummary summary={summary} useStoreCredit={useStoreCredit} />
          <section className="checkout-review-block" aria-labelledby="ship-heading">
            <h3 id="ship-heading">Shipping to</h3>
            <p className="checkout-review-address">{shippingAddress.trim()}</p>
            <p className="muted">Tax state: {summary.taxState}</p>
          </section>
          <section className="checkout-review-block" aria-labelledby="pay-heading">
            <h3 id="pay-heading">Payment</h3>
            {creditUsed > 0 && <p>BookHaven store credit: ${creditUsed.toFixed(2)}</p>}
            {Number(summary.paymentDue) > 0
              ? <p>Card ending in {cardDigits.slice(-4)}: ${summary.paymentDue}</p>
              : <p>No card charge. Store credit covers the full order.</p>}
          </section>
          {message && <p className="status-message">{message}</p>}
          <div className="button-row">
            <button className="secondary" type="button" onClick={() => { setMessage(""); setStep("details"); }}>Edit details</button>
            <button type="button" onClick={placeOrder} disabled={submitting || !summary.canCheckout}>
              {submitting ? "Placing order..." : `Place order · $${summary.total}`}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page page-narrow">
      <div className="form-card">
        <p className="eyebrow">Secure checkout</p>
        <h2>Complete your order</h2>
        {steps}
        <p className="muted">This demo validates card formatting locally and never stores raw card details.</p>
        <form onSubmit={goToReview}>
          <textarea required placeholder="Shipping address" value={shippingAddress} onChange={(event) => setShippingAddress(event.target.value)} />
          <select required value={taxState} onChange={(event) => setTaxState(event.target.value)}>
            {STATES.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
          <p className="muted">Tax is calculated from your selected state. Your connection IP is recorded for order audit only.</p>
          {summary && <OrderSummary summary={summary} useStoreCredit={useStoreCredit} />}
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
            <p className="muted">{cardNeeded ? "Required for the amount store credit does not cover." : "Not needed. Store credit covers the full order."}</p>
            <input placeholder="Name on card" value={card.name} onChange={(event) => setCard({ ...card, name: event.target.value })} />
            <input placeholder="Card number" value={card.number} onChange={(event) => setCard({ ...card, number: event.target.value })} />
            <div className="button-row">
              <input placeholder="MM/YY" value={card.expiry} onChange={(event) => setCard({ ...card, expiry: event.target.value })} />
              <input placeholder="CVV" value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value })} />
            </div>
          </fieldset>
          <button type="submit" disabled={!summary?.canCheckout}>Review order</button>
        </form>
        {message && <p className="status-message">{message}</p>}
        <button className="secondary" type="button" onClick={() => navigate("/buyer/cart")}>Back to cart</button>
      </div>
    </main>
  );
}

export default Checkout;
