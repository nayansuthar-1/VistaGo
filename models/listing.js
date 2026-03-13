const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  image: {
  filename: {
    type: String,
    default: "listingimage",
  },
  url: {
    type: String,
    default:
      "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YmVhY2glMjBob3VzZXxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=800&q=60",
    set: (v) =>
      v ===
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fGxha2V8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=800&q=60"
        ? "default link"
        : v,
    }
  },

  price: {
    type: Number,
    default: 999
  },
  location: String,
  country: String,
  category: {
    type: String,
    enum: ["Trending", "Rooms", "Iconic cities", "Mountains", "Castles", "Amazing pools", "Camping", "Farms", "Arctic", "Domes", "Boats"],
    required: true,
    default: "Trending"
  },
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref : "Review",
    },
  ],
  owner: {
    type: Schema.Types.ObjectId,
    ref : 'User'
  },
  amenities: [
    {
      type: String,
    }
  ],
  isDeactivated: {
    type: Boolean,
    default: false
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
