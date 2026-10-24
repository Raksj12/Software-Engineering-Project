import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  genre: string;
  condition: string;
  price: string;
  stock: number;
  outOfStock: boolean;
  sellerName: string;
  imagePath: string | null;
};

// Get published books, optionally filtered by a search term
async function fetchBooks(query: string, field: string) {
  const params = new URLSearchParams({ q: query, field });
  const response = await fetch(`http://localhost:3000/api/listings?${params}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load books.");
  }

  return data as { products: Book[]; message?: string };
}

function BuyerHome() {
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState("");
  const [field, setField] = useState("title");
  const [message, setMessage] = useState("");

  // Show all published books when the page opens
  useEffect(() => {
    fetchBooks("", "title")
      .then((data) => {
        setBooks(data.products);
        setMessage(data.message || "");
      })
      .catch(() => setMessage("Could not connect to the server."));
  }, []);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const data = await fetchBooks(query, field);
      setBooks(data.products);
      setMessage(data.message || "");
    } catch (error) {
      setBooks([]);
      setMessage(error instanceof Error ? error.message : "Could not connect to the server.");
    }
  }

  return (
    <div>
      <h2>Books for Sale</h2>

      <form onSubmit={handleSearch}>
        <select value={field} onChange={(event) => setField(event.target.value)}>
          <option value="title">Title</option>
          <option value="author">Author</option>
          <option value="genre">Genre</option>
          <option value="isbn">ISBN</option>
        </select>

        <input
          type="text"
          placeholder="Search books"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <button type="submit">Search</button>
      </form>

      <p>{message}</p>

      <ul>
        {books.map((book) => (
          <li key={book.id}>
            {book.imagePath && (
              <Link to={`/buyer/books/${book.id}`}>
                <img src={`http://localhost:3000${book.imagePath}`} alt={`Cover of ${book.title}`} width={100} />
              </Link>
            )}
            <h3>
              <Link to={`/buyer/books/${book.id}`}>{book.title}</Link>
            </h3>
            <p>by {book.author}</p>
            <p>${Number(book.price).toFixed(2)}</p>
            <p>
              Genre: {book.genre} | Condition: {book.condition} | ISBN: {book.isbn}
            </p>
            <p>Sold by {book.sellerName}</p>
            <p>{book.outOfStock ? "Out of Stock" : `${book.stock} in stock`}</p>
            <Link to={`/buyer/books/${book.id}`}>View details</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default BuyerHome;
