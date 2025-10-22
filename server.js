/**
 * Express Server for Audio Metadata Extraction
 * Ready for Fly.io, Render, or Railway deployment
 */

import express from "express";
import multer from "multer";
import { extractMetadata } from "./src/extract-metadata.js";

const app = express();
const upload = multer({ dest: "uploads/" });

//Enable CORS for my frontend
app.use(cors({
  origin: "*", // you can replace "*" with your frontend domain later for security
  methods: ["GET", "POST"],
}));

// --- Routes --- //

// Root route (for testing)
app.get("/", (req, res) => {
  res.send("🎵 Metadata Extraction API is running!");
});

// Upload and extract metadata
app.post("/api/extract-metadata", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const metadata = await extractMetadata(req.file.path);

    res.json({ success: true, metadata });
  } catch (error) {
    console.error("❌ Metadata extraction failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Start Server --- //
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
