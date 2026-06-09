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
  origin: ["https://frontend-yzhf.onrender.com", "http://localhost:5173", "http://localhost:3000"]
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
    "49": 0,
    "59": 1,
    "69": 2,
    "79": 3,
    "89": 4,
    "99": 5,
    "109": 6
  };
  
  const qrValue = amountMap[amount];
  
  if (qrValue === undefined) {
    throw new Error("Invalid amount selected. Allowed values: 49, 59, 69, 79, 89, 99, 109");
  }
  
  return qrValue;
}

/* ================= GET QR VALUE FOR A MACHINE ================= */
app.get("/api/machine/:machineId/qr-value", async (req, res) => {
  try {
    const { machineId } = req.params;
    
    console.log(`🔍 Fetching QR value for machine: ${machineId}`);
    
    if (!machineId || machineId.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Machine ID is required"
      });
    }
    
    // Find the latest firmware entry for this machine
    const latestFirmware = await Machine
      .findOne({ machineId })
      .sort({ createdAt: -1 });
    
    if (!latestFirmware) {
      return res.status(404).json({
        success: false,
        exists: false,
        message: "Machine not found. Please upload firmware first.",
        machineId: machineId,
        qrValue: null
      });
    }
    
    // Get the QR value (convert to string for frontend compatibility)
    const qrValue = latestFirmware.qrvalue !== undefined && latestFirmware.qrvalue !== null 
      ? latestFirmware.qrvalue.toString() 
      : "0";
    
    console.log(`✅ QR value for ${machineId}: ${qrValue}`);
    
    return res.json({
      success: true,
      exists: true,
      machineId: machineId,
      machineName: latestFirmware.machineName,
      qrValue: qrValue,
      qrValueNumber: parseInt(qrValue),
      currentVersion: latestFirmware.version,
      lastUpdated: latestFirmware.createdAt
    });
    
  } catch (err) {
    console.error("❌ Get QR value error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching QR value",
      error: err.message
    });
  }
});

/* ================= CHECK IF MACHINE EXISTS AND GET QR ================= */
app.get("/api/machine/:machineId", async (req, res) => {
  try {
    const { machineId } = req.params;
    
    console.log(`🔍 Checking if machine exists: ${machineId}`);
    
    // Find any document with this machineId (even older versions)
    const machine = await Machine.findOne({ machineId }).sort({ createdAt: -1 });
    
    if (!machine) {
      return res.status(404).json({
        exists: false,
        message: "Machine not found"
      });
    }
    
    // Get the latest QR value for this machine
    const latestFirmware = await Machine.findOne({ machineId }).sort({ createdAt: -1 });
    
    return res.json({
      exists: true,
      machineId: machine.machineId,
      machineName: machine.machineName,
      qrValue: latestFirmware?.qrvalue !== undefined ? latestFirmware.qrvalue.toString() : "0",
      currentVersion: latestFirmware?.version || "1.0.0"
    });
    
  } catch (err) {
    console.error("❌ Check machine error:", err);
    return res.status(500).json({
      message: "Server error",
      exists: false
    });
  }
});

/* ================= UPDATE ONLY QR VALUE ================= */
app.put("/api/machine/:machineId/qr", async (req, res) => {
  try {
    const { machineId } = req.params;
    const { qrValue } = req.body;
    
    console.log(`🔄 Updating QR value for machine: ${machineId}`);
    console.log(`New QR Value: ${qrValue}`);
    
    if (qrValue === undefined || qrValue === null) {
      return res.status(400).json({
        message: "QR value is required"
      });
    }
    
    // Validate QR value is a number between 0-6
    const qrValueNum = parseInt(qrValue);
    if (isNaN(qrValueNum) || ![0, 1, 2, 3, 4, 5, 6].includes(qrValueNum)) {
      return res.status(400).json({
        message: "Invalid QR value. Allowed values: 0, 1, 2, 3, 4, 5, 6"
      });
    }
    
    // Check if machine exists
    const existingMachine = await Machine.findOne({ machineId });
    
    if (!existingMachine) {
      return res.status(404).json({
        message: "Machine not found. Please upload firmware first."
      });
    }
    
    // Update ALL documents with this machineId to have the new qrvalue
    // Or create a new entry? For QR-only update, we'll update the latest entry
    const updatedMachine = await Machine.findOneAndUpdate(
      { machineId },
      { qrvalue: qrValueNum },
      { sort: { createdAt: -1 }, new: true }
    );
    
    // Also update all previous versions if needed (optional)
    // Uncomment the following if you want all versions to have same QR value
    /*
    await Machine.updateMany(
      { machineId },
      { qrvalue: qrValueNum }
    );
    */
    
    console.log(`✅ QR value updated to ${qrValueNum} for machine ${machineId}`);
    
    return res.json({
      success: true,
      message: "QR value updated successfully",
      machineId: machineId,
      newQrValue: qrValueNum,
      updatedAt: new Date()
    });
    
  } catch (err) {
    console.error("❌ QR update error:", err);
    return res.status(500).json({
      message: "Server error while updating QR value"
    });
  }
});

