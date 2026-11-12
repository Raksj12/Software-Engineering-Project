import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type CartItem = { productId: number; title: string; price: string; quantity: number; stock: number };
type CartResponse = { items: CartItem[]; subtotal: string };

function Cart() {
  const [cart, setCart] = useState<CartResponse>({ items: [], subtotal: "0.00" });
  const [message, setMessage] = useState("Loading...");
  const navigate = useNavigate();
  const token = sessionStorage.getItem("authToken");

  async function loadCart() {
    if (!token) {
      navigate("/login");
      return;
    }
    const response = await fetch("http://localhost:3000/api/cart", { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load cart.");
    setCart(data);
    setMessage("");
  }

  useEffect(() => {
    // The request synchronizes this component with the server-side cart.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCart().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load cart."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(productId: number) {
    const response = await fetch(`http://localhost:3000/api/cart/${productId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Could not remove item.");
      return;
    }

    await loadCart();
  }

  async function updateQuantity(productId: number, quantity: number) {
    const response = await fetch(`http://localhost:3000/api/cart/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (sessionStorage.getItem("authToken") || "") },
      body: JSON.stringify({ quantity }),
    });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "Could not update quantity."); return; }
    await loadCart();
  }

  return (
    <main className="page">
      <div className="page-heading">
        <div><p className="eyebrow">Ready when you are</p><h2>Shopping cart</h2></div>
        <Link className="button secondary" to="/buyer">Continue browsing</Link>
      </div>
      {message && <p className="status-message">{message}</p>}
      {cart.items.length === 0 && !message.includes("Loading") && <div className="panel form-card"><h3>Your cart is waiting for a good story.</h3><p className="muted">Browse the collection and add something you would love to read.</p></div>}
      <div className="cart-list">
      {cart.items.map((item) => (
        <div className="cart-item panel" key={item.productId}>
          <div><strong>{item.title}</strong><p className="muted">${Number(item.price).toFixed(2)} × {item.quantity}</p><input aria-label={`Quantity for ${item.title}`} type="number" min="1" max={item.stock} value={item.quantity} onChange={(event) => updateQuantity(item.productId, Number(event.target.value))} /></div>
          <button className="danger" type="button" onClick={() => remove(item.productId)}>Remove</button>
        </div>
      ))}
      </div>
      {cart.items.length > 0 && (
        <div className="cart-summary"><strong>Subtotal: ${Number(cart.subtotal).toFixed(2)}</strong><Link className="button" to="/buyer/checkout">Continue to checkout</Link></div>
      )}
    </main>
  );
}

export default Cart;
