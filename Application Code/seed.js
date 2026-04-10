const mongoose = require("mongoose");
const Job = require("./models/Job");

async function seedDB() {
    await mongoose.connect("mongodb://127.0.0.1:27017/handymanHelper");
    console.log("Connected for seeding...");

    // Check how many jobs already exist
    const existingCount = await Job.countDocuments();
    if (existingCount > 0) {
        console.log("Found " + existingCount + " existing jobs. Skipping seed to protect your data.");
        console.log("To force re-seed, run: node seed.js --force");

        if (process.argv.includes("--force")) {
            console.log("--force flag detected. Clearing and re-seeding...");
            await Job.deleteMany({});
        } else {
            process.exit();
            return;
        }
    }

    const mockJobs = [];
    const categories = ["Plumbing", "Electrical", "Cleaning", "Carpentry", "General"];

    for (let i = 1; i <= 50; i++) {
        const randomCat = categories[Math.floor(Math.random() * categories.length)];
        mockJobs.push({
            title: randomCat + " Task #" + i,
            description: "This is a prototype description for a " + randomCat + " job. Need someone reliable in Regina.",
            startingBid: Math.floor(Math.random() * 200) + 20,
            flatRate: Math.floor(Math.random() * 300) + 100,
            category: randomCat,
            client: "demo@handymanhelper.com",
            status: "OPEN",
        });
    }

    await Job.insertMany(mockJobs);
    console.log("Success: Database seeded with 50 prototype ads!");
    process.exit();
}

seedDB();
