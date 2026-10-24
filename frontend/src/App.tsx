import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";

import Login from "./Account/Login";
import Register from "./Account/Register";
import Profile from "./Account/Profile";
import WriteReview from "./Reviews/WriteReview";
import ManageWishlist from "./Wishlist/ManageWishlist";
import BuyerHome from "./Buyer/BuyerHome";
import BookDetails from "./Buyer/BookDetails";
import BuyBook from "./Buyer/BuyBook";
import SellerHome from "./Seller/SellerHome";
import AdminHome from "./Admin/AdminHome";

type Role = "buyer" | "seller" | "admin";

// Only shows the page to logged-in users whose role is in the allowed list
function ProtectedPage({ roles, children }: { roles: Role[]; children: ReactNode }) {
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

  if (!roles.includes(user.role as Role)) {
    return <p>Access denied. You do not have permission to view this page.</p>;
  }

  return <>{children}</>;
}

// Display a 404 page for invalid URLs
function NotFound() {
  return (
    <div>
      <h1>404 - Page Not Found</h1>
      <p>Sorry, the page you are looking for does not exist.</p>
      <Link to="/login">Back to Login</Link>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/login">Login</Link>{" | "}
        <Link to="/register">Register</Link>{" | "}
        <Link to="/profile">Profile</Link>{" | "}
        <Link to="/reviews/write">Write Review</Link>{" | "}
        <Link to="/wishlist">Wishlist</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<ProtectedPage roles={["buyer", "seller", "admin"]}><Profile /></ProtectedPage>} />
        <Route path="/reviews/write" element={<ProtectedPage roles={["buyer"]}><WriteReview /></ProtectedPage>} />
        <Route path="/wishlist" element={<ProtectedPage roles={["buyer"]}><ManageWishlist /></ProtectedPage>} />

        <Route path="/buyer" element={<ProtectedPage roles={["buyer"]}><BuyerHome /></ProtectedPage>} />
        <Route path="/buyer/books/:id" element={<ProtectedPage roles={["buyer"]}><BookDetails /></ProtectedPage>} />
        <Route path="/buyer/books/:id/buy" element={<ProtectedPage roles={["buyer"]}><BuyBook /></ProtectedPage>} />
        <Route path="/seller" element={<ProtectedPage roles={["seller"]}><SellerHome /></ProtectedPage>} />
        <Route path="/admin" element={<ProtectedPage roles={["admin"]}><AdminHome /></ProtectedPage>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
