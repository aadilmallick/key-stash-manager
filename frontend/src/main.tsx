import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

async function main() {
  // first fetch from server to update local storage, then render the app
  createRoot(document.getElementById("root")!).render(<App />);
  try {
    const response = await fetch("/api/sync");
    const data = await response.json();
    localStorage.setItem("api-key-manager-secrets", JSON.stringify(data));
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

main();
