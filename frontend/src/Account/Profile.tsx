import { useEffect, useState } from "react";

function Profile() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get the user's current information
  useEffect(() => {
    async function loadProfile() {
      const token = sessionStorage.getItem("authToken");

      if (!token) {
        setIsLoggedIn(false);
        setMessage("Please log in first.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("http://localhost:3000/api/auth/me", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

       if (!response.ok) {
        sessionStorage.removeItem("authToken");
        setIsLoggedIn(false);
        setMessage("Your session has expired. Please log in again.");
        return;
       }

        setFullName(data.user.fullName);
        setEmail(data.user.email);
        setIsLoggedIn(true);
      } catch {
        setMessage("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
    // Check the login session every minute
    const interval = setInterval(loadProfile, 60 * 1000);

    // Stop checking when leaving Profile
    return () => clearInterval(interval);
    }, []);

  // Save changes to the user's profile
  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const token = sessionStorage.getItem("authToken");

    if (!token) {
      setIsLoggedIn(false);
      setMessage("Please log in first.");
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fullName, email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem("authToken");
          setIsLoggedIn(false);
        }

        setMessage(data.error || "Could not update profile.");
        return;
      }

      setFullName(data.user.fullName);
      setEmail(data.user.email);
      setMessage("Profile updated successfully.");
    } catch {
      setMessage("Could not connect to the server.");
    }
  }

  if (loading) {
    return <p>Loading profile...</p>;
  }

  return (
    <div>
      <h2>My Profile</h2>

      {isLoggedIn ? (
        <form onSubmit={handleUpdate}>
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <button type="submit">Save Changes</button>
        </form>
      ) : null}

      <p>{message}</p>
    </div>
  );
}

export default Profile;
