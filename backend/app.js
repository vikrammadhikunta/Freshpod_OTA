import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import cors from "cors";
import connectDB from "./db/connect.js";
import Machine from "./Modals/machine.model.js";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import dns from "dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

console.log("🚀 Starting OTA Server...");

/* ================= DATABASE ================= */

connectDB();

/* ================= MIDDLEWARE ================= */
app.use(cors({
  origin: "https://frontend-yzhf.onrender.com"
}));

app.use(express.json());

/* ================= HEALTH ROUTE ================= */

app.get("/", (req, res) => {
  res.send("🚀 OTA Firmware Server Running");
});

/* ================= CLOUDINARY CONFIG ================= */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("☁️ Cloudinary configured");

/* ================= MULTER ================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

console.log("📦 Multer ready");

/* ================= VERSION HELPER ================= */

function incrementVersion(version = "1.0.0") {
  const parts = version.split(".").map(Number);
  parts[2] += 1;
  return parts.join(".");
}

/* ================= UPLOAD FIRMWARE ================= */

app.post("/add", upload.single("file"), async (req, res) => {
  try {

    console.log("📥 Upload request received");

    const { machineId, machineName } = req.body;

    if (!machineId || !machineName) {
      return res.status(400).json({ message: "Machine info missing" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Firmware file required" });
    }

    if (!req.file.originalname.endsWith(".bin")) {
      return res.status(400).json({ message: "Only .bin files allowed" });
    }

    /* ---------- GET LATEST VERSION ---------- */

    const latest = await Machine.findOne({ machineId }).sort({ createdAt: -1 });

    const version = incrementVersion(latest?.version);

    const publicId = `freshpod/${machineId}/${version}`;

    /* ---------- CLOUDINARY UPLOAD (PROMISE WRAPPER) ---------- */

    const uploadToCloudinary = () =>
      new Promise((resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "raw",
            public_id: publicId,
            overwrite: true,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);

      });

    const result = await uploadToCloudinary();

    console.log("☁️ Uploaded:", result.secure_url);

    /* ---------- SAVE TO DATABASE ---------- */

    const firmware = await Machine.create({
      machineId,
      machineName,
      version,
      file: {
        public_id: result.public_id,
        url: result.secure_url,
        size: result.bytes,
      },
    });

    console.log("💾 Firmware saved:", firmware._id);

    return res.json({
      message: "Firmware uploaded",
      machineId,
      version,
      url: firmware.file.url,
    });

  } catch (err) {

    console.error("❌ Upload error:", err);

    return res.status(500).json({
      message: "Server error",
    });

  }
});

/* ================= GET LATEST FIRMWARE ================= */

app.get("/:machineId", async (req, res) => {

  try {

    const { machineId } = req.params;

    console.log(`🔍 Checking firmware for machine: ${machineId}`);

    const latest = await Machine.findOne({ machineId }).sort({ createdAt: -1 });

    if (!latest) {
      return res.status(404).json({
        message: "Firmware not found",
      });
    }

    res.setHeader("Cache-Control", "no-store");

    return res.json({
      machineId,
      version: latest.version,
      url: latest.file.url,
    });

  } catch (err) {

    console.error("❌ GET error:", err);

    return res.status(500).json({
      message: "Server error",
    });

  }

});

/* ================= SERVER START ================= */

app.listen(PORT, () => {
  console.log(`🚀 OTA Server running on port ${PORT}`);
});