import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(
        () => !!sessionStorage.getItem("authToken")
  );

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    // Send the login information to the backend
    try {
      const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Login failed.");
        return;
      }

      // Save the authentication token.
      sessionStorage.setItem("authToken", data.token);
      setIsLoggedIn(true);

      setMessage(`Welcome, ${data.user.fullName}!`);

      // Send users to the correct page based on their role
      if (data.user.role === "buyer") {
          navigate("/buyer");
      } else if (data.user.role === "seller") {
         navigate("/seller");
      } else if (data.user.role === "admin") {
          navigate("/admin");
      }
      } catch {
        setMessage("Could not connect to the server.");
      }
  }

  async function handleLogout() {
    const token = sessionStorage.getItem("authToken");

    try {
      if (token) {
        await fetch("http://localhost:3000/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Clear the local session even if the server is unavailable.
    } finally {
      sessionStorage.removeItem("authToken");
      setIsLoggedIn(false);
      setEmail("");
      setPassword("");
      setMessage("You have been logged out.");
    }
  }

  return (
    <div>
      <h2>Login</h2>

      {!isLoggedIn ? (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button type="submit">Login</button>
        </form>
      ) : (
        <button type="button" onClick={handleLogout}>
          Logout
        </button>
      )}

      <p>{message}</p>
    </div>
  );
}

export default Login;
