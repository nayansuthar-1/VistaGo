const express = require("express");
const router = express.Router();
const User = require("../models/user.js");
const wrapAsync = require("../utils/wrapAsync.js");
const passport = require("passport");
const { saveRedirectUrl } = require("../middleware.js");

const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const Review = require("../models/review.js");
const { isLoggedIn } = require("../middleware.js");
const Message = require("../models/message.js");

router.get("/signup", (req, res) => {
  res.render("users/signup.ejs");
});

router.post(
  "/signup",
  wrapAsync(async (req, res) => {
    try {
      let { username, email, password } = req.body;
      const newUser = new User({ email, username });
      const registeredUser = await User.register(newUser, password);
      console.log(registeredUser);
      req.login(registeredUser, (err) => {
        if (err) {
          return next(err);
        }
    req.flash("success", "Welcome to VistaGo");
        res.redirect("/listings");
      });
    } catch (e) {
      req.flash("error", e.message);
      res.redirect("/signup");
    }
  })
);

router.get("/login", (req, res) => {
  res.render("users/login.ejs");
});

router.post(
  "/login",
  saveRedirectUrl,
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: "Incorrect email or password",
  }),
  async (req, res) => {
    // Reactivate account and associated content
    await User.findByIdAndUpdate(req.user._id, { isDeactivated: false });
    await Listing.updateMany({ owner: req.user._id }, { isDeactivated: false });
    await Review.updateMany({ author: req.user._id }, { isDeactivated: false });
    
    req.flash("success", "Welcome back!");
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
  }
);

router.get("/bookings", isLoggedIn, wrapAsync(async (req, res) => {
    const allBookings = await Booking.find({ user: req.user._id })
        .populate({
            path: "listing",
            select: "title image price location country"
        })
        .sort({ createdAt: -1 });
    res.render("users/bookings.ejs", { allBookings });
}));

router.get("/wishlist", isLoggedIn, wrapAsync(async (req, res) => {
  const user = await User.findById(req.user._id).populate("wishlist");
  res.render("users/wishlist.ejs", { user });
}));

router.get("/messages", isLoggedIn, wrapAsync(async (req, res) => {
  const allMessages = await Message.find({ receiver: req.user._id })
    .populate("sender", "username")
    .populate("listing", "title")
    .sort({ createdAt: -1 });
  res.render("users/messages.ejs", { allMessages });
}));

router.put("/messages/:id/read", isLoggedIn, wrapAsync(async (req, res) => {
  const msg = await Message.findById(req.params.id);
  if (!msg || !msg.receiver.equals(req.user._id)) {
    return res.status(403).json({ success: false });
  }
  msg.isRead = true;
  await msg.save();
  res.json({ success: true });
}));

router.get("/account", isLoggedIn, (req, res) => {
  res.render("users/account.ejs");
});

router.get("/account/listings", isLoggedIn, wrapAsync(async (req, res) => {
  const allListings = await Listing.find({ owner: req.user._id });
  res.render("users/myListings.ejs", { allListings });
}));

router.get("/account/personal-info", isLoggedIn, (req, res) => {
  res.render("users/personalInfo.ejs");
});

router.get("/account/security", isLoggedIn, (req, res) => {
  res.render("users/security.ejs");
});

router.put("/account/personal-info", isLoggedIn, wrapAsync(async (req, res) => {
    let { username } = req.body.user;
    await User.findByIdAndUpdate(req.user._id, { username });
    req.flash("success", "Personal info updated successfully!");
    res.redirect("/account/personal-info");
}));

router.post("/account/change-password", isLoggedIn, wrapAsync(async (req, res) => {
    try {
        let { oldPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);
        await user.changePassword(oldPassword, newPassword);
        req.flash("success", "Password updated successfully!");
        res.redirect("/account/security");
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/account/security");
    }
}));

router.post("/account/deactivate", isLoggedIn, wrapAsync(async (req, res) => {
    const userId = req.user._id;
    await User.findByIdAndUpdate(userId, { isDeactivated: true });
    await Listing.updateMany({ owner: userId }, { isDeactivated: true });
    await Review.updateMany({ author: userId }, { isDeactivated: true });
    
    req.logout((err) => {
        if (err) return next(err);
        req.flash("success", "Your account has been deactivated. Listings and reviews are hidden.");
        res.redirect("/listings");
    });
}));

// Google Auth Routes
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/auth/google/callback", 
    passport.authenticate("google", { failureRedirect: "/login", failureFlash: "Google login failed" }),
    wrapAsync(async (req, res) => {
        // Reactivate account and associated content (same logic as local login)
        await User.findByIdAndUpdate(req.user._id, { isDeactivated: false });
        await Listing.updateMany({ owner: req.user._id }, { isDeactivated: false });
        await Review.updateMany({ author: req.user._id }, { isDeactivated: false });
        
        req.flash("success", "Welcome! Logged in with Google.");
        let redirectUrl = res.locals.redirectUrl || "/listings";
        res.redirect(redirectUrl);
    })
);

router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "Logged out successfully!");
    return res.redirect("/listings");
  });
});

module.exports = router;