/* ================= UPDATE MACHINE INFO WITHOUT FIRMWARE ================= */
app.put("/api/machine/:machineId/info", async (req, res) => {
  try {
    const { machineId } = req.params;
    const { machineName, amount } = req.body;
    
    console.log(`📝 Updating machine info for: ${machineId}`);
    
    if (!machineName && !amount) {
      return res.status(400).json({
        message: "At least one field (machineName or amount) is required for update"
      });
    }
    
    // Check if machine exists
    const existingMachine = await Machine.findOne({ machineId });
    
    if (!existingMachine) {
      return res.status(404).json({
        message: "Machine not found. Please upload firmware first."
      });
    }
    
    const updateData = {};
    if (machineName) updateData.machineName = machineName;
    if (amount) {
      try {
        const qrValue = getQrValueFromAmount(amount);
        updateData.qrvalue = qrValue;
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }
    
    // Update the latest machine entry
    const updatedMachine = await Machine.findOneAndUpdate(
      { machineId },
      updateData,
      { sort: { createdAt: -1 }, new: true }
    );
    
    console.log(`✅ Machine info updated for ${machineId}`);
    
    return res.json({
      success: true,
      message: "Machine information updated successfully",
      machineId: machineId,
      updates: updateData
    });
    
  } catch (err) {
    console.error("❌ Machine info update error:", err);
    return res.status(500).json({
      message: "Server error while updating machine info"
    });
  }
});

/* ================= UPLOAD FIRMWARE (WITH OPTIONAL FILE) ================= */
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
    
    // Map amount to qrvalue
    let qrvalue;
    try {
      qrvalue = getQrValueFromAmount(amount);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
    
    // Check if machine already exists
    const existingMachine = await Machine.findOne({ machineId });
    
    // If file is NOT provided, only update machine info and QR value
    if (!req.file) {
      console.log("📝 No file provided - updating only machine info and QR");
      
      if (!existingMachine) {
        return res.status(404).json({ 
          message: "Machine not found. Please upload firmware file for new machines."
        });
      }
      
      // Update existing machine's info and QR
      const updatedMachine = await Machine.findOneAndUpdate(
        { machineId },
        { 
          machineName: machineName,
          qrvalue: qrvalue
        },
        { sort: { createdAt: -1 }, new: true }
      );
      
      console.log(`✅ Machine ${machineId} info updated (no firmware change)`);
      
      return res.json({
        message: "Machine information updated successfully",
        machineId,
        machineName,
        amount,
        qrvalue,
        updated: true,
        noFirmwareChange: true
      });
    }
    
    // If file IS provided, process firmware upload
    if (!req.file.originalname.endsWith(".bin")) {
      return res.status(400).json({ message: "Only .bin files allowed" });
    }
    
    console.log("Machine:", machineId);
    console.log("Machine Name:", machineName);
    console.log("Amount:", amount);
    console.log("QR Value:", qrvalue);
    console.log("File:", req.file.originalname);
    
    // Find latest version
    const latest = await Machine
      .findOne({ machineId })
      .sort({ createdAt: -1 });
    
    const version = latest
      ? incrementVersion(latest.version)
      : "1.0.0";
    
    console.log("New firmware version:", version);
    
    const publicId = `freshpod/${machineId}/${version}`;
    
    // Cloudinary upload
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
    
    // Save to database
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
      message: "Firmware uploaded successfully",
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
    
    if (isNaN(qrValueNum) || ![0, 1, 2, 3, 4, 5, 6].includes(qrValueNum)) {
      return res.status(400).json({
        message: "Invalid qrvalue. Allowed values: 0, 1, 2, 3, 4, 5, 6",
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