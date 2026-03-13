const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose").default;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true
  },
  wishlist: [
    {
      type: Schema.Types.ObjectId,
      ref: "Listing"
    }
  ],
  googleId: String,
  isGoogleUser: {
    type: Boolean,
    default: false
  },
  isDeactivated: {
    type: Boolean,
    default: false
  }
});


userSchema.plugin(passportLocalMongoose, { usernameField: "email" });


module.exports = mongoose.model("User", userSchema);

