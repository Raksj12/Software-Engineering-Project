import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";

import Login from "./Account/Login";
import Register from "./Account/Register";
import Profile from "./Account/Profile";

function ProtectedPage({ role }: { role: "buyer" | "seller" | "admin" }) {
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const token = sessionStorage.getItem("authToken");

      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Check the login token with the backend
        const response = await fetch("http://localhost:3000/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // Remove the expired or invalid token
          sessionStorage.removeItem("authToken");
          setUser(null);
          return;
        }

        const data = await response.json();
        setUser(data.user);
      } catch {
        // Do not grant access if verification fails
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkUser();

    // Check the session every minute
    const interval = setInterval(checkUser, 60 * 1000);

    // Stop checking when leaving the page
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <p>Checking login...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <p>Access denied. You do not have permission to view this page.</p>;
  }

  return (
    <div>
      <h2>{role.charAt(0).toUpperCase() + role.slice(1)} Page</h2>
      <p>You are logged in as a {role}.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/login">Login</Link>{" | "}
        <Link to="/register">Register</Link>{" | "}
        <Link to="/profile">Profile</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />

        <Route path="/buyer" element={<ProtectedPage role="buyer" />} />
        <Route path="/seller" element={<ProtectedPage role="seller" />} />
        <Route path="/admin" element={<ProtectedPage role="admin" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
