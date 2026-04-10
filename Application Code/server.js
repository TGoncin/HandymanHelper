//__________________________________________________________________________________________
//                                   REQUIRED MODULES
//__________________________________________________________________________________________
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

// Models
const User = require("./models/User");
const Job = require("./models/Job");
const Message = require("./models/Message");

const app = express();
const PORT = 3001;

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
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- LANDING PAGE ROUTES ---
app.get("/", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("register"));
app.get("/logout", (req, res) => res.redirect("/"));
app.get("/debug", (req, res) => res.send("THIS IS THE UPDATED SERVER"));

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


    // _____ REGISTER _____
    app.post("/register", async (req, res) => {
        const { username, password, role, invitecode, firstName } = req.body;
        if (invitecode !== "Note Vote 2026") return res.redirect("/register");

        try {
            const existingUser = await User.findOne({ username });
            if (existingUser) return res.redirect("/register");

            const cleanName = firstName ? firstName.trim().charAt(0).toUpperCase() + firstName.trim().slice(1).toLowerCase() : "";

            const newUser = new User({ username, password, firstName: cleanName, role: role || "CLIENT" });
            await newUser.save();
            res.redirect("/marketplace?username=" + encodeURIComponent(username));
        } catch (err) {
            res.redirect("/register");
        }
    });


    // _____ LOGIN _____
    app.post("/login", async (req, res) => {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
        if (user) res.redirect("/marketplace?username=" + encodeURIComponent(username));
        else res.redirect("/");
    });


    // _____ MARKETPLACE (shared logic for GET and POST) _____
    async function renderMarketplace(req, res) {
        // Get username from body (POST) or query (GET)
        const username = (req.body && req.body.username) || req.query.username;
        if (!username) return res.redirect("/");

        const search = (req.body && req.body.search) || req.query.search || "";
        const sort = (req.body && req.body.sort) || req.query.sort || "";
        const category = (req.body && req.body.category) || req.query.category || "";
        const viewMode = (req.body && req.body.viewMode) || req.query.viewMode || "ALL";
        const minPrice = (req.body && req.body.minPrice) || req.query.minPrice || "";
        const maxPrice = (req.body && req.body.maxPrice) || req.query.maxPrice || "";
        const biddingFilter = (req.body && req.body.biddingFilter) || req.query.biddingFilter || "";
        const minBids = (req.body && req.body.minBids) || req.query.minBids || "";
        const maxBids = (req.body && req.body.maxBids) || req.query.maxBids || "";
        const page = parseInt((req.body && req.body.page) || req.query.page) || 1;
        const limit = 25;
        const skip = (page - 1) * limit;

        let query = {};

        // Category filter
        if (category && category !== "All" && category !== "") {
            query.category = category;
        }

        // Search filter
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
            ];
        }

        // View mode
        if (viewMode === "MY_POSTS") {
            query.client = username;
        }

        // Bidding filter
        if (biddingFilter === "BIDS_ONLY") {
            query["bids.0"] = { $exists: true };

            // Bid count range
            if (minBids || maxBids) {
                const minB = Number(minBids) || 0;
                const maxB = Number(maxBids) || 999999;
                query.$expr = query.$expr || { $and: [] };
                if (minB > 0) {
                    query.$expr.$and.push({ $gte: [{ $size: "$bids" }, minB] });
                }
                if (maxBids) {
                    query.$expr.$and.push({ $lte: [{ $size: "$bids" }, maxB] });
                }
                if (query.$expr.$and.length === 0) delete query.$expr;
            }
        }

        // Price range filter (check both startingBid and flatRate)
        if (minPrice || maxPrice) {
            const priceConditions = [];
            const min = Number(minPrice) || 0;
            const max = Number(maxPrice) || 999999;

            priceConditions.push({
                startingBid: { $gte: min, $lte: max }
            });
            priceConditions.push({
                flatRate: { $gte: min, $lte: max }
            });

            if (query.$or) {
                // Search is already using $or, combine with $and
                query.$and = [{ $or: query.$or }, { $or: priceConditions }];
                delete query.$or;
            } else {
                query.$or = priceConditions;
            }
        }

        // Sort
        let sortOptions = { createdAt: -1 };
        if (sort === "desc") sortOptions = { startingBid: -1 };
        if (sort === "asc") sortOptions = { startingBid: 1 };
        if (sort === "ending_soon") sortOptions = { createdAt: 1 };

        try {
            const jobs = await Job.find(query).sort(sortOptions).skip(skip).limit(limit);
            const totalAds = await Job.countDocuments(query);
            const currentUser = await User.findOne({ username });

            if (!currentUser) return res.redirect("/");

            res.render("marketplace", {
                currentUser,
                jobs,
                totalAds,
                currentPage: page,
                totalPages: Math.ceil(totalAds / limit) || 1,
                searchQuery: search || "",
                viewMode: viewMode || "ALL",
                selectedCategory: category || "",
            });
        } catch (err) {
            console.error("Marketplace Error:", err);
            res.redirect("/");
        }
    }

    app.get("/marketplace", renderMarketplace);
    app.post("/marketplace", renderMarketplace);


    // _____ ADD POST (clients AND contractors, must be verified) _____
    app.post("/addpost", upload.array("photos", 5), async (req, res) => {
        // Safety: if username comes as array (from nested forms), grab first value
        const username = Array.isArray(req.body.username) ? req.body.username[0] : req.body.username;
        const { title, description, startingBid, flatRate, category } = req.body;

        try {
            const user = await User.findOne({ username });

            if (!user) return res.status(404).send("User not found.");
            if (!user.isVerified) return res.status(403).send("You must be verified to post jobs.");
            if (!title || !description) return res.status(400).send("Title and description are required.");

            const photos = req.files ? req.files.map((f) => f.filename) : [];

            const newJob = new Job({
                title: title.trim(),
                description: description.trim(),
                startingBid: Number(startingBid) || 0,
                flatRate: Number(flatRate) || 0,
                category: category || "General",
                client: username,
                photos: photos,
            });
            await newJob.save();

            res.redirect("/marketplace?username=" + encodeURIComponent(username));
        } catch (err) {
            console.error("Add Post Error:", err);
            res.status(500).send("Error creating job post.");
        }
    });


    // _____ DASHBOARD _____
    app.get("/dashboard", async (req, res) => {
        try {
            const username = req.query.username;
            if (!username) return res.redirect("/");

            const currentUser = await User.findOne({ username });
            if (!currentUser) return res.redirect("/");

            const myPosts = await Job.find({ client: username }).sort({ createdAt: -1 });
            const jobsIBidOn = await Job.find({ "bids.contractor": username, status: "OPEN" }).sort({ createdAt: -1 });

            const numberOfPostsCreated = myPosts.length;
            const numberOfBidsPlaced = jobsIBidOn.reduce((total, job) => {
                return total + job.bids.filter((bid) => bid.contractor === username).length;
            }, 0);

            // Fetch messages for this user
            const messages = await Message.find({ $or: [{ to: username }, { from: username }] }).sort({ createdAt: -1 });

            res.render("dashboard", {
                currentUser,
                myPosts,
                jobsIBidOn,
                numberOfPostsCreated,
                numberOfBidsPlaced,
                messages,
            });
        } catch (err) {
            console.error("Dashboard Error:", err);
            res.status(500).send("Error loading dashboard.");
        }
    });


    // _____ JOB DETAILS (POST from marketplace "View Details") _____
    app.post("/job-details", async (req, res) => {
        const { username, postId } = req.body;
        try {
            const job = await Job.findById(postId);
            const currentUser = await User.findOne({ username });

            if (!job || !currentUser) return res.redirect("/marketplace?username=" + encodeURIComponent(username));

            // Look up bidder first names
            const bidderEmails = job.bids.map((b) => b.contractor);
            const bidderUsers = await User.find({ username: { $in: bidderEmails } });
            const bidderNames = {};
            bidderUsers.forEach((u) => { bidderNames[u.username] = u.firstName || u.username; });

            // Look up poster first name
            const posterUser = await User.findOne({ username: job.client });
            const posterName = posterUser ? (posterUser.firstName || posterUser.username) : job.client;

            res.render("job-details", { job, currentUser, bidderNames, posterName });
        } catch (err) {
            console.error("Error fetching job details:", err);
            res.redirect("/marketplace?username=" + encodeURIComponent(username || ""));
        }
    });

    // GET version for clickable links from dashboard
    app.get("/job-details/:id", async (req, res) => {
        const username = req.query.username;
        if (!username) return res.redirect("/");
        try {
            const job = await Job.findById(req.params.id);
            const currentUser = await User.findOne({ username });
            if (!job || !currentUser) return res.redirect("/");

            const bidderEmails = job.bids.map((b) => b.contractor);
            const bidderUsers = await User.find({ username: { $in: bidderEmails } });
            const bidderNames = {};
            bidderUsers.forEach((u) => { bidderNames[u.username] = u.firstName || u.username; });

            const posterUser = await User.findOne({ username: job.client });
            const posterName = posterUser ? (posterUser.firstName || posterUser.username) : job.client;

            res.render("job-details", { job, currentUser, bidderNames, posterName });
        } catch (err) {
            res.redirect("/");
        }
    });


    // _____ PLACE BID _____
    app.post("/place-bid", async (req, res) => {
        const { username, postId, bidAmount } = req.body;

        try {
            const user = await User.findOne({ username });
            const job = await Job.findById(postId);

            if (!user || !job) return res.status(404).send("User or job not found.");
            if (!user.isVerified) return res.status(403).send("You must be verified to place bids.");
            if (job.status !== "OPEN") return res.status(400).send("Job is closed.");
            if (job.client === username) return res.status(403).send("You cannot bid on your own job.");

            const amount = Number(bidAmount);
            if (!amount || amount <= 0) return res.status(400).send("Invalid bid amount.");

            job.bids.push({ contractor: username, amount });
            await job.save();

            const bidderEmails = job.bids.map((b) => b.contractor);
            const bidderUsers = await User.find({ username: { $in: bidderEmails } });
            const bidderNames = {};
            bidderUsers.forEach((u) => { bidderNames[u.username] = u.firstName || u.username; });

            const posterUser = await User.findOne({ username: job.client });
            const posterName = posterUser ? (posterUser.firstName || posterUser.username) : job.client;

            res.render("job-details", { job, currentUser: user, bidderNames, posterName });
        } catch (err) {
            console.error("Place Bid Error:", err);
            return res.status(500).send("Error placing bid.");
        }
    });


    // _____ ACCEPT BID _____
    app.post("/accept-bid", async (req, res) => {
        const { username, postId, contractor, amount } = req.body;
        try {
            const user = await User.findOne({ username });
            const job = await Job.findById(postId);

            if (!user) return res.status(404).send("User not found.");
            if (!job) return res.status(404).send("Job not found.");
            if (job.client !== user.username) return res.status(403).send("You can only accept bids on your own jobs.");
            if (job.status !== "OPEN") return res.status(400).send("Job is already closed.");

            const matchedBid = job.bids.find((bid) => bid.contractor === contractor && Number(bid.amount) === Number(amount));
            if (!matchedBid) return res.status(400).send("Bid not found.");

            job.status = "CLOSED";
            job.acceptedContractor = contractor;
            job.finalPrice = Number(amount);
            await job.save();

            // Re-render job details after accepting
            const bidderEmails = job.bids.map((b) => b.contractor);
            const bidderUsers = await User.find({ username: { $in: bidderEmails } });
            const bidderNames = {};
            bidderUsers.forEach((u) => { bidderNames[u.username] = u.firstName || u.username; });

            const posterUser = await User.findOne({ username: job.client });
            const posterName = posterUser ? (posterUser.firstName || posterUser.username) : job.client;

            res.render("job-details", { job, currentUser: user, bidderNames, posterName });
        } catch (err) {
            console.error("Accept Bid Error:", err);
            res.status(500).send("Error accepting bid.");
        }
    });


    // _____ VERIFICATION PAGE _____
    app.get("/verify-page", async (req, res) => {
        const username = req.query.username;
        if (!username) return res.redirect("/");

        try {
            const currentUser = await User.findOne({ username });
            if (!currentUser) return res.redirect("/");

            res.render("verification", { currentUser, error: req.query.error || null });
        } catch (err) {
            console.error("Verify Page Error:", err);
            res.status(500).send("Error loading verification page.");
        }
    });


    // _____ SUBMIT VERIFICATION _____
    app.post("/verify", upload.single("licenseImage"), async (req, res) => {
        const { username, firstName, licenseNumber, verificationCode } = req.body;

        try {
            const user = await User.findOne({ username });

            if (!user) return res.redirect("/verify-page?username=" + username + "&error=User not found.");

            if (!firstName || !firstName.trim()) {
                return res.redirect("/verify-page?username=" + username + "&error=First name is required.");
            }

            const validCode = verificationCode === "1234";
            const uploadedFile = !!req.file;

            if (!validCode && !uploadedFile) {
                const msg = verificationCode ? "Incorrect invite code. Please try again." : "Please upload a license photo or enter a valid invite code.";
                return res.redirect("/verify-page?username=" + username + "&error=" + encodeURIComponent(msg));
            }

            const cleanName = firstName.trim().charAt(0).toUpperCase() + firstName.trim().slice(1).toLowerCase();
            user.firstName = cleanName;
            user.licenseNumber = licenseNumber || user.licenseNumber || "";
            if (req.file) user.idPhotoPath = req.file.filename;
            user.isVerified = true;

            await user.save();
            res.redirect("/dashboard?username=" + username);
        } catch (err) {
            console.error("Verify Error:", err);
            res.redirect("/verify-page?username=" + username + "&error=Verification failed. Please try again.");
        }
    });


    // _____ DELETE POST _____
    app.post("/delete-post", async (req, res) => {
        const { username, postId } = req.body;
        try {
            await Job.findOneAndDelete({ _id: postId, client: username });
            res.redirect("/marketplace?username=" + encodeURIComponent(username));
        } catch (err) {
            res.status(500).send("Error deleting post.");
        }
    });


    // _____ SEND MESSAGE _____
    app.post("/send-message", async (req, res) => {
        const { from, to, subject, body, jobId } = req.body;
        try {
            const newMsg = new Message({ from, to, subject, body, jobId: jobId || null });
            await newMsg.save();
            res.json({ success: true });
        } catch (err) {
            console.error("Message Error:", err);
            res.status(500).json({ success: false, error: "Failed to send message." });
        }
    });

    // _____ GET MESSAGES _____
    app.get("/messages", async (req, res) => {
        const username = req.query.username;
        const sortBy = req.query.sort || "newest";
        if (!username) return res.json([]);

        try {
            let sortOpt = { createdAt: -1 };
            if (sortBy === "oldest") sortOpt = { createdAt: 1 };

            let messages = await Message.find({ $or: [{ to: username }, { from: username }] }).sort(sortOpt);

            // Filter by job status if requested
            if (sortBy === "open_jobs" || sortBy === "closed_jobs" || sortBy === "current_bids") {
                const jobIds = messages.filter((m) => m.jobId).map((m) => m.jobId);
                const jobs = await Job.find({ _id: { $in: jobIds } });
                const jobMap = {};
                jobs.forEach((j) => { jobMap[j._id.toString()] = j; });

                messages = messages.filter((m) => {
                    if (!m.jobId) return false;
                    const job = jobMap[m.jobId.toString()];
                    if (!job) return false;
                    if (sortBy === "open_jobs") return job.status === "OPEN";
                    if (sortBy === "closed_jobs") return job.status === "CLOSED";
                    if (sortBy === "current_bids") return job.status === "OPEN" && job.bids.some((b) => b.contractor === username);
                    return true;
                });
            }

            res.json(messages);
        } catch (err) {
            res.status(500).json([]);
        }
    });

    // _____ REPORT ISSUE _____
    app.post("/report-issue", async (req, res) => {
        const { username, subject, description } = req.body;
        try {
            const newMsg = new Message({
                from: username,
                to: "admin@handymanhelper.com",
                subject: "REPORT: " + subject,
                body: description,
            });
            await newMsg.save();
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false });
        }
    });


    app.listen(PORT, () => console.log(`HandymanHelper running at http://localhost:${PORT}`));
}

startServer();
