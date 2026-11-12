import { useEffect, useState } from "react";
import RoleInbox from "./Components/RoleInbox";

type Role = "buyer" | "seller" | "admin";

function Inbox() {
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("authToken") || "";
    fetch("http://localhost:3000/api/auth/me", { headers: { Authorization: "Bearer " + token } })
      .then((response) => response.json())
      .then((data) => setRole(data.user?.role || null))
      .catch(() => setRole(null));
  }, []);

  if (!role) return <main className="page"><p className="status-message">Loading inbox...</p></main>;
  return <main className="page"><RoleInbox role={role} /></main>;
}

export default Inbox;
