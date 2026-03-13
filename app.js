if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
app.set("trust proxy", 1);
const mongoose = require("mongoose");
const port = process.env.PORT;
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("./models/user.js");
const Listing = require("./models/listing.js");


const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const dbUrl = process.env.MONGO_ATLAS_URL ;

const store = MongoStore.create({
  mongoUrl: process.env.MONGO_ATLAS_URL,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});

store.on("error", (err) => {
  console.log("ERROR in MONGO SESSION STORE", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};


main()
  .then(() => {
    console.log("Connected to MongoDB via Atlas");
  })
  .catch((err) => {
    console.log("DB Connection Error:", err.message);
  });

async function main() {
  if (!dbUrl) {
    console.error("FATAL ERROR: MONGO_ATLAS_URL is not defined in environment variables.");
    process.exit(1);
  }
  await mongoose.connect(dbUrl);
}

app.listen(port, () => {
  console.log(`App is listening on port ${port}`);
});

app.get("/", async (req, res) => {
  res.redirect("/listings");
});



app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy({ usernameField: 'email' }, User.authenticate()));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      if (user) {
        return done(null, user);
      }
      
      // If no googleId, check by email to link accounts
      user = await User.findOne({ email: profile.emails[0].value });
      if (user) {
        user.googleId = profile.id;
        user.isGoogleUser = true;
        await user.save();
        return done(null, user);
      }

      // Create new user if none found
      const newUser = new User({
        googleId: profile.id,
        isGoogleUser: true,
        email: profile.emails[0].value,
        username: profile.displayName
      });
      await newUser.save();
      done(null, newUser);
    } catch (err) {
      done(err, null);
    }
  }
));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// Legal and Payment Pages
app.get("/privacy", (req, res) => {
  res.render("pages/privacy.ejs");
});

app.get("/terms", (req, res) => {
  res.render("pages/terms.ejs");
});

app.get("/about", (req, res) => {
  res.render("pages/about.ejs");
});

app.get("/contact", (req, res) => {
  res.render("pages/contact.ejs");
});

app.get("/policy", (req, res) => {
  res.render("pages/policy.ejs");
});


app.use("/listings", listingRouter);
app.use("/listings/:id/reviews/", reviewRouter);
app.use("/", userRouter);

app.use((req, res) => {
  res.status(404).render("error.ejs");
});
