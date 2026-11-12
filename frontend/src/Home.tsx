import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

function Home() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    fetch("http://localhost:3000/api/auth/me", { headers: { Authorization: "Bearer " + (sessionStorage.getItem("authToken") || "") } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setRole(data?.user?.role || "login"))
      .catch(() => setRole("login"));
  }, []);
  if (!role) return <main className="page"><p className="status-message">Loading your home...</p></main>;
  return <Navigate to={role === "buyer" ? "/buyer" : role === "seller" ? "/seller" : role === "admin" ? "/admin" : "/login"} replace />;
}

export default Home;
