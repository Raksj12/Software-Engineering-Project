import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Book = {
  id: number;
  title: string;
  author: string;
  status: string;
  stock: number;
};

function ManageWishlist() {
  const [wishlist, setWishlist] = useState<Book[]>([]);
  const [removeMessage, setRemoveMessage] = useState("");

  // Load the logged in buyer's saved wishlist
  useEffect(() => {
    const token = sessionStorage.getItem("authToken");

    if (!token) return;

    async function loadWishlist() {
      try {
        const response = await fetch("http://localhost:3000/api/wishlist", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setRemoveMessage("Could not load wishlist.");
          return;
        }

        const data = await response.json();
        setWishlist(data);
      } catch {
        setRemoveMessage("Could not load wishlist.");
      }
    }

    loadWishlist();
  }, []);

  // Remove a book from the wishlist
  async function removeFromWishlist(book: Book) {
    const token = sessionStorage.getItem("authToken");

    if (!token) {
      setRemoveMessage("Please log in first.");
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/wishlist/${book.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setRemoveMessage(data.error || "Could not remove book.");
        return;
      }

      setWishlist((previous) => previous.filter((item) => item.id !== book.id));
      setRemoveMessage(`${book.title} was removed from your wishlist.`);
    } catch {
      setRemoveMessage("Could not connect to the server.");
    }
  }

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Saved for later</p>
          <h1>My Wishlist</h1>
          <p className="muted">Add books from their detail page, then find them here.</p>
        </div>
        <span className="pill">{wishlist.length} {wishlist.length === 1 ? "book" : "books"}</span>
      </div>

      {removeMessage && <p className="status-message" role="status">{removeMessage}</p>}

      {wishlist.length === 0 ? (
        <p>
          Your wishlist is empty. <Link to="/buyer">Browse books</Link> and open one to add it.
        </p>
      ) : (
        wishlist.map((book) => (
          <div className="panel form-card" key={book.id}>
            <h3>
              {book.status === "approved" ? <Link to={`/buyer/books/${book.id}`}>{book.title}</Link> : book.title}
            </h3>
            <p className="muted">by {book.author}</p>

            {(book.status !== "approved" || book.stock <= 0) && (
              <p>This book is currently unavailable.</p>
            )}

            <button className="secondary" type="button" onClick={() => removeFromWishlist(book)}>
              Remove from Wishlist
            </button>
          </div>
        ))
      )}
    </main>
  );
}

export default ManageWishlist;

