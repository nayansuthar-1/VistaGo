const mongoose = require("mongoose");
const MONGO_URL = process.env.MONGO_ATLAS_URL || "mongodb://127.0.0.1:27017/vistago";

async function dropIndex() {
    try {
        await mongoose.connect(MONGO_URL);
        console.log("Connected to DB");
        const User = mongoose.model("User", new mongoose.Schema({}));
        await User.collection.dropIndex("username_1");
        console.log("Dropped username_1 index successfully");
    } catch (err) {
        if (err.codeName === "IndexNotFound") {
            console.log("Index username_1 not found, already dropped.");
        } else {
            console.error("Error dropping index:", err);
        }
    } finally {
        await mongoose.disconnect();
    }
}

dropIndex();
