import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    public_id: String,
    url: String,
    format: String,
    size: Number,
  },
  { _id: false }
);

const machineSchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true
    },
    machineName: {
      type: String,
      required: true
    },
    version: {
      type: String,
      required: true,
      match: /^\d+\.\d+\.\d+$/
    },
    file: fileSchema
  },
  { timestamps: true }
);

/* unique firmware per version */
machineSchema.index({ machineId: 1, version: 1 }, { unique: true });

export default mongoose.model("Machine", machineSchema);