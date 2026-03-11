import mongoose from "mongoose";

const machineSchema = new mongoose.Schema({
  machineId: {
    type: String,
    required: true,
  },
  machineName: {
    type: String,
    required: true,
  },
  version: {
    type: String,
    required: true,
  },
  file: {
    public_id: String,
    url: String,
    size: Number,
  }
}, { timestamps: true });

export default mongoose.model("Machine", machineSchema);