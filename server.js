const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");

const getFilePath = (...pathSegments) => path.join(__dirname, ...pathSegments);

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJSONFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading file:", error);
    return null;
  }
}

async function upsertJSONFile(filePath, data) {
  try {
    if (!(await fileExists(filePath))) {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("Error writing file:", error);
  }
}

async function writeJSONFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing file:", error);
  }
}

function upsertFolder(folderpath) {
  try {
    fsSync.mkdirSync(folderPath);
  } catch (e) {}
}

const folderPath = getFilePath("data");
upsertFolder(folderPath);
// Middleware
app.use(express.json());
app.use(express.static("frontend/dist"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

const jsonPath = getFilePath("data", "keys.json");

function getEmptyRootSchema() {
  return {
    folders: [
      {
        id: "default",
        name: "Default",
        secrets: [],
      },
    ],
  };
}

app.get("/api/sync", async (req, res) => {
  await upsertJSONFile(jsonPath, getEmptyRootSchema());
  const data = await readJSONFile(jsonPath);
  res.json(data);
});

app.post("/api/sync", async (req, res) => {
  if (!req.body.folders) {
    res.status(400).json({ error: "Folders are required" });
    return;
  }

  try {
    await writeJSONFile(jsonPath, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).json({ error: "Failed to write file" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} at http://localhost:${PORT}`);
});

// interface Secret {
//   name: string;
//   value: string;
//   tags: string[];
//   id: string;
//   createdAt: string;
//   updatedAt: string;
// }

// interface Folder {
//   id: string;
//   name: string;
//   secrets: Secret[];
// }

// interface RootSchema {
//   folders: Folder[];
// }
