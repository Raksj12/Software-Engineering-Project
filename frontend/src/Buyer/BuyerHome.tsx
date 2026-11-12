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
async function fetchBooks(query: string, field: string, genre = "") {
  const params = new URLSearchParams({ q: query, field });
  if (genre) params.set("genre", genre);
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
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState("");

  // Show all published books when the page opens
  useEffect(() => {
    fetchBooks("", "title")
      .then((data) => {
        setBooks(data.products);
        setMessage(data.message || "");
      })
      .catch(() => setMessage("Could not connect to the server."));
  }, []);

  useEffect(() => {
    fetch("http://localhost:3000/api/listings/genres")
      .then((r) => r.json())
      .then((d) => setGenres(d.genres || []))
      .catch(() => setGenres([]));
  }, []);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const data = await fetchBooks(query, field, selectedGenre);
      setBooks(data.products);
      setMessage(data.message || "");
    } catch (error) {
      setBooks([]);
      setMessage(error instanceof Error ? error.message : "Could not connect to the server.");
    }
  }

  async function chooseGenre(genre: string) {
    setSelectedGenre(genre);
    try {
      const data = await fetchBooks(query, field, genre);
      setBooks(data.products);
      setMessage(data.message || "");
    } catch {
      setMessage("Could not connect to the server.");
    }
  }

  return (
    <main className="page">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Find your next chapter</p>
          <h1>Stories worth bringing home.</h1>
          <p>Browse thoughtfully curated books from independent sellers and discover something new to read.</p>
        </div>
        <div className="hero-art" aria-hidden="true" />
      </section>

      <div className="page-heading">
        <div>
          <p className="eyebrow">The collection</p>
          <h2>Books for sale</h2>
        </div>
        <span className="pill">{books.length} {books.length === 1 ? "book" : "books"}</span>
      </div>

      <div className="button-row">
        <button type="button" className={selectedGenre === "" ? "" : "secondary"} onClick={() => chooseGenre("")}>All</button>
        {genres.map((g) => (
          <button key={g} type="button" className={selectedGenre === g ? "" : "secondary"} onClick={() => chooseGenre(g)}>{g}</button>
        ))}
      </div>

      <form className="search-bar" onSubmit={handleSearch}>
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

      {message && <p className="status-message">{message}</p>}

      <ul className="book-grid">
        {books.map((book) => (
          <li className="book-card" key={book.id}>
            {book.imagePath && (
              <Link to={`/buyer/books/${book.id}`}>
                <img className="book-cover" src={`http://localhost:3000${book.imagePath}`} alt={`Cover of ${book.title}`} />
              </Link>
            )}
            {!book.imagePath && <div className="book-cover">No cover image</div>}
            <div className="book-card-content">
              <h3><Link to={`/buyer/books/${book.id}`}>{book.title}</Link></h3>
              <p className="muted">by {book.author}</p>
              <p className="price">${Number(book.price).toFixed(2)}</p>
              <p className="muted">{book.genre} · {book.condition}</p>
              <p className="muted">{book.outOfStock ? "Out of stock" : `${book.stock} in stock`} · {book.sellerName}</p>
              <Link className="button secondary" to={`/buyer/books/${book.id}`}>View details</Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default BuyerHome;
