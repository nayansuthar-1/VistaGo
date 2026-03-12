require("dotenv").config();
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL = process.env.MONGO_ATLAS_URL;   //  || "mongodb://127.0.0.1:27017/wanderlust" optional

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const User = require("../models/user.js");

const initDB = async () => {
  // Find a user to act as the owner for the seeded listings
  const user = await User.findOne({});
  if (!user) {
    console.log("\n❌ Cannot Initialize Data!");
    console.log("There are no registered users in your database.");
    console.log("Please start your server, go to http://localhost:3000/signup, and register an account first.");
    console.log("Once you have an account, run this script again to assign the sample listings to your new account!\n");
    process.exit(1);
  }

  const categories = ["Trending", "Rooms", "Iconic cities", "Mountains", "Castles", "Amazing pools", "Camping", "Farms", "Arctic", "Domes", "Boats"];

  await Listing.deleteMany({});
  initData.data = initData.data.map((obj) => {
    // Pick a random category or loosely assign based on title keywords if we wanted to be smarter
    // For now, simple random assignment is good enough to seed standard categories
    const randomCat = categories[Math.floor(Math.random() * categories.length)];
    return {
      ...obj,
      owner: user._id,
      category: randomCat
    };
  });
  await Listing.insertMany(initData.data);
  console.log(`✅ Data was initialized and assigned to user: ${user.username}`);
};

initDB();
