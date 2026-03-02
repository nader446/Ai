import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// إعداد قاعدة البيانات لحفظ سجل التشخيصات
const db = new Database("mechanic_universe.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    input_text TEXT,
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();

  // إعداد المنفذ ليتوافق مع ريبليت بشكل ديناميكي
  const PORT = process.env.PORT || 3000;

  // زيادة حدود الرفع للصور عالية الدقة
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // --- مسارات الـ API ---

  // حفظ تشخيص جديد
  app.post("/api/history", (req, res) => {
    try {
      const { type, input_text, result } = req.body;
      const stmt = db.prepare("INSERT INTO history (type, input_text, result) VALUES (?, ?, ?)");
      const info = stmt.run(type, input_text || "", result);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      console.error("Save History Error:", error);
      res.status(500).json({ error: "فشل حفظ السجل" });
    }
  });

  // جلب السجل
  app.get("/api/history", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM history ORDER BY created_at DESC").all();
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "فشل استرجاع السجل" });
    }
  });

  // حذف من السجل
  app.delete("/api/history/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM history WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف السجل" });
    }
  });

  // --- إعداد Vite (المسؤول عن الواجهة) ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        // حل مشكلة Upgrade Required في ريبليت
        hmr: {
          clientPort: 443
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // تشغيل السيرفر على العنوان 0.0.0.0 ليكون متاحاً لريبليت
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});