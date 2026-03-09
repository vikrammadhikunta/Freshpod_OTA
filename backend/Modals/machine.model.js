import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    public_id: { type: String },
    url: { type: String },
    format: { type: String },
    size: { type: Number },
  },
  { _id: false } // important for nested object
);

const machineSchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true,
      unique: true,
    },
    machineName: {
      type: String,
      required: true,
    },
    version: {
      type: String,
      required: true,
      match: /^\d+\.\d+\.\d+$/,
    },
    file: fileSchema, // proper nested schema
  },
  { timestamps: true }
);

export default mongoose.model("Machine", machineSchema);