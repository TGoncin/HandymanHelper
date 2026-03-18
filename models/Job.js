const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        budget: { type: Number, default: 0 },
        client: { type: String, required: true },
        status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN" },
        bids: [
            {
                contractor: String,
                amount: Number,
                date: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
); // This automatically adds createdAt and updatedAt

module.exports = mongoose.model("Job", JobSchema);
