const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const { z } = require("zod");
const dotenv = require("dotenv");

dotenv.config();
console.log(process.env.USING_SERVER);

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

function upsertFolder(folderPath) {
  try {
    if (!fsSync.existsSync(folderPath)) {
      fsSync.mkdirSync(folderPath, { recursive: true });
    }
  } catch (e) {
    console.error("Error creating folder:", e);
  }
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

function createDefaultProfile() {
  return {
    id: "default",
    name: "Default",
    folders: [
      {
        id: "default",
        name: "Default",
        secrets: [],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getEmptyRootSchema() {
  return {
    profiles: [createDefaultProfile()],
    currentProfileId: "default",
  };
}

// Migration function to handle old data structure
function migrateOldData(data) {
  // Check if it's the old structure (has folders directly)
  if (data.folders && !data.profiles) {
    console.log("Migrating old data structure to profiles...");
    const migratedProfile = {
      id: "default",
      name: "Default",
      folders: data.folders,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      profiles: [migratedProfile],
      currentProfileId: "default",
    };
  }

  // Already new structure or empty
  return data.profiles ? data : getEmptyRootSchema();
}

app.get("/api/sync", async (req, res) => {
  try {
    // Ensure the file exists with default data
    await upsertJSONFile(jsonPath, getEmptyRootSchema());

    // Read the current data
    const rawData = await readJSONFile(jsonPath);
    if (!rawData) {
      return res.json(getEmptyRootSchema());
    }

    // Migrate if necessary
    const migratedData = migrateOldData(rawData);

    // If migration occurred, save the migrated data
    if (migratedData !== rawData) {
      await writeJSONFile(jsonPath, migratedData);
    }

    res.json(migratedData);
  } catch (error) {
    console.error("Error in GET /api/sync:", error);
    res.status(500).json({ error: "Failed to read data" });
  }
});

// Enhanced Zod schemas for the new profile structure
const secretSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.string(),
  tags: z.array(z.string()),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const folderSchema = z.object({
  id: z.string(),
  name: z.string(),
  secrets: z.array(secretSchema),
});

const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  folders: z.array(folderSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const storageSchema = z.object({
  profiles: z.array(profileSchema),
  currentProfileId: z.string(),
});

function validateSchema(data) {
  try {
    const parsed = storageSchema.parse(data);
    return parsed;
  } catch (error) {
    console.error("Schema validation error:", error);
    throw new Error(`Invalid data structure: ${error.message}`);
  }
}

app.post("/api/sync", async (req, res) => {
  try {
    console.log(
      "Received sync request with data:",
      JSON.stringify(req.body, null, 2)
    );

    const validatedData = validateSchema(req.body);
    await writeJSONFile(jsonPath, validatedData);

    console.log("Successfully saved data to server");
    res.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/sync:", error);
    res.status(400).json({
      error: `Failed to save data: ${error.message}`,
      details: error.issues || error.errors || [],
    });
  }
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} at http://localhost:${PORT}`);
});
