import { useEffect, useState } from "react";

type Listing = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  genre: string;
  condition: string;
  price: string;
  stock: number;
  imagePath: string | null;
  status: string;
  rejectionReason: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending Review",
  approved: "Published",
  rejected: "Rejected",
  archived: "Disabled by admin",
};

// Get the logged-in seller's own listings
async function fetchMyListings() {
  const token = sessionStorage.getItem("authToken");
  const response = await fetch("http://localhost:3000/api/seller/listings", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load your listings.");
  }

  return data.listings as Listing[];
}

function SellerHome() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [genre, setGenre] = useState("");
  const [condition, setCondition] = useState("new");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [image, setImage] = useState<File | null>(null);
  // Changing this key clears the file input after an upload
  const [fileInputKey, setFileInputKey] = useState(0);
  const [message, setMessage] = useState("");
  const [listMessage, setListMessage] = useState("");

  useEffect(() => {
    fetchMyListings()
      .then(setListings)
      .catch((error) => setListMessage(error.message));
  }, []);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    // Send the listing as form data so the cover image file can be included
    const formData = new FormData();
    formData.append("title", title);
    formData.append("author", author);
    formData.append("isbn", isbn);
    formData.append("genre", genre);
    formData.append("condition", condition);
    formData.append("description", description);
    formData.append("price", price);
    formData.append("stock", stock);
    if (image) {
      formData.append("image", image);
    }

    try {
      const response = await fetch("http://localhost:3000/api/seller/listings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("authToken")}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not upload the listing.");
        return;
      }

      setMessage(data.message);

      // Clear the form for the next listing
      setTitle("");
      setAuthor("");
      setIsbn("");
      setGenre("");
      setCondition("new");
      setDescription("");
      setPrice("");
      setStock("");
      setImage(null);
      setFileInputKey((key) => key + 1);

      setListings(await fetchMyListings());
    } catch {
      setMessage("Could not connect to the server.");
    }
  }

  return (
    <div>
      <h2>Upload a Book</h2>

      <form onSubmit={handleUpload}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Author"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          required
        />

        <input
          type="text"
          placeholder="ISBN-10 or ISBN-13"
          value={isbn}
          onChange={(event) => setIsbn(event.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Genre"
          value={genre}
          onChange={(event) => setGenre(event.target.value)}
          required
        />

        <select value={condition} onChange={(event) => setCondition(event.target.value)}>
          <option value="new">New</option>
          <option value="used">Used</option>
        </select>

        <textarea
          placeholder="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Price"
          min="0"
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Stock"
          min="0"
          step="1"
          value={stock}
          onChange={(event) => setStock(event.target.value)}
          required
        />

        <label>
          Cover image (optional, JPEG, PNG, or WebP, up to 2 MB)
          <input
            key={fileInputKey}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setImage(event.target.files?.[0] || null)}
          />
        </label>

        <button type="submit">Upload</button>
      </form>

      <p>{message}</p>

      <h2>My Listings</h2>

      <p>{listMessage}</p>

      {listings.length === 0 && !listMessage && <p>You have not listed any books yet.</p>}

      <ul>
        {listings.map((listing) => (
          <li key={listing.id}>
            {listing.imagePath && (
              <img src={`http://localhost:3000${listing.imagePath}`} alt={`Cover of ${listing.title}`} width={100} />
            )}
            <h3>{listing.title}</h3>
            <p>by {listing.author}</p>
            <p>
              ${Number(listing.price).toFixed(2)} | {listing.stock} in stock | ISBN: {listing.isbn}
            </p>
            <p>Status: {STATUS_LABELS[listing.status] || listing.status}</p>
            {listing.status === "rejected" && listing.rejectionReason && (
              <p>Reason: {listing.rejectionReason}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SellerHome;
