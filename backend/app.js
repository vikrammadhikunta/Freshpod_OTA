import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import cors from "cors";
import connectDB from "./db/connect.js";
import Machine from "./Modals/machine.model.js";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import dns from 'dns';

dns.setServers(["1.1.1.1","8.8.8.8"]);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors());
app.use(express.json());


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});


function incrementVersion(version) {
  if (!version) return "1.0.0";

  const parts = version.split(".").map(Number);
  parts[2] += 1;
  return parts.join(".");
}


app.post("/add", upload.single("file"), async (req, res) => {
  try {
    const { machineId, machineName } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Firmware file required" });
    }

    if (!req.file.originalname.endsWith(".bin")) {
      return res.status(400).json({ message: "Only .bin files allowed" });
    }

    const latest = await Machine.findOne({ machineId }).sort({ createdAt: -1 });
    const version = incrementVersion(latest?.version);

    const publicId = `freshpod/${machineId}/${version}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        overwrite: true,
      },
      async (error, result) => {
        if (error) {
          return res.status(500).json({ message: "Cloudinary upload failed" });
        }

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

        res.json({
          message: "Firmware uploaded",
          version,
          url: firmware.file.url,
        });
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


app.get("/:machineId", async (req, res) => {
  try {
    const { machineId } = req.params;

    const latest = await Machine.findOne({ machineId }).sort({ createdAt: -1 });

    if (!latest) {
      return res.status(404).json({ message: "Firmware not found" });
    }

    res.json({
      machineId,
      version: latest.version,
      url: latest.file.url,
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 OTA Server running on port ${PORT}`);
});