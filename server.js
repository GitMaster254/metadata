/**
 * Express Server for Audio Metadata Extraction
 * Ready for Fly.io, Render, or Railway deployment
 */

import express from "express";
import cors from "cors"; // Ensure cors is imported
import multer from "multer";
import { extractMetadata } from "./src/extract-metadata.js";

const app = express();
const upload = multer({ dest: "uploads/" });

// Enable CORS for all origins or limit to your Vercel frontend
app.use(
  cors({
    origin: ["https://vibesync-neon.vercel.app","*"], // Adjust this to your frontend URL
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// Explicitly handle OPTIONS requests
app.options("/api/extract-metadata", cors(), (req, res) => {
  res.status(200).send();
});

// Middleware to parse JSON and form-data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Start Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));