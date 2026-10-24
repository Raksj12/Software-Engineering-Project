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

  return (
    <div>
      <Link to="/buyer">Back to Books for Sale</Link>

      <p>{message}</p>

      {book && (
        <div>
          {book.imagePath && (
            <img src={`http://localhost:3000${book.imagePath}`} alt={`Cover of ${book.title}`} width={200} />
          )}
          <h2>{book.title}</h2>
          <p>by {book.author}</p>
          <p>${Number(book.price).toFixed(2)}</p>
          <p>{book.stock === 0 ? "Out of Stock" : `${book.stock} in stock`}</p>

          {book.stock > 0 && (
            <button type="button" onClick={() => navigate(`/buyer/books/${book.id}/buy`)}>
              Buy Now
            </button>
          )}

          <h3>Description</h3>
          <p>{book.description || "No description provided."}</p>

          <h3>Details</h3>
          <p>Genre: {book.genre}</p>
          <p>Condition: {book.condition}</p>
          <p>ISBN: {book.isbn}</p>
          <p>Sold by {book.sellerName}</p>
        </div>
      )}
    </div>
  );
}

export default BookDetails;
