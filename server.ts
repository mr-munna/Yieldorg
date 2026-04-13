import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { startCronJobs } from "./src/server/cron.ts";
import admin from 'firebase-admin';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Start the background cron jobs
  startCronJobs();

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/resolve-member/:memberId", async (req, res) => {
    try {
      const db = admin.firestore();
      const snapshot = await db.collection('users')
        .where('memberId', '==', req.params.memberId.toUpperCase())
        .limit(1)
        .get();
        
      if (snapshot.empty) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      return res.json({ email: snapshot.docs[0].data().email });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
