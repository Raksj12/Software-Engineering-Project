import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

type Role = "buyer" | "seller" | "admin";

const HOME_PATH: Record<Role, string> = {
  buyer: "/buyer",
  seller: "/seller",
  admin: "/admin",
};

// Ask the backend who is logged in (null if nobody)
async function fetchRole(): Promise<Role | null> {
  const token = sessionStorage.getItem("authToken");
  if (!token) return null;

  try {
    const response = await fetch("http://localhost:3000/api/auth/me", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.user.role as Role;
  } catch {
    return null;
  }
}

// Nav link and logo target: each role's own homepage
export function HomeLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const location = useLocation();

  // Re-check on every page change so it updates after login or logout
  useEffect(() => {
    fetchRole().then(setRole);
  }, [location.pathname]);

  return (
    <Link className={className} to={role ? HOME_PATH[role] : "/login"}>
      {children}
    </Link>
  );
}

// The "/" route: send each role to its homepage
function RoleHome() {
  const [role, setRole] = useState<Role | null | undefined>(undefined);

  useEffect(() => {
    fetchRole().then(setRole);
  }, []);

  if (role === undefined) return <p className="status-message">Loading...</p>;
  return <Navigate to={role ? HOME_PATH[role] : "/login"} replace />;
}

export default RoleHome;