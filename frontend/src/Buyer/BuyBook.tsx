import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

type Book = {
  id: string;
  title: string;
  author: string;
  price: string;
  stock: number;
  sellerName: string;
};

type Order = {
  id: string;
  title: string;
  quantity: number;
  total: string;
  shippingAddress: string;
};

// Get the book being bought
async function fetchBook(id: string) {
  const response = await fetch(`http://localhost:3000/api/listings/${id}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load this book.");
  }

  return data.product as Book;
}

function BuyBook() {
  const { id = "" } = useParams();
  const [book, setBook] = useState<Book | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [shippingAddress, setShippingAddress] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [message, setMessage] = useState("Loading...");
  const [order, setOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBook(id)
      .then((data) => {
        setBook(data);
        setMessage("");
      })
      .catch((error) => {
        setBook(null);
        setMessage(error instanceof TypeError ? "Could not connect to the server." : error.message);
      });
  }, [id]);

  async function handleBuy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    // Send the order and card details to the backend
    try {
      const response = await fetch("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          productId: id,
          quantity,
          shippingAddress,
          card: { name: cardName, number: cardNumber, expiry, cvv },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not complete your purchase.");
        return;
      }

      setOrder(data.order);
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setSubmitting(false);
    }
  }

  // Show a confirmation once the order is placed
  if (order) {
    return (
      <div>
        <h2>Thank you for your order!</h2>
        <p>Order number: {order.id}</p>
        <p>
          {order.quantity} x {order.title}
        </p>
        <p>Total paid: ${order.total}</p>
        <p>Shipping to: {order.shippingAddress}</p>
        <Link to="/buyer">Back to Books for Sale</Link>
      </div>
    );
  }

  const total = book ? Number(book.price) * (Number(quantity) || 0) : 0;

  return (
    <div>
      <Link to={`/buyer/books/${id}`}>Back to book</Link>

      <h2>Buy Book</h2>

      {book && book.stock === 0 && <p>This book is out of stock.</p>}

      {book && book.stock > 0 && (
        <div>
          <h3>{book.title}</h3>
          <p>by {book.author}</p>
          <p>Sold by {book.sellerName}</p>
          <p>
            ${Number(book.price).toFixed(2)} each | {book.stock} in stock
          </p>

          <form onSubmit={handleBuy}>
            <h3>Order</h3>

            <input
              type="number"
              placeholder="Quantity"
              min="1"
              max={book.stock}
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />

            <p>Total: ${total.toFixed(2)}</p>

            <h3>Shipping</h3>

            <textarea
              placeholder="Shipping address"
              value={shippingAddress}
              onChange={(event) => setShippingAddress(event.target.value)}
              required
            />

            <h3>Payment</h3>

            <input
              type="text"
              placeholder="Name on card"
              value={cardName}
              onChange={(event) => setCardName(event.target.value)}
              required
            />

            <input
              type="text"
              inputMode="numeric"
              placeholder="Card number"
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
              required
            />

            <input
              type="text"
              placeholder="MM/YY"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              required
            />

            <input
              type="text"
              inputMode="numeric"
              placeholder="CVV"
              value={cvv}
              onChange={(event) => setCvv(event.target.value)}
              required
            />

            <button type="submit" disabled={submitting}>
              {submitting ? "Placing order..." : "Place Order"}
            </button>
          </form>
        </div>
      )}

      <p>{message}</p>
    </div>
  );
}

export default BuyBook;
