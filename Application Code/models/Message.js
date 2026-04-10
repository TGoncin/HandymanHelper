const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
    {
        from:       { type: String, required: true },
        to:         { type: String, required: true },
        subject:    { type: String, required: true },
        body:       { type: String, required: true },
        jobId:      { type: mongoose.Schema.Types.ObjectId, ref: "Job", default: null },
        read:       { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Message", MessageSchema);
