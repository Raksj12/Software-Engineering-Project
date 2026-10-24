import { useEffect, useState } from "react";

type PendingListing = {
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
  createdAt: string;
  flagged: boolean;
  matchedPhrases: string[];
  isbnValid: boolean;
};

// Get listings waiting for review, oldest first
async function fetchPendingListings() {
  const token = sessionStorage.getItem("authToken");
  const response = await fetch("http://localhost:3000/api/admin/listings?status=pending", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load pending listings.");
  }

  return data.listings as PendingListing[];
}

function AdminHome() {
  const [listings, setListings] = useState<PendingListing[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchPendingListings()
      .then(setListings)
      .catch((error) => setMessage(error.message));
  }, []);

  // Approve or reject a listing, then refresh the queue
  async function reviewListing(id: string, action: "approve" | "reject") {
    setMessage("");

    try {
      const response = await fetch(`http://localhost:3000/api/admin/listings/${id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({ reason: reasons[id] || "" }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || `Could not ${action} the listing.`);
        return;
      }

      setMessage(action === "approve" ? "Listing approved." : "Listing rejected.");
      setListings(await fetchPendingListings());
    } catch {
      setMessage("Could not connect to the server.");
    }
  }

  return (
    <div>
      <h2>Book Upload Requests</h2>

      <p>{message}</p>

      {listings.length === 0 && <p>There are no listings waiting for review.</p>}

      <ul>
        {listings.map((listing) => (
          <li key={listing.id}>
            {listing.imagePath ? (
              <img src={`http://localhost:3000${listing.imagePath}`} alt={`Cover of ${listing.title}`} width={150} />
            ) : (
              <p>No cover image</p>
            )}
            <h3>{listing.title}</h3>
            <p>by {listing.author}</p>
            <p>Seller: {listing.sellerName}</p>
            <p>Submitted: {new Date(listing.createdAt).toLocaleString()}</p>
            <p>
              ${Number(listing.price).toFixed(2)} | {listing.stock} in stock | Genre: {listing.genre} |
              Condition: {listing.condition}
            </p>
            <p>ISBN: {listing.isbn} {listing.isbnValid ? "(valid)" : "(INVALID)"}</p>
            <p>{listing.description}</p>

            {listing.flagged && (
              <p>Warning: contains prohibited words: {listing.matchedPhrases.join(", ")}</p>
            )}

            <button type="button" onClick={() => reviewListing(listing.id, "approve")}>
              Approve
            </button>

            <input
              type="text"
              placeholder="Reason for rejection"
              value={reasons[listing.id] || ""}
              onChange={(event) => setReasons({ ...reasons, [listing.id]: event.target.value })}
            />

            <button type="button" onClick={() => reviewListing(listing.id, "reject")}>
              Reject
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AdminHome;
