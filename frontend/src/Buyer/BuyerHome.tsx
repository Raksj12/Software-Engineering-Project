import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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
type BuyerAccount = { storeCredit: string };

// Get published books, optionally filtered by a search term and genre
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
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [storeCredit, setStoreCredit] = useState("0.00");
  const navigate = useNavigate();

  // Show all published books when the page opens
  useEffect(() => {
    fetchBooks("", "title")
      .then((data) => {
        setBooks(data.products);
        setMessage(data.message || "");
      })
      .catch(() => setMessage("Could not connect to the server."));
  }, []);

  // Load the list of genres for the browse buttons
  useEffect(() => {
    fetch("http://localhost:3000/api/listings/genres")
      .then((r) => r.json())
      .then((d) => setGenres(d.genres || []))
      .catch(() => setGenres([]));
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem("authToken");
    fetch("http://localhost:3000/api/buyer/account", { headers: { Authorization: "Bearer " + (token || "") } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load store credit.");
        setStoreCredit((data.user as BuyerAccount).storeCredit);
      })
      .catch(() => setMessage("Could not load your store-credit balance."));
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

  // Show only books in the chosen genre ("" shows every genre)
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

  function toggleCompare(id: string) {
    setCompareIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 4 ? [...current, id] : current);
  }

  async function addToCart(book: Book) {
    const quantity = cartQuantities[book.id] || 1;
    try {
      const response = await fetch("http://localhost:3000/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (sessionStorage.getItem("authToken") || ""),
        },
        body: JSON.stringify({ productId: Number(book.id), quantity }),
      });
      const data = await response.json();
      setMessage(response.ok ? `${quantity} ${book.title} ${quantity === 1 ? "was" : "were"} added to your cart.` : data.error || "Could not add book to cart.");
      if (response.ok) window.dispatchEvent(new Event("cart-changed"));
    } catch {
      setMessage("Could not connect to the server. Your cart was not changed.");
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
          <p className="muted">Choose 2–4 books below to compare their prices, descriptions, sellers, and availability.</p>
        </div>
        <span className="pill">{books.length} {books.length === 1 ? "book" : "books"}</span>
      </div>
      <section className="panel form-card">
        <p className="eyebrow">Buyer wallet</p>
        <h3>BookHaven store credit</h3>
        <p className="price">${Number(storeCredit).toFixed(2)}</p>
        <p className="muted">When requesting a refund, you can choose store credit or a refund to the original payment method.</p>
      </section>
      <div className="compare-toolbar">
        <span className="muted" role="status">
          {compareIds.length === 0 ? "No books selected" : `${compareIds.length} book${compareIds.length === 1 ? "" : "s"} selected`}
        </span>
        <div className="button-row">
          {compareIds.length > 0 && <button className="secondary" type="button" onClick={() => setCompareIds([])}>Clear selection</button>}
          <button type="button" disabled={compareIds.length < 2} onClick={() => navigate(`/buyer/compare?ids=${compareIds.join(",")}`)}>
            {compareIds.length < 2 ? "Select at least 2 books" : `Compare ${compareIds.length} books`}
          </button>
        </div>
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
          <li className={`book-card ${compareIds.includes(book.id) ? "book-card-selected" : ""}`} key={book.id}>
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
              <label className="compare-option">
                <input type="checkbox" checked={compareIds.includes(book.id)} onChange={() => toggleCompare(book.id)} />
                <span>{compareIds.includes(book.id) ? "Selected for comparison" : "Select to compare"}</span>
              </label>
              {book.stock > 0 && (
                <div className="catalog-cart-actions">
                  <label className="quantity-control">
                    <span>Qty</span>
                    <input
                      type="number"
                      min="1"
                      max={book.stock}
                      value={cartQuantities[book.id] || 1}
                      onChange={(event) => setCartQuantities({ ...cartQuantities, [book.id]: Math.min(book.stock, Math.max(1, Number(event.target.value) || 1)) })}
                      aria-label={`Quantity of ${book.title}`}
                    />
                  </label>
                  <button type="button" onClick={() => addToCart(book)}>Add to cart</button>
                </div>
              )}
              <Link className="button secondary" to={`/buyer/books/${book.id}`}>View details</Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default BuyerHome;
