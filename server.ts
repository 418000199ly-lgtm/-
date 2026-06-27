import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  collection, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';

// Initialize server-side Firestore instance to bypass GFW firewalls inside emulator/mobile clients
const firebaseConfig = {
  projectId: "autonomous-abbey-nnzsc",
  appId: "1:270773766200:web:7b3caa1df6822ed079fecd",
  apiKey: "AIzaSyD1VHQ2AL0NklJCJCjy4EFqIs2HrqMy4RQ",
  authDomain: "autonomous-abbey-nnzsc.firebaseapp.com",
  storageBucket: "autonomous-abbey-nnzsc.firebasestorage.app",
  messagingSenderId: "270773766200"
};

const fbApp = initializeApp(firebaseConfig);
const db = initializeFirestore(fbApp, {
  experimentalForceLongPolling: true
}, "ai-studio-8c2c2304-5251-4eae-b3b7-9bbf375467a5");

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload size thresholds to avoid issues with large QR code images
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // CORS headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: Date.now() });
  });

  // 1. GET DOCUMENT PROXY
  app.get('/api/db/get', async (req, res) => {
    const { col, id } = req.query;
    if (!col || !id) {
      return res.status(400).json({ error: 'Missing col or id parameters' });
    }
    try {
      const docRef = doc(db, String(col), String(id));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        res.json({ exists: true, data: docSnap.data() });
      } else {
        res.json({ exists: false, data: null });
      }
    } catch (err: any) {
      console.error(`[Server Proxy] Failed to get doc ${col}/${id}:`, err);
      res.status(500).json({ error: err.message || 'Server database proxy error' });
    }
  });

  // 2. SET DOCUMENT PROXY
  app.post('/api/db/set', async (req, res) => {
    const { col, id, data, merge } = req.body;
    if (!col || !id || !data) {
      return res.status(400).json({ error: 'Missing col, id or data in body' });
    }
    try {
      const docRef = doc(db, String(col), String(id));
      await setDoc(docRef, data, { merge: !!merge });
      res.json({ success: true });
    } catch (err: any) {
      console.error(`[Server Proxy] Failed to set doc ${col}/${id}:`, err);
      res.status(500).json({ error: err.message || 'Server database proxy error' });
    }
  });

  // 3. UPDATE DOCUMENT PROXY
  app.post('/api/db/update', async (req, res) => {
    const { col, id, data } = req.body;
    if (!col || !id || !data) {
      return res.status(400).json({ error: 'Missing col, id or data in body' });
    }
    try {
      const docRef = doc(db, String(col), String(id));
      await updateDoc(docRef, data);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`[Server Proxy] Failed to update doc ${col}/${id}:`, err);
      res.status(500).json({ error: err.message || 'Server database proxy error' });
    }
  });

  // 4. DELETE DOCUMENT PROXY
  app.post('/api/db/delete', async (req, res) => {
    const { col, id } = req.body;
    if (!col || !id) {
      return res.status(400).json({ error: 'Missing col or id in body' });
    }
    try {
      const docRef = doc(db, String(col), String(id));
      await deleteDoc(docRef);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`[Server Proxy] Failed to delete doc ${col}/${id}:`, err);
      res.status(500).json({ error: err.message || 'Server database proxy error' });
    }
  });

  // 5. ADD DOCUMENT (AUTO GENERATE ID) PROXY
  app.post('/api/db/add', async (req, res) => {
    const { col, data } = req.body;
    if (!col || !data) {
      return res.status(400).json({ error: 'Missing col or data in body' });
    }
    try {
      const colRef = collection(db, String(col));
      const addedRef = await addDoc(colRef, data);
      res.json({ success: true, id: addedRef.id });
    } catch (err: any) {
      console.error(`[Server Proxy] Failed to add doc to col ${col}:`, err);
      res.status(500).json({ error: err.message || 'Server database proxy error' });
    }
  });

  // 6. QUERY COLLECTION PROXY (SUPPORT FILTER CONSTRAINTS)
  app.get('/api/db/list', async (req, res) => {
    const { col, constraints } = req.query;
    if (!col) {
      return res.status(400).json({ error: 'Missing col identifier' });
    }
    try {
      const colRef = collection(db, String(col));
      let q = query(colRef);
      
      if (constraints) {
        try {
          const parsed = JSON.parse(String(constraints));
          const actualParams: any[] = [];
          for (const c of parsed) {
            if (c.type === 'where') {
              actualParams.push(where(c.field, c.operator, c.value));
            }
          }
          if (actualParams.length > 0) {
            q = query(colRef, ...actualParams);
          }
        } catch (_) {
          console.warn("[Server Proxy] Failed to parse constraints JSON, returning default collection query list.");
        }
      }

      const querySnap = await getDocs(q);
      const docsList: any[] = [];
      querySnap.forEach((docSnap) => {
        docsList.push({
          id: docSnap.id,
          data: docSnap.data()
        });
      });
      res.json({ docs: docsList });
    } catch (err: any) {
      console.error(`[Server Proxy] Failed to list collection ${col}:`, err);
      res.status(500).json({ error: err.message || 'Server database proxy error' });
    }
  });

  // Passenger Order submission redirect (from older config files and direct Cloudflare support endpoint)
  app.post('/api/submit', async (req, res) => {
    try {
      const { driverPhone, passengerPhone, startLocation, destination } = req.body;
      if (!driverPhone || !passengerPhone || !startLocation) {
        return res.status(400).json({ success: false, error: '缺少必填参数' });
      }

      const colRef = doc(db, 'passenger_links', String(driverPhone));
      await setDoc(colRef, {
        passengerPhone: String(passengerPhone).trim(),
        startLocation: String(startLocation).trim(),
        destination: String(destination || '').trim(),
        status: "submitted",
        timestamp: Date.now()
      });

      res.json({ success: true, timestamp: Date.now() });
    } catch (err: any) {
      console.error('[Server Proxy] submit proxy error:', err);
      res.status(500).json({ success: false, error: err.message || 'Submit Proxy Error' });
    }
  });

  // Integration with Vite development server middleware OR static assets serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Static production build files loaded from:", distPath);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Dedicated Full-Stack proxy server boot successfully on port: http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("FATAL: Failed to boot Express Server:", err);
});
