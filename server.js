//__________________________________________________________________________________________
//                                   REQUIRED MODULES
//__________________________________________________________________________________________
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");

// Models
const User = require("./models/User");
const Job = require("./models/Job");

const app = express();
const PORT = 3000;

//__________________________________________________________________________________________
//                                 MULTER CONFIGURATION
//__________________________________________________________________________________________
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});
const upload = multer({ storage: storage });

//__________________________________________________________________________________________
//                                 APP CONFIGURATION
//__________________________________________________________________________________________
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- LANDING PAGE ROUTES ---
// Defined here to ensure they are always accessible
app.get("/", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("register"));
app.get("/logout", (req, res) => res.redirect("/"));

//__________________________________________________________________________________________
//                               DATABASE & SERVER START
//__________________________________________________________________________________________
async function startServer() {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/handymanHelper");
        console.log("Connected to MongoDB: HandymanHelper DB");
    } catch (err) {
        console.error("Database connection error:", err);
    }

    // --- AUTH & POST ROUTES ---
    app.post("/register", async (req, res) => {
        const { username, password, role, invitecode } = req.body;
        if (invitecode !== "Note Vote 2026") return res.redirect("/register");

        try {
            const existingUser = await User.findOne({ username });
            if (existingUser) return res.redirect("/register");

            const newUser = new User({ username, password, role: role || "CLIENT" });
            await newUser.save();
            res.redirect(307, "/marketplace");
        } catch (err) {
            res.redirect("/register");
        }
    });

    app.post("/login", async (req, res) => {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
        if (user) res.redirect(307, "/marketplace");
        else res.redirect("/");
    });

    // --- MAIN MARKETPLACE ROUTE ---
    app.post("/marketplace", async (req, res) => {
        const { username, search, minPrice, maxPrice, viewMode } = req.body;

        const page = parseInt(req.query.page) || 1;
        const limit = 25;
        const skip = (page - 1) * limit;

        let query = {};

        // Mode Toggle: Show all or just user's bids
        if (viewMode === "MY_BIDS") {
            query["bids.contractor"] = username;
        }

        // Price Filtering
        if (minPrice && maxPrice) {
            query.budget = { $gte: Number(minPrice), $lte: Number(maxPrice) };
        }

        // Search Term Filtering
        if (search) {
            query.title = { $regex: search, $options: "i" };
        }

        try {
            const posts = await Job.find(query).sort({ _id: -1 }).skip(skip).limit(limit);
            const totalJobs = await Job.countDocuments(query);
            const totalPages = Math.ceil(totalJobs / limit) || 1;
            const currentUser = await User.findOne({ username });

            res.render("marketplace", {
                currentUser,
                posts,
                currentPage: page,
                totalPages: totalPages,
                searchQuery: search || "",
                viewMode: viewMode || "ALL",
                minPrice: minPrice || 0,
                maxPrice: maxPrice || 10000,
            });
        } catch (err) {
            console.error("Marketplace Error:", err);
            res.redirect("/");
        }
    });

    // --- JOB & BIDDING ROUTES ---
    app.post("/addpost", async (req, res) => {
        const { username, text, budget } = req.body;
        const newJob = new Job({
            title: text.substring(0, 25) + "...",
            description: text,
            budget: budget || 0,
            client: username,
        });
        await newJob.save();
        res.redirect(307, "/marketplace");
    });

    app.post("/job-details", async (req, res) => {
        const { username, postId } = req.body;
        try {
            const job = await Job.findById(postId);
            const currentUser = await User.findOne({ username });
            res.render("job-details", { job, currentUser });
        } catch (err) {
            res.redirect(307, "/marketplace");
        }
    });

    app.post("/place-bid", async (req, res) => {
        const { username, postId, bidAmount } = req.body;
        const user = await User.findOne({ username });

        if (!user.isVerified) return res.status(403).send("You must be verified to place bids.");

        const job = await Job.findById(postId);
        if (job.status === "OPEN") {
            job.bids.push({ contractor: username, amount: bidAmount });
            await job.save();
        }
        res.redirect(307, "/job-details");
    });

    app.post("/accept-bid", async (req, res) => {
        const { postId } = req.body;
        await Job.findByIdAndUpdate(postId, { status: "CLOSED" });
        res.redirect(307, "/job-details");
    });

    // --- VERIFICATION ROUTES ---
    app.post("/verify-page", async (req, res) => {
        const { username } = req.body;
        const currentUser = await User.findOne({ username });
        res.render("verification", { currentUser });
    });

    app.post("/verify", upload.single("licenseImage"), async (req, res) => {
        const { username, licenseNumber } = req.body;
        const updateData = {
            licenseNumber: licenseNumber,
            idPhotoPath: req.file ? req.file.filename : "",
        };
        await User.findOneAndUpdate({ username }, updateData);
        res.redirect(307, "/marketplace");
    });

    app.listen(PORT, () => console.log(`HandymanHelper running at http://localhost:${PORT}`));
}

startServer();
