import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Checkout() {
  const [shippingAddress, setShippingAddress] = useState("");
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvv: "" });
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const token = sessionStorage.getItem("authToken");
  const navigate = useNavigate();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("http://localhost:3000/api/orders/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shippingAddress, card }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Checkout failed.");
      return;
    }
    setDone(true);
    setMessage(`Order #${data.order.id} confirmed.`);
  }

  if (done) return <main className="page page-narrow"><div className="form-card"><p className="eyebrow">Order confirmed</p><h2>Thank you for your order!</h2><p className="status-message">{message}</p><Link className="button" to="/buyer/orders">View order history</Link></div></main>;

  return (
    <main className="page page-narrow">
      <div className="form-card">
        <p className="eyebrow">Secure checkout</p>
        <h2>Complete your order</h2>
        <p className="muted">This demo validates card formatting locally and never stores raw card details.</p>
        <form onSubmit={submit}>
          <textarea required placeholder="Shipping address" value={shippingAddress} onChange={(event) => setShippingAddress(event.target.value)} />
          <input required placeholder="Name on card" value={card.name} onChange={(event) => setCard({ ...card, name: event.target.value })} />
          <input required placeholder="Card number" value={card.number} onChange={(event) => setCard({ ...card, number: event.target.value })} />
          <div className="button-row">
            <input required placeholder="MM/YY" value={card.expiry} onChange={(event) => setCard({ ...card, expiry: event.target.value })} />
            <input required placeholder="CVV" value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value })} />
          </div>
          <button type="submit">Place order</button>
        </form>
        {message && <p className="status-message">{message}</p>}
        <button className="secondary" type="button" onClick={() => navigate("/buyer/cart")}>Back to cart</button>
      </div>
    </main>
  );
}

export default Checkout;
