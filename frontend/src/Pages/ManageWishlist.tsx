
import { useState } from "react";

type Book = {
  id: number;
  title: string;
  author: string;
};

function ManageWishlist() {
  const books: Book[] = [
    { id: 1, title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
    { id: 2, title: "The Hunger Games", author: "Suzanne Collins" },
    { id: 3, title: "Pride and Prejudice", author: "Jane Austen" },
  ];

  const [wishlist, setWishlist] = useState<Book[]>([]);
  const [message, setMessage] = useState("");
  const [messageBookId, setMessageBookId] = useState<number | null>(null);
  const [removeMessage, setRemoveMessage] = useState("");

  function addToWishlist(book: Book) {
    setMessageBookId(book.id);
    setRemoveMessage("");

    const alreadyAdded = wishlist.some(
      (item) => item.id === book.id
    );

    if (alreadyAdded) {
      setMessage("This book is already in your wishlist.");
      return;
    }

    setWishlist([...wishlist, book]);
    setMessage(`${book.title} was added to your wishlist!`);
  }

  function removeFromWishlist(book: Book) {
    setWishlist(wishlist.filter((item) => item.id !== book.id));
    setRemoveMessage(`${book.title} was removed from your wishlist!`);
    setMessage("");
    setMessageBookId(null);
  }

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


