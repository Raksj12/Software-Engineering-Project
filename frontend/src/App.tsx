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
import Cart from "./Buyer/Cart";
import Checkout from "./Buyer/Checkout";
import OrderHistory from "./Buyer/OrderHistory";
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
    return <div className="page"><p className="status-message">Checking your account...</p></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role as Role)) {
    return <div className="page page-narrow"><div className="form-card"><p className="eyebrow">Restricted area</p><h2>Access denied</h2><p className="muted">You do not have permission to view this page.</p><Link className="button" to="/login">Return to login</Link></div></div>;
  }

  return <>{children}</>;
}

// Display a 404 page for invalid URLs
function NotFound() {
  return (
    <div className="page page-narrow">
      <div className="form-card">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p className="muted">The page you are looking for does not exist.</p>
        <Link className="button" to="/login">Back to login</Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="site-header">
          <Link className="brand" to="/login">Book<span>Haven</span></Link>
          <nav className="site-nav" aria-label="Main navigation">
            <Link to="/buyer">Browse</Link>
            <Link to="/buyer/cart">Cart</Link>
            <Link to="/buyer/orders">Orders</Link>
            <Link to="/wishlist">Wishlist</Link>
            <Link to="/profile">Profile</Link>
            <Link to="/login">Sign in</Link>
          </nav>
        </header>

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
          <Route path="/buyer/cart" element={<ProtectedPage roles={["buyer"]}><Cart /></ProtectedPage>} />
          <Route path="/buyer/checkout" element={<ProtectedPage roles={["buyer"]}><Checkout /></ProtectedPage>} />
          <Route path="/buyer/orders" element={<ProtectedPage roles={["buyer"]}><OrderHistory /></ProtectedPage>} />
          <Route path="/seller" element={<ProtectedPage roles={["seller"]}><SellerHome /></ProtectedPage>} />
          <Route path="/admin" element={<ProtectedPage roles={["admin"]}><AdminHome /></ProtectedPage>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <footer className="site-footer">Independent books, thoughtful readers, one welcoming marketplace.</footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
