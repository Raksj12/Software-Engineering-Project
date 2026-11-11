import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type User = { fullName: string; role: "buyer" | "seller" | "admin" };

const HOME_PATH: Record<User["role"], string> = {
  buyer: "/buyer",
  seller: "/seller",
  admin: "/admin",
};

function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = sessionStorage.getItem("authToken");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("http://localhost:3000/api/auth/me", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          sessionStorage.removeItem("authToken");
        }
      } catch {
        // Show the logged-out homepage if the server is unreachable
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h1>BookHaven</h1>
      <p>An online marketplace connecting independent booksellers with readers.</p>

      {user ? (
        <div>
          <h2>Welcome back, {user.fullName}!</h2>
          <p>
            <Link to={HOME_PATH[user.role]}>
              {user.role === "buyer" && "Browse books for sale"}
              {user.role === "seller" && "Manage your listings and orders"}
              {user.role === "admin" && "Review book upload requests"}
            </Link>
          </p>
          <p><Link to="/notifications">View your notifications</Link></p>
          <p><Link to="/profile">Edit your profile</Link></p>
        </div>
      ) : (
        <div>
          <h2>Get started</h2>
          <p><Link to="/login">Log in</Link> or <Link to="/register">create an account</Link>.</p>
          <p>Sellers need admin approval before they can log in.</p>
        </div>
      )}
    </div>
  );
}

export default Home;