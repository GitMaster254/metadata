/**
 * Metadata Extraction Utility (Lightweight)
 * Uses ffprobe and music-metadata for audio info
 * Saves album art separately and returns a URL
 */

import ffmpeg from "fluent-ffmpeg";
import ffprobeStatic from "ffprobe-static";
import fs from "fs/promises";
import path from "path";
import * as mm from "music-metadata";

ffmpeg.setFfprobePath(ffprobeStatic.path);

const COVER_DIR = path.join(process.cwd(), "covers");

/**
 * Extracts metadata from an audio file
 * @param {string} filePath - Path to the uploaded audio file
 * @returns {Promise<object>} - Metadata object (lightweight)
 */
export async function extractMetadata(filePath) {
  try {
    // Ensure cover folder exists
    await fs.mkdir(COVER_DIR, { recursive: true });

    // Run ffprobe for format and streams
    const probe = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => (err ? reject(err) : resolve(metadata)));
    });

    // Get music-metadata tags
    const meta = await mm.parseFile(filePath, { duration: true });

    const c = meta.common ?? {};
    const f = probe?.format ?? meta.format ?? {};
    const stream0 = probe?.streams?.[0] ?? {};

    // Handle embedded album art: save to file and return URL
    let coverUrl = null;
    if (Array.isArray(c.picture) && c.picture.length > 0) {
      const pic = c.picture[0];
      const ext = pic.format?.split("/")[1] || "jpg";
      const fileName = `cover_${Date.now()}.${ext}`;
      const coverPath = path.join(COVER_DIR, fileName);
      await fs.writeFile(coverPath, pic.data);
      coverUrl = `/covers/${fileName}`; // URL for frontend usage
    }

    // Build lightweight metadata object
    const extracted = {
      title: c.title || f.tags?.title || "Untitled",
      artist: c.artist || "Unknown Artist",
      album: c.album || "Unknown Album",
      genre: Array.isArray(c.genre) ? c.genre[0] : c.genre || "Unknown",
      year: c.year || f.tags?.date || null,
      bitrate: f.bit_rate
        ? parseInt(f.bit_rate)
        : meta.format?.bitrate
        ? Math.round(meta.format.bitrate)
        : null,
      duration: f.duration
        ? Number(f.duration.toFixed(2))
        : meta.format?.duration
        ? Number(meta.format.duration.toFixed(2))
        : null,
      codec: stream0.codec_name || meta.format?.codec || "Unknown",
      sampleRate: stream0.sample_rate ? Number(stream0.sample_rate) : meta.format?.sampleRate,
      channels: stream0.channels || meta.format?.numberOfChannels,
      formatName: f.format_long_name || meta.format?.container,
      size: f.size ? Number(f.size) : null,
      coverUrl, // only URL, not Base64
    };

    // Clean up uploaded file
    await fs.unlink(filePath).catch(() => {});

    return extracted;
  } catch (error) {
    console.error("⚠️ Extraction error:", error);
    await fs.unlink(filePath).catch(() => {});
    throw new Error("Failed to extract metadata");
  }
}
