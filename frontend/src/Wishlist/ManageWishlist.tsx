import { useEffect, useState } from "react";

type Book = {
  id: number;
  title: string;
  author: string;
  status: string;
  stock: number;
};

function ManageWishlist() {
  const [books, setBooks] = useState<Book[]>([]);
  const [wishlist, setWishlist] = useState<Book[]>([]);
  const [message, setMessage] = useState("");
  const [messageBookId, setMessageBookId] = useState<number | null>(null);
  const [removeMessage, setRemoveMessage] = useState("");

  // Load books from PostgreSQL
  useEffect(() => {
    async function loadBooks() {
      try {
        const response = await fetch("http://localhost:3000/api/products");

        if (!response.ok) {
          setMessage("Could not load books.");
          return;
        }

        const data = await response.json();
        setBooks(data);
      } catch {
        setMessage("Could not load books.");
      }
    }

    loadBooks();
  }, []);

  // Load the logged in buyer's saved wishlist
  useEffect(() => {
    const token = sessionStorage.getItem("authToken");

    if (!token) return;

    async function loadWishlist() {
      try {
        const response = await fetch(
          "http://localhost:3000/api/wishlist",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

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


  // Add a book to the wishlist
  async function addToWishlist(book: Book) {
    setMessageBookId(book.id);
    setRemoveMessage("");
    setMessage("");

    const token = sessionStorage.getItem("authToken");

    if (!token) {
      setMessage("Please log in first.");
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/api/wishlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId: book.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not add book.");
        return;
      }

      setWishlist((previous) => [...previous, book]);
      setMessage(`${book.title} was added to your wishlist!`);
    } catch {
      setMessage("Could not connect to the server.");
    }
  }


  // Remove a book from the wishlist
  async function removeFromWishlist(book: Book) {
    const token = sessionStorage.getItem("authToken");

    if (!token) {
      setRemoveMessage("Please log in first.");
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:3000/api/wishlist/${book.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setRemoveMessage(data.error || "Could not remove book.");
        return;
      }

      setWishlist((previous) =>
        previous.filter((item) => item.id !== book.id)
      );

      setRemoveMessage(`${book.title} was removed from your wishlist!`);
      setMessage("");
      setMessageBookId(null);
    } catch {
      setRemoveMessage("Could not connect to the server.");
    }
  }

  // Display available books and the user's wishlist
  return (
    <div>
      <h1>Manage Wishlist</h1>

      <h2>Browse Books</h2>

      {books.map((book) => (
        <div key={book.id}>
          <h3>{book.title}</h3>
          <p>{book.author}</p>

          <button onClick={() => addToWishlist(book)}>
            Add to Wishlist
          </button>

          {messageBookId === book.id && message && (
            <p role="status">{message}</p>
          )}
        </div>
      ))}

      <h2>My Wishlist</h2>

      {removeMessage && (
        <p role="status">{removeMessage}</p>
      )}

      {wishlist.length === 0 ? (
        <p>Your wishlist is empty.</p>
      ) : (
        wishlist.map((book) => (
          <div key={book.id}>
            <p>{book.title}</p>

            {(book.status !== "approved" || book.stock <= 0) && (
              <p>This book is currently unavailable.</p>
            )}

            <button onClick={() => removeFromWishlist(book)}>
              Remove from Wishlist
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export default ManageWishlist;

