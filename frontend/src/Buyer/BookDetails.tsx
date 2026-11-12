import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

type BookDetail = {
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
};
type Review = { id: number; rating: number; body: string; createdAt: string; buyerName: string };

// Get one published book by its id
async function fetchBook(id: string) {
  const response = await fetch(`http://localhost:3000/api/listings/${id}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load this book.");
  }

  return data.product as BookDetail;
}

function BookDetails() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [message, setMessage] = useState("Loading...");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);

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
    fetch(`http://localhost:3000/api/products/${id}/reviews`)
      .then((response) => response.json())
      .then((data) => {
        setReviews(data.reviews || []);
        setAverageRating(data.averageRating ?? null);
      })
      .catch(() => undefined);
  }, [id]);

  async function addToCart() {
    const token = sessionStorage.getItem("authToken");
    const response = await fetch("http://localhost:3000/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ productId: Number(id), quantity }),
    });
    const data = await response.json();
    setMessage(response.ok ? `${quantity} ${book?.title || "book"} ${quantity === 1 ? "was" : "were"} added to your cart.` : data.error || "Could not add book to cart.");
    if (response.ok) window.dispatchEvent(new Event("cart-changed"));
  }

  return (
    <main className="page">
      {message && message !== "Loading..." && (
        <p className={`status-message ${message.startsWith("Could not") ? "status-error" : "status-success"}`} role="status">
          {message}
        </p>
      )}
      <Link className="muted" to="/buyer">← Back to books</Link>

      {book && (
        <div className="detail-layout" style={{ marginTop: "28px" }}>
          {book.imagePath && (
            <img className="detail-cover" src={`http://localhost:3000${book.imagePath}`} alt={`Cover of ${book.title}`} />
          )}
          {!book.imagePath && <div className="book-cover detail-cover">No cover image</div>}
          <div className="detail-info">
          <p className="eyebrow">{book.genre} · {book.condition}</p>
          <h1>{book.title}</h1>
          <p className="muted">by {book.author} · sold by {book.sellerName}</p>
          <p className="price">${Number(book.price).toFixed(2)}</p>
          <p className="pill">{book.stock === 0 ? "Out of stock" : `${book.stock} available`}</p>

          {book.stock > 0 && (
            <div className="button-row">
              <button type="button" onClick={() => navigate(`/buyer/books/${book.id}/buy`)}>Buy Now</button>
              <label className="quantity-control">
                <span>Quantity</span>
                <input
                  type="number"
                  min="1"
                  max={book.stock}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.min(book.stock, Math.max(1, Number(event.target.value) || 1)))}
                  aria-label={`Quantity of ${book.title}`}
                />
              </label>
              <button className="secondary" type="button" onClick={addToCart}>Add to Cart</button>
            </div>
          )}

          <h3>Description</h3>
          <p className="muted">{book.description || "No description provided."}</p>

          <h3>Details</h3>
          <p className="muted">ISBN: {book.isbn}</p>
          <h3>Reviews</h3>
          <p className="pill">★ {averageRating === null ? "No ratings yet" : `${averageRating.toFixed(1)}/5`}</p>
          {reviews.length === 0 ? <p>No reviews yet.</p> : reviews.map((review) => (
            <div className="panel form-card" key={review.id}>
              <p>{review.rating}/5 by {review.buyerName}</p>
              <p className="muted">{review.body}</p>
            </div>
          ))}
          </div>
        </div>
      )}
      {message === "Loading..." && <p className="status-message" role="status">{message}</p>}
    </main>
  );
}

export default BookDetails;
