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
  origin: ["https://frontend-yzhf.onrender.com"]
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

function incrementVersion(version) {
  const parts = version.split(".").map(Number);
  parts[2] += 1;
  return parts.join(".");
}

/* ================= AMOUNT TO QRVALUE MAPPER ================= */

function getQrValueFromAmount(amount) {
  const amountMap = {
    "1": 0,
    "59": 1,
    "99": 2
  };
  
  const qrValue = amountMap[amount];
  
  if (qrValue === undefined) {
    throw new Error("Invalid amount selected. Allowed values: 1, 59, 99");
  }
  
  return qrValue;
}

/* ================= UPLOAD FIRMWARE ================= */

app.post("/add", upload.single("file"), async (req, res) => {

  try {

    console.log("📥 Upload request received");

    const { machineId, machineName, amount } = req.body;

    if (!machineId || !machineName) {
      return res.status(400).json({ message: "Machine info missing" });
    }

    if (!amount) {
      return res.status(400).json({ message: "Amount is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Firmware file required" });
    }

    if (!req.file.originalname.endsWith(".bin")) {
      return res.status(400).json({ message: "Only .bin files allowed" });
    }

    // Map amount to qrvalue
    let qrvalue;
    try {
      qrvalue = getQrValueFromAmount(amount);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    console.log("Machine:", machineId);
    console.log("Machine Name:", machineName);
    console.log("Amount:", amount);
    console.log("QR Value:", qrvalue);
    console.log("File:", req.file.originalname);

    /* ---------- FIND LATEST VERSION ---------- */

    const latest = await Machine
      .findOne({ machineId })
      .sort({ createdAt: -1 });

    const version = latest
      ? incrementVersion(latest.version)
      : "1.0.0";

    console.log("New firmware version:", version);

    const publicId = `freshpod/${machineId}/${version}`;

    /* ---------- CLOUDINARY UPLOAD ---------- */

    const uploadResult = await new Promise((resolve, reject) => {

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          public_id: publicId,
          overwrite: true,
        },
        (error, result) => {

          if (error) {
            return reject(error);
          }

          resolve(result);

        }
      );

      streamifier
        .createReadStream(req.file.buffer)
        .pipe(uploadStream);

    });

    console.log("☁️ Uploaded to Cloudinary:", uploadResult.secure_url);

    /* ---------- SAVE TO DATABASE ---------- */

    const firmware = await Machine.create({
      machineId,
      machineName,
      version,
      qrvalue,
      file: {
        public_id: uploadResult.public_id,
        url: uploadResult.secure_url,
        size: uploadResult.bytes,
      },
    });

    console.log("💾 Firmware saved:", firmware._id);
    console.log("📊 QR Value stored:", firmware.qrvalue);

    return res.json({
      message: "Firmware uploaded",
      machineId,
      machineName,
      version,
      amount,
      qrvalue,
      url: firmware.file.url,
    });

  } catch (err) {

    console.error("❌ Upload error:", err);

    return res.status(500).json({
      message: err.message,
    });

  }

});

/* ================= GET LATEST FIRMWARE ================= */

app.get("/firmware/:machineId", async (req, res) => {

  try {

    const { machineId } = req.params;

    console.log(`🔍 Checking firmware for machine: ${machineId}`);

    const latest = await Machine
      .findOne({ machineId })
      .sort({ createdAt: -1 });

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
      qrvalue: latest.qrvalue,
    });

  } catch (err) {

    console.error("❌ GET error:", err);

    return res.status(500).json({
      message: "Server error",
    });

  }

});

/* ================= GET FIRMWARE WITH QR FILTER ================= */

app.get("/firmware/:machineId/:qrvalue", async (req, res) => {

  try {

    const { machineId, qrvalue } = req.params;

    console.log(`🔍 Checking firmware for machine: ${machineId} with qrvalue: ${qrvalue}`);

    const qrValueNum = parseInt(qrvalue);

    if (isNaN(qrValueNum) || ![0, 1, 2].includes(qrValueNum)) {
      return res.status(400).json({
        message: "Invalid qrvalue. Allowed values: 0, 1, 2",
      });
    }

    const firmware = await Machine
      .findOne({ 
        machineId, 
        qrvalue: qrValueNum 
      })
      .sort({ createdAt: -1 });

    if (!firmware) {
      return res.status(404).json({
        message: `Firmware not found for machine ${machineId} with qrvalue ${qrvalue}`,
      });
    }

    res.setHeader("Cache-Control", "no-store");

    return res.json({
      machineId,
      version: firmware.version,
      url: firmware.file.url,
      qrvalue: firmware.qrvalue,
    });

  } catch (err) {

    console.error("❌ GET error:", err);

    return res.status(500).json({
      message: "Server error",
    });

  }

});

/* ================= GET ALL FIRMWARE VERSIONS FOR A MACHINE ================= */

app.get("/firmware/:machineId/all", async (req, res) => {

  try {

    const { machineId } = req.params;

    console.log(`🔍 Getting all firmware for machine: ${machineId}`);

    const allFirmware = await Machine
      .find({ machineId })
      .sort({ createdAt: -1 });

    if (!allFirmware.length) {
      return res.status(404).json({
        message: "No firmware found for this machine",
      });
    }

    return res.json({
      machineId,
      count: allFirmware.length,
      firmware: allFirmware.map(fw => ({
        version: fw.version,
        qrvalue: fw.qrvalue,
        uploadedAt: fw.createdAt,
        url: fw.file.url,
      })),
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