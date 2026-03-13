const multer = require("multer");
const express = require("express");
const router = express.Router();
const Booking = require("../models/booking.js");
const { listingSchema } = require("../schema.js");
const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");
const { isLoggedIn } = require("../middleware.js");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

const validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body);
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(errMsg, 400);
  } else {
    next();
  }
};


// index route
router.get("/", async (req, res) => {
  let allListings;
  let query = { isDeactivated: { $ne: true } };

  if (req.query.location) {
    const regex = new RegExp(req.query.location, 'i'); // Case-insensitive search
    query.$or = [
      { location: regex },
      { country: regex },
      { title: regex }
    ];
  }

  allListings = await Listing.find(query);
  res.render("listings/index.ejs", { allListings });
});

//new route
router.get("/new", isLoggedIn, (req, res) => {
  console.log(req.user);
  res.render("listings/new.ejs");
});

//show route
router.get("/:id",  async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      match: { isDeactivated: { $ne: true } }, // Filter deactivated reviews
      populate: {
        path: "author"
      }
    })
    .populate("owner");
  
  if (!listing || listing.isDeactivated === true) {
    req.flash("error", "Listing doesn't exist or has been hidden");
    return res.redirect("/listings");
  }

  // Fetch all bookings for this listing to disable dates in calendar
  const bookings = await Booking.find({ listing: id });
  const bookedDates = bookings.map(b => ({
    from: b.checkIn,
    to: b.checkOut
  }));

  res.render("listings/show.ejs", { listing, bookedDates });
});

//create route
router.post(
  "/",
  isLoggedIn,
  upload.single("listingImage"),
  validateListing,
  wrapAsync(async (req, res, next) => {
    let listingData = req.body.listing;
    
    // Ensure amenities is an array
    if (listingData.amenities && !Array.isArray(listingData.amenities)) {
      listingData.amenities = [listingData.amenities];
    } else if (!listingData.amenities) {
      listingData.amenities = [];
    }

    const newListing = new Listing(listingData);

    newListing.owner = req.user._id;

    if (req.file) {
      let url = req.file.path;
      let filename = req.file.filename;
      newListing.image = { url, filename };
    } else if (listingData.image && listingData.image.url) {
      newListing.image = { url: listingData.image.url, filename: "listingimage" };
    }

    newListing.owner = req.user._id;
    await newListing.save();
    req.flash("success", "Successfully added your listing!");
    res.redirect("/listings");
  })
);

//edit route
router.get("/:id/edit", isLoggedIn, async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing doesn't exist");
  return  res.redirect("/listings");
  }
  res.render("listings/edit.ejs", { listing });
});

//update route
router.put(
  "/:id", 
  isLoggedIn, 
  upload.single("listingImage"),
  validateListing,
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    let listingData = req.body.listing;
    
    // Ensure amenities is an array (it might be a string if only one is selected)
    if (listingData.amenities && !Array.isArray(listingData.amenities)) {
      listingData.amenities = [listingData.amenities];
    } else if (!listingData.amenities) {
      listingData.amenities = [];
    }

    // Extract image from listingData to handle it separately
    const { image, ...otherData } = listingData;

    let listing = await Listing.findByIdAndUpdate(id, { ...otherData });

    // Handle image update (file or URL)
    if (req.file) {
      let url = req.file.path;
      let filename = req.file.filename;
      listing.image = { url, filename };
      await listing.save();
    } else if (image && typeof image === 'string' && image.trim() !== '') {
      listing.image = { url: image, filename: "listingimage" };
      await listing.save();
    }

    req.flash("success", "Successfully updated your listing!");
    return res.redirect(`/listings/${id}`);
  })
);

//delete route
router.delete("/:id", isLoggedIn, async (req, res) => {
  let { id } = req.params;
  let deletedListing = await Listing.findByIdAndDelete(id);
  console.log(deletedListing);
  req.flash("success", "Successfully deleted your listing!");
  res.redirect("/listings");
});

// Booking route
router.post("/:id/bookings", isLoggedIn, wrapAsync(async (req, res) => {
    let { id } = req.params;
    let { checkIn, checkOut } = req.body.booking;

    // Availability Check
    const overlappingBooking = await Booking.findOne({
        listing: id,
        $or: [
            {
                checkIn: { $lt: new Date(checkOut) },
                checkOut: { $gt: new Date(checkIn) }
            }
        ]
    });

    if (overlappingBooking) {
        req.flash("error", "These dates are already booked! Please select different dates.");
        return res.redirect(`/listings/${id}`);
    }

    let listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }

    let newBooking = new Booking(req.body.booking);
    newBooking.listing = id;
    newBooking.user = req.user._id;

    await newBooking.save();
    
    req.flash("success", "Booking confirmed! Enjoy your stay.");
    res.redirect(`/listings/${id}`);
}));

// Wishlist toggle route
router.post("/:id/wishlist", isLoggedIn, wrapAsync(async (req, res) => {
  let { id } = req.params;
  let user = await User.findById(req.user._id);
  
  if (!user.wishlist) {
    user.wishlist = [];
  }

  const idx = user.wishlist.indexOf(id);
  let status;
  if (idx === -1) {
    user.wishlist.push(id);
    status = "added";
  } else {
    user.wishlist.splice(idx, 1);
    status = "removed";
  }
  
  await user.save();
  res.json({ status, listingId: id });
}));

module.exports = router;
