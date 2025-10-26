// server.js
import express from "express";
import cors from "cors";
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import pingRoute  from "./src/ping.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));
app.use(express.json());

dotenv.config();
// Spotify API configuration
const SPOTIFY_CONFIG = {
  clientId: process.env.VITE_SPOTIFY_CLIENT_ID,
  clientSecret: process.env.VITE_SPOTIFY_CLIENT_SECRET
};

// Token management
let accessToken = null;
let tokenExpiry = null;

// Get Spotify access token
async function getSpotifyToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    if (!SPOTIFY_CONFIG.clientId || !SPOTIFY_CONFIG.clientSecret) {
      throw new Error('Spotify credentials not configured');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CONFIG.clientId}:${SPOTIFY_CONFIG.clientSecret}`).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Spotify token error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // 60 second buffer
    
    return accessToken;
  } catch (error) {
    console.error('Token fetch error:', error);
    throw error;
  }
}

// Generic Spotify API proxy
async function spotifyApiProxy(endpoint) {
  try {
    const token = await getSpotifyToken();
    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Spotify API proxy error:', error);
    throw error;
  }
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Spotify Proxy Server is running' });
});
//Ping server
app.use("/api/ping", pingRoute);

// Get featured tracks
app.get('/api/featured-tracks', async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    
    // Get featured playlists
    const featuredData = await spotifyApiProxy('/browse/featured-playlists?limit=1');
    
    if (!featuredData.playlists.items.length) {
      return res.status(404).json({ error: 'No featured playlists available' });
    }

    const playlistId = featuredData.playlists.items[0].id;
    const playlistTracks = await spotifyApiProxy(`/playlists/${playlistId}/tracks?limit=${limit}`);
    
    const tracks = playlistTracks.items
      .filter(item => item.track && item.track.preview_url)
      .map(item => ({
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map(artist => artist.name).join(', '),
        album: item.track.album?.name,
        coverArt: item.track.album?.images[2]?.url || item.track.album?.images[1]?.url || item.track.album?.images[0]?.url,
        previewUrl: item.track.preview_url,
        duration: item.track.duration_ms,
        externalUrl: item.track.external_urls.spotify
      }));

    res.json(tracks);
  } catch (error) {
    console.error('Featured tracks error:', error);
    res.status(500).json({ error: 'Failed to fetch featured tracks' });
  }
});

// Get genres
app.get('/api/genres', async (req, res) => {
  try {
    const data = await spotifyApiProxy('/recommendations/available-genre-seeds');
    
    const genres = data.genres.slice(0, 12).map((genreName, index) => ({
      id: genreName,
      name: genreName.charAt(0).toUpperCase() + genreName.slice(1),
      cover: `https://source.unsplash.com/random/300x300/?${genreName},music&${index}`
    }));

    res.json(genres);
  } catch (error) {
    console.error('Genres error:', error);
    res.status(500).json({ error: 'Failed to fetch genres' });
  }
});

// Get genre tracks
app.get('/api/genre-tracks', async (req, res) => {
  try {
    const { genre, limit = 20 } = req.query;
    
    if (!genre) {
      return res.status(400).json({ error: 'Genre parameter is required' });
    }

    const data = await spotifyApiProxy(`/recommendations?seed_genres=${genre}&limit=${limit}`);
    
    const tracks = data.tracks
      .filter(track => track.preview_url)
      .map(track => ({
        id: track.id,
        title: track.name,
        artist: track.artists.map(artist => artist.name).join(', '),
        album: track.album?.name,
        coverArt: track.album?.images[2]?.url || track.album?.images[1]?.url || track.album?.images[0]?.url,
        previewUrl: track.preview_url,
        duration: track.duration_ms,
        externalUrl: track.external_urls.spotify
      }));

    res.json(tracks);
  } catch (error) {
    console.error('Genre tracks error:', error);
    res.status(500).json({ error: 'Failed to fetch genre tracks' });
  }
});

// Search tracks
app.get('/api/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query parameter is required' });
    }

    const data = await spotifyApiProxy(`/search?q=${encodeURIComponent(q)}&type=track&limit=${limit}`);
    
    const tracks = data.tracks.items
      .filter(track => track.preview_url)
      .map(track => ({
        id: track.id,
        title: track.name,
        artist: track.artists.map(artist => artist.name).join(', '),
        album: track.album?.name,
        coverArt: track.album?.images[2]?.url || track.album?.images[1]?.url || track.album?.images[0]?.url,
        previewUrl: track.preview_url,
        duration: track.duration_ms,
        externalUrl: track.external_urls.spotify
      }));

    res.json(tracks);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get new releases
app.get('/api/new-releases', async (req, res) => {
  try {
    const limit = req.query.limit || 20;
    const data = await spotifyApiProxy(`/browse/new-releases?limit=${limit}`);
    
    // For simplicity, return album info instead of individual tracks
    const releases = data.albums.items.map(album => ({
      id: album.id,
      title: album.name,
      artist: album.artists.map(artist => artist.name).join(', '),
      coverArt: album.images[2]?.url || album.images[1]?.url || album.images[0]?.url,
      externalUrl: album.external_urls.spotify,
      releaseDate: album.release_date,
      totalTracks: album.total_tracks
    }));

    res.json(releases);
  } catch (error) {
    console.error('New releases error:', error);
    res.status(500).json({ error: 'Failed to fetch new releases' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Spotify Proxy Server running on port ${PORT}`);
  console.log('Environment check:', {
    hasClientId: !!SPOTIFY_CONFIG.clientId,
    hasClientSecret: !!SPOTIFY_CONFIG.clientSecret,
    frontendUrl: process.env.FRONTEND_URL
  });
});