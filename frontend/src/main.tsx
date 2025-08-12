import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { fetchFromServer } from "./lib/SyncUtils.ts";

async function main() {
  // first fetch from server to update local storage, then render the app
  createRoot(document.getElementById("root")!).render(<App />);
  try {
    const data = await fetchFromServer();
    if (data) {
      localStorage.setItem("api-key-manager-secrets", JSON.stringify(data));
    }
  } catch (error) {
    console.error(
      "Error occurred while trying to fetch /api/sync: does the server exist?",
      error
    );
  }
}

main();
