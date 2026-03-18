const mongoose = require("mongoose");
const Job = require("./models/Job"); //

async function seedDB() {
    // 1. Connect to your local MongoDB
    await mongoose.connect("mongodb://127.0.0.1:27017/handymanHelper");
    console.log("Connected for seeding...");

    // 2. Clear out the old ads so you start fresh
    await Job.deleteMany({});

    // 3. Create the loop to generate 50 mock jobs
    const mockJobs = [];
    const categories = ["Plumbing", "Electrical", "Cleaning", "Carpentry", "General"];

    for (let i = 1; i <= 50; i++) {
        const randomCat = categories[Math.floor(Math.random() * categories.length)];
        mockJobs.push({
            title: `${randomCat} Task #${i}`,
            description: `This is a prototype description for a ${randomCat} job. Need someone reliable in Regina.`,
            budget: Math.floor(Math.random() * 200) + 20,
            client: "tommy@notevote.com", // [cite: 41]
            status: "OPEN",
        });
    }

    // 4. Save them all to MongoDB
    await Job.insertMany(mockJobs);

    console.log("Success: Database seeded with 50 prototype ads!");
    process.exit();
}

seedDB();
