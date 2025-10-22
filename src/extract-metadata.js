/**
 * Metadata Extraction Utility
 * Uses ffprobe and music-metadata for rich audio info
 */

import ffmpeg from "fluent-ffmpeg";
import ffprobeStatic from "ffprobe-static";
import fs from "fs/promises";
import * as mm from "music-metadata";

ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * Extracts detailed metadata from an audio file
 * @param {string} filePath - Path to the uploaded file
 * @returns {Promise<object>} - Extracted metadata
 */
export async function extractMetadata(filePath) {
  try {
    // Run ffprobe for format and stream info
    const probe = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) =>
        err ? reject(err) : resolve(metadata)
      );
    });

    // Run music-metadata for tags
    const meta = await mm.parseFile(filePath, { duration: true });

    const c = meta.common ?? {};
    const f = probe?.format ?? meta.format ?? {};
    const stream0 = probe?.streams?.[0] ?? {};

    // Handle embedded album art
    let coverArt;
    if (Array.isArray(c.picture) && c.picture.length > 0) {
      const pic = c.picture[0];
      const mime = pic.format || "image/jpeg";
      const b64 = Buffer.from(pic.data).toString("base64");
      coverArt = `data:${mime};base64,${b64}`;
    }

    // Merge metadata
    const extracted = {
      title:
        c.title ||
        f.tags?.title ||
        "Untitled",
      artist: c.artist || "Unknown Artist",
      album: c.album || "Unknown Album",
      genre: Array.isArray(c.genre) ? c.genre[0] : c.genre || "Unknown",
      year: c.year || f.tags?.date || null,
      bitrate:
        f.bit_rate
          ? parseInt(f.bit_rate)
          : meta.format?.bitrate
          ? Math.round(meta.format.bitrate)
          : null,
      duration:
        f.duration
          ? Number(f.duration.toFixed(2))
          : meta.format?.duration
          ? Number(meta.format.duration.toFixed(2))
          : null,
      codec: stream0.codec_name || meta.format?.codec || "Unknown",
      sampleRate: stream0.sample_rate ? Number(stream0.sample_rate) : meta.format?.sampleRate,
      channels: stream0.channels || meta.format?.numberOfChannels,
      formatName: f.format_long_name || meta.format?.container,
      size: f.size ? Number(f.size) : null,
      coverArt,
    };

    // Cleanup temporary file
    await fs.unlink(filePath).catch(() => {});

    return extracted;
  } catch (error) {
    console.error("⚠️ Extraction error:", error);
    await fs.unlink(filePath).catch(() => {});
    throw new Error("Failed to extract metadata");
  }
}
