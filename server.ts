import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where, limit } from "firebase/firestore";
import { startCronJobs } from "./src/server/cron.ts";

// Load Firebase Config
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (e) {
    console.error("Error reading firebase-applet-config.json", e);
  }
}

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

export async function purgeNonAdminUsers() {
  return { success: true, message: "Purge is handled safely from admin client interface." };
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Start background cron jobs safely
  try {
    startCronJobs();
  } catch (err) {
    console.error("Cron jobs start error:", err);
  }

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/admin/purge-non-admins", async (req, res) => {
    const result = await purgeNonAdminUsers();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  });

  app.get("/api/resolve-member/:memberId", async (req, res) => {
    try {
      const q = query(
        collection(db, 'users'),
        where('memberId', '==', req.params.memberId.toUpperCase()),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      return res.json({ email: snapshot.docs[0].data().email });
    } catch (e) {
      console.error('Resolve member error:', e);
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
