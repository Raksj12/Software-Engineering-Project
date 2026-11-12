import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type Book = {
  id: number;
  title: string;
  author: string;
  isbn?: string;
  genre: string;
  condition: string;
  description?: string;
  price: string;
  stock: number;
  sellerName: string;
};

function CompareBooks() {
  const [params] = useSearchParams();
  const [books, setBooks] = useState<Book[]>([]);
  const [message, setMessage] = useState("Loading comparison...");

  useEffect(() => {
    fetch(`http://localhost:3000/api/listings/compare?ids=${encodeURIComponent(params.get("ids") || "")}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not compare books.");
        setBooks(data.products);
        setMessage("");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not compare books."));
  }, [params]);

  return (
    <main className="page">
      <div className="page-heading comparison-heading">
        <div>
          <p className="eyebrow">Buyer tools</p>
          <h1>Compare books</h1>
          <p className="muted">Review the details side by side before choosing the book that best fits your needs.</p>
        </div>
        <Link className="button secondary" to="/buyer">Back to books</Link>
      </div>
      {message && <p className="status-message">{message}</p>}
      {books.length > 0 && (
        <section className="comparison-card panel" aria-label="Book comparison">
          <div className="comparison-card-header">
            <div>
              <p className="eyebrow">Side-by-side comparison</p>
              <h2>{books.length} books selected</h2>
            </div>
            <span className="pill">Compare attributes</span>
          </div>
          <div className="comparison-scroll">
            <table className="comparison-table">
              <thead>
                <tr><th scope="col">Attribute</th>{books.map((book) => <th scope="col" key={book.id}>{book.title}</th>)}</tr>
              </thead>
              <tbody>
                <tr className="comparison-section"><th colSpan={books.length + 1}>Book information</th></tr>
                <tr><th scope="row">Author</th>{books.map((book) => <td key={book.id}>{book.author}</td>)}</tr>
                <tr><th scope="row">ISBN</th>{books.map((book) => <td key={book.id}>{book.isbn || "Not provided"}</td>)}</tr>
                <tr><th scope="row">Description</th>{books.map((book) => <td key={book.id}>{book.description || "No description provided."}</td>)}</tr>
                <tr><th scope="row">Genre</th>{books.map((book) => <td key={book.id}>{book.genre}</td>)}</tr>
                <tr><th scope="row">Condition</th>{books.map((book) => <td key={book.id}>{book.condition}</td>)}</tr>
                <tr className="comparison-section"><th colSpan={books.length + 1}>Purchase information</th></tr>
                <tr><th scope="row">Price</th>{books.map((book) => <td className="comparison-price" key={book.id}>${Number(book.price).toFixed(2)}</td>)}</tr>
                <tr><th scope="row">Stock</th>{books.map((book) => <td key={book.id}><span className="pill">{book.stock} available</span></td>)}</tr>
                <tr><th scope="row">Seller</th>{books.map((book) => <td key={book.id}>{book.sellerName}</td>)}</tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

export default CompareBooks;
