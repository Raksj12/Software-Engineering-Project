import { useEffect, useState } from "react";

type Book = {
  id: number;
  title: string;
};

function WriteReview() {
  const [productId, setProductId] = useState("");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [books, setBooks] = useState<Book[]>([]);

  // Load books the buyer can review
  useEffect(() => {
    const token = sessionStorage.getItem("authToken");

    if (!token) return;

    async function loadBooks() {
      try {
        const response = await fetch(
          "http://localhost:3000/api/reviews/eligible",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) return;

        const data = await response.json();
        setBooks(data.books);
      } catch {
        setMessage("Could not load books.");
      }
    }

    loadBooks();
  }, []);

  // Submit the review to the backend
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const token = sessionStorage.getItem("authToken");

    if (!token) {
      setMessage("Please log in first.");
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: Number(productId),
          rating,
          body,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not submit review.");
        return;
      }

      setMessage("Review submitted successfully.");

      // Remove the reviewed book from the dropdown
      setBooks((previousBooks) =>
        previousBooks.filter((book) => book.id !== Number(productId))
      );

      setProductId("");
      setRating(5);
      setBody("");
    } catch {
      setMessage("Could not connect to the server.");
    }
  }

  // Display the review submission form
  return (
    <div>
      <h2>Write a Review</h2>

      <form onSubmit={handleSubmit}>
        <label>Book</label>
        <select
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          required
        >
          <option value="">Select a book</option>

          {books.map((book) => (
            <option key={book.id} value={book.id}>
              {book.title}
            </option>
          ))}
        </select>

        <label>Rating</label>
        <select
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
        >
          <option value={1}>1 Star</option>
          <option value={2}>2 Stars</option>
          <option value={3}>3 Stars</option>
          <option value={4}>4 Stars</option>
          <option value={5}>5 Stars</option>
        </select>

        <label>Review</label>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write your review here..."
          required
        />

        <button type="submit">Submit Review</button>
      </form>

      <p>{message}</p>
    </div>
  );
}

export default WriteReview;

