const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
    {
        title:          { type: String,     required: true },
        description:    { type: String,     required: true },
        startingBid:    { type: Number,     default:  0 },
        flatRate:       { type: Number,     default:  0 },
        category:       { type: String,     default:  "General" },
        client:         { type: String,     required: true },
        status:         { type: String,     enum:     ["OPEN", "CLOSED"], default: "OPEN" },
        photos:         [{ type: String }],  // filenames of uploaded photos (max 5)
        bids: [
            {
                contractor: String,
                amount:     Number,
                date:       { type: Date, default: Date.now },
            },
        ],
        acceptedContractor: { type: String, default: "" },
        finalPrice:         { type: Number, default: 0 },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Job", JobSchema);
