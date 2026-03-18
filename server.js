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

const fs = require("fs");

const folders = ["./public/uploads", "./public/images"];
folders.forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

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
        const { username, search, sort, category, viewMode } = req.body;
        const page = parseInt(req.query.page) || 1;
        const limit = 25;
        const skip = (page - 1) * limit;

        let query = {};

        // 1. Category Filtering Logic
        if (category && category !== "General") {
            query.category = category;
        }

        // 2. Search Logic (Improved to search both Title and Description)
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
            ];
        }

        // 3. View Mode Logic
        if (viewMode === "MY_POSTS") {
            query.client = username;
        }

        // 4. Sorting Logic
        let sortOptions = { _id: -1 };
        if (sort === "desc") sortOptions = { budget: -1 };
        if (sort === "asc") sortOptions = { budget: 1 };

        try {
            const jobs = await Job.find(query).sort(sortOptions).skip(skip).limit(limit);
            const totalAds = await Job.countDocuments(query);
            const currentUser = await User.findOne({ username });

            res.render("marketplace", {
                currentUser,
                jobs,
                totalAds,
                currentPage: page,
                totalPages: Math.ceil(totalAds / limit) || 1,
                searchQuery: search || "",
                viewMode: viewMode || "ALL",
                selectedCategory: category || "General",
            });
        } catch (err) {
            console.error("Filter Error:", err);
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

            // Check if job exists to prevent the 'null' error
            if (!job) {
                console.log("Job not found for ID:", postId);
                return res.redirect(307, "/marketplace");
            }

            res.render("job-details", { job, currentUser });
        } catch (err) {
            console.error("Error fetching job details:", err);
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
        const { postId, contractor, amount } = req.body; // Pull data from your accept form
        try {
            await Job.findByIdAndUpdate(postId, {
                status: "CLOSED",
                acceptedContractor: contractor,
                finalPrice: amount,
            });
            res.redirect(307, "/job-details");
        } catch (err) {
            res.status(500).send("Error accepting bid.");
        }
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
            isVerified: true, // Auto-verify upon upload for the lab
        };
        try {
            await User.findOneAndUpdate({ username }, updateData);
            // Using 307 here ensures the username is passed back to the marketplace
            res.redirect(307, "/marketplace");
        } catch (err) {
            console.error(err);
            res.status(500).send("Verification failed.");
        }
    });

    app.post("/delete-post", async (req, res) => {
        const { username, postId } = req.body;
        try {
            // Only allow the person who created the post to delete it
            await Job.findOneAndDelete({ _id: postId, client: username });
            res.redirect(307, "/marketplace");
        } catch (err) {
            res.status(500).send("Error deleting post.");
        }
    });

    app.listen(PORT, () => console.log(`HandymanHelper running at http://localhost:${PORT}`));
}

startServer();
