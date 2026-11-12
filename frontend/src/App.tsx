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
import CompareBooks from "./Buyer/CompareBooks";
import Home from "./Home";
import Inbox from "./Inbox";

type Role = "buyer" | "seller" | "admin";
type CurrentUser = { fullName: string; role: Role };

function RoleBadge() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    async function loadUser() {
      const token = sessionStorage.getItem("authToken");
      if (!token) {
        setUser(null);
        return;
      }

      try {
        const response = await fetch("http://localhost:3000/api/auth/me", {
          headers: { Authorization: "Bearer " + token },
        });
        if (!response.ok) {
          setUser(null);
          return;
        }
        const data = await response.json();
        setUser(data.user);
      } catch {
        setUser(null);
      }
    }

    loadUser();
    window.addEventListener("auth-changed", loadUser);
    return () => window.removeEventListener("auth-changed", loadUser);
  }, []);

  if (!user) {
    return <span className="role-badge">Guest</span>;
  }

  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  return <span className="role-badge">Signed in as {roleLabel}</span>;
}

function CartBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function loadCartCount() {
      const token = sessionStorage.getItem("authToken");
      if (!token) {
        setCount(0);
        return;
      }

      const response = await fetch("http://localhost:3000/api/cart", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setCount((data.items || []).reduce(
        (total: number, item: { quantity: number }) => total + Number(item.quantity),
        0,
      ));
    }

    loadCartCount().catch(() => undefined);
    window.addEventListener("cart-changed", loadCartCount);
    window.addEventListener("auth-changed", loadCartCount);
    return () => {
      window.removeEventListener("cart-changed", loadCartCount);
      window.removeEventListener("auth-changed", loadCartCount);
    };
  }, []);

  return <Link to="/buyer/cart">Cart <span className="cart-badge">{count}</span></Link>;
}

function NotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function loadUnreadCount() {
      const token = sessionStorage.getItem("authToken");
      if (!token) {
        setCount(0);
        return;
      }

      const response = await fetch("http://localhost:3000/api/notifications", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok) return;
      const data = await response.json();
      setCount((data.notifications || []).filter((item: { isRead: boolean }) => !item.isRead).length);
    }

    loadUnreadCount().catch(() => undefined);
    window.addEventListener("notifications-changed", loadUnreadCount);
    window.addEventListener("auth-changed", loadUnreadCount);
    return () => {
      window.removeEventListener("notifications-changed", loadUnreadCount);
      window.removeEventListener("auth-changed", loadUnreadCount);
    };
  }, []);

  return <Link to="/inbox">Inbox <span className="notification-badge">{count}</span></Link>;
}

function Navigation() {
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    async function loadRole() {
      const token = sessionStorage.getItem("authToken");
      if (!token) { setRole(null); return; }
      const response = await fetch("http://localhost:3000/api/auth/me", { headers: { Authorization: "Bearer " + token } });
      if (!response.ok) { setRole(null); return; }
      const data = await response.json();
      setRole(data.user?.role || null);
    }
    loadRole().catch(() => setRole(null));
    window.addEventListener("auth-changed", loadRole);
    return () => window.removeEventListener("auth-changed", loadRole);
  }, []);

  if (role === "admin") {
    return <><Link to="/admin">Control Center</Link><NotificationBadge /><Link to="/profile">Admin profile</Link><Link to="/login">Sign out</Link><RoleBadge /></>;
  }

  if (role === "seller") {
    return <><Link to="/seller">Seller workspace</Link><NotificationBadge /><Link to="/profile">Seller profile</Link><Link to="/login">Sign out</Link><RoleBadge /></>;
  }

  return <><Link to="/home">Home</Link><Link to="/buyer">Browse</Link><CartBadge /><Link to="/buyer/orders">Orders</Link><NotificationBadge /><Link to="/wishlist">Wishlist</Link><Link to="/profile">Profile</Link><Link to="/login">Sign in</Link><RoleBadge /></>;
}

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
          <Link className="brand" to="/home">Book<span>Haven</span></Link>
          <nav className="site-nav" aria-label="Main navigation">
            <Navigation />
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<ProtectedPage roles={["buyer", "seller", "admin"]}><Profile /></ProtectedPage>} />
          <Route path="/inbox" element={<ProtectedPage roles={["buyer", "seller", "admin"]}><Inbox /></ProtectedPage>} />
          <Route path="/reviews/write" element={<ProtectedPage roles={["buyer", "admin"]}><WriteReview /></ProtectedPage>} />
          <Route path="/wishlist" element={<ProtectedPage roles={["buyer", "admin"]}><ManageWishlist /></ProtectedPage>} />

          <Route path="/buyer" element={<ProtectedPage roles={["buyer", "admin"]}><BuyerHome /></ProtectedPage>} />
          <Route path="/buyer/books/:id" element={<ProtectedPage roles={["buyer", "admin"]}><BookDetails /></ProtectedPage>} />
          <Route path="/buyer/books/:id/buy" element={<ProtectedPage roles={["buyer", "admin"]}><BuyBook /></ProtectedPage>} />
          <Route path="/buyer/cart" element={<ProtectedPage roles={["buyer", "admin"]}><Cart /></ProtectedPage>} />
          <Route path="/buyer/checkout" element={<ProtectedPage roles={["buyer", "admin"]}><Checkout /></ProtectedPage>} />
          <Route path="/buyer/orders" element={<ProtectedPage roles={["buyer", "admin"]}><OrderHistory /></ProtectedPage>} />
          <Route path="/buyer/compare" element={<ProtectedPage roles={["buyer", "admin"]}><CompareBooks /></ProtectedPage>} />
          <Route path="/seller" element={<ProtectedPage roles={["seller", "admin"]}><SellerHome /></ProtectedPage>} />
          <Route path="/admin" element={<ProtectedPage roles={["admin"]}><AdminHome /></ProtectedPage>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <footer className="site-footer">Independent books, thoughtful readers, one welcoming marketplace.</footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
