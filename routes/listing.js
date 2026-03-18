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
const Razorpay = require("razorpay");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const Message = require("../models/message.js");

// --- Helper Functions ---
async function sendBookingConfirmationEmail(email, booking, listing) {
    // Check for credentials
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn("Skipping email receipt: EMAIL_USER or EMAIL_PASS not configured in .env");
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail', // Default to gmail, can be made configurable
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: `"VistaGo" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Booking Confirmed: ${listing.title}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
                <div style="background-color: #FF385C; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0;">VistaGo</h1>
                    <p style="margin: 5px 0 0;">Your booking is confirmed!</p>
                </div>
                <div style="padding: 30px;">
                    <p>Hi,</p>
                    <p>Great news! Your stay at <strong>${listing.title}</strong> is officially booked. Here are your trip details:</p>
                    
                    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <table style="width: 100%;">
                            <tr>
                                <td style="color: #717171; font-size: 12px; text-transform: uppercase;">Check-in</td>
                                <td style="color: #717171; font-size: 12px; text-transform: uppercase;">Check-out</td>
                            </tr>
                            <tr>
                                <td style="font-weight: bold; font-size: 16px;">${new Date(booking.checkIn).toLocaleDateString('en-IN')}</td>
                                <td style="font-weight: bold; font-size: 16px;">${new Date(booking.checkOut).toLocaleDateString('en-IN')}</td>
                            </tr>
                            <tr style="height: 20px;"><td></td><td></td></tr>
                            <tr>
                                <td style="color: #717171; font-size: 12px; text-transform: uppercase;">Guests</td>
                                <td style="color: #717171; font-size: 12px; text-transform: uppercase;">Total Paid</td>
                            </tr>
                            <tr>
                                <td style="font-weight: bold; font-size: 16px;">${booking.guests} Guests</td>
                                <td style="font-weight: bold; font-size: 16px;">₹${booking.totalPrice.toLocaleString()}</td>
                            </tr>
                        </table>
                    </div>

                    <p style="font-size: 12px; color: #717171;">Reservation ID: ${booking._id}</p>
                    ${booking.razorpayPaymentId ? `<p style="font-size: 12px; color: #717171;">Payment ID: ${booking.razorpayPaymentId}</p>` : ''}
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    
                    <p style="text-align: center; color: #717171; font-size: 14px;">Happy Travels!<br>The VistaGo Team</p>
                </div>
                <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #717171;">
                    &copy; ${new Date().getFullYear()} VistaGo. All rights reserved.
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Receipt email sent to: ${email}`);
    } catch (error) {
        console.error("Failed to send receipt email:", error);
    }
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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
  const bookings = await Booking.find({ listing: id, status: 'confirmed' });
  const bookedDates = bookings.map(b => ({
    from: b.checkIn,
    to: b.checkOut
  }));

  // Find if current user has an active booking for this listing
  let userBooking = null;
  if (req.user) {
    userBooking = await Booking.findOne({ 
      listing: id, 
      user: req.user._id,
      status: 'confirmed'
    });
  }

  res.render("listings/show.ejs", { listing, bookedDates, userBooking });
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

    // Extract image from listingData to handle it separately
    const { image, ...otherData } = listingData;
    const newListing = new Listing(otherData);

    newListing.owner = req.user._id;

    if (req.file) {
      let url = req.file.path;
      let filename = req.file.filename;
      newListing.image = { url, filename };
    } else if (image && typeof image === 'string' && image.trim() !== '') {
      newListing.image = { url: image, filename: "listingimage" };
    }

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

// Success Page Route
router.get("/bookings/:bookingId/success", isLoggedIn, wrapAsync(async (req, res) => {
    let { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate("listing");
    if (!booking) {
        req.flash("error", "Booking not found");
        return res.redirect("/listings");
    }
    res.render("bookings/success.ejs", { booking, listing: booking.listing });
}));

// Checkout Route (Review Page)
router.post("/:id/checkout-review", isLoggedIn, wrapAsync(async (req, res) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }
    let booking = req.body.booking;
    res.render("bookings/checkout.ejs", { listing, booking });
}));

// Final Booking/Payment route
router.post("/:id/reserve", isLoggedIn, wrapAsync(async (req, res) => {
    let { id } = req.params;
    let { checkIn, checkOut, nights, guests, totalPrice } = req.body.booking;

    // Availability Check (Double check) - Only look for CONFIRMED bookings
    const overlappingBooking = await Booking.findOne({
        listing: id,
        status: "confirmed",
        $or: [
            {
                checkIn: { $lt: new Date(checkOut) },
                checkOut: { $gt: new Date(checkIn) }
            }
        ]
    });

    if (overlappingBooking) {
        req.flash("error", "These dates were just taken! Please select different dates.");
        return res.redirect(`/listings/${id}`);
    }

    let booking = new Booking(req.body.booking);
    booking.listing = id;
    booking.user = req.user._id;
    booking.status = "pending";
    booking.paymentStatus = "unpaid";

    // Create Razorpay Order
    const amountInPaise = Math.round(parseFloat(totalPrice) * 100);

    if (amountInPaise < 100) { // Razorpay minimum is 1 INR (100 paise)
      return res.status(400).json({ success: false, message: "Invalid booking amount. Please select dates." });
    }

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    try {
      const order = await razorpay.orders.create(options);
      booking.razorpayOrderId = order.id;
      await booking.save();

      res.status(200).json({
        success: true,
        order,
        bookingId: booking._id,
        key_id: process.env.RAZORPAY_KEY_ID,
        user: {
          name: req.user.username,
          email: req.user.email,
        }
      });
    } catch (err) {
      console.error("Razorpay Order Error:", err);
      res.status(500).json({ success: false, message: "Order creation failed" });
    }
}));

// Verify Payment Route
router.post("/verify-payment", isLoggedIn, wrapAsync(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest("hex");

    if (digest === razorpay_signature) {
        // Final Availability check before confirming
        const existingBooking = await Booking.findById(bookingId).populate("listing");
        if (!existingBooking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        const overlappingBooking = await Booking.findOne({
            listing: existingBooking.listing._id,
            status: "confirmed",
            _id: { $ne: bookingId },
            $or: [
                {
                    checkIn: { $lt: existingBooking.checkOut },
                    checkOut: { $gt: existingBooking.checkIn }
                }
            ]
        });

        if (overlappingBooking) {
            // This is a rare race condition where two people paid for the same dates
            // In a real app, you would initiate an automated refund here
            return res.status(400).json({ 
                success: false, 
                message: "Unfortunately, these dates were just booked by someone else. A refund will be initiated." 
            });
        }

        // Payment is legit and dates are still free
        const booking = await Booking.findByIdAndUpdate(bookingId, {
            status: "confirmed",
            paymentStatus: "paid",
            razorpayPaymentId: razorpay_payment_id
        }, { new: true }).populate("listing");

        // Send Email Receipt
        if (req.body.receiptEmail) {
            sendBookingConfirmationEmail(req.body.receiptEmail, booking, booking.listing);
        }

        // Automatic Host Notification Message
        try {
            const hostMessage = new Message({
                sender: booking.user,
                receiver: booking.listing.owner,
                content: `New Booking Alert! ${req.user.username} has just booked "${booking.listing.title}" from ${new Date(booking.checkIn).toLocaleDateString('en-IN')} to ${new Date(booking.checkOut).toLocaleDateString('en-IN')}.`,
                listing: booking.listing._id
            });
            await hostMessage.save();
            console.log("Automatic notification sent to host:", booking.listing.owner);
        } catch (msgErr) {
            console.error("Failed to send automatic host notification message:", msgErr);
        }

        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, message: "Invalid signature" });
    }
}));

// Cancellation Route
router.delete("/bookings/:bookingId/cancel", isLoggedIn, wrapAsync(async (req, res) => {
    let { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
        req.flash("error", "Booking not found");
        return res.redirect("/bookings");
    }

    // Security check: ensure the booking belongs to the current user
    if (!booking.user.equals(req.user._id)) {
        req.flash("error", "You don't have permission to cancel this booking");
        return res.redirect("/bookings");
    }

    // Refund Policy Logic
    const bookingTime = new Date(booking.createdAt).getTime();
    const currentTime = Date.now();
    const timeDiffMinutes = (currentTime - bookingTime) / (1000 * 60);

    let refundAmount = 0;
    let refundMessage = "No refund is applicable as per the 30-minute policy.";

    if (timeDiffMinutes <= 30 && booking.totalPrice > 500) {
        refundAmount = Math.round(booking.totalPrice * 0.5);
        refundMessage = `Booking cancelled. A 50% refund (₹${refundAmount.toLocaleString()}) has been initiated.`;
        booking.paymentStatus = "refund_pending";
    } else if (timeDiffMinutes <= 30 && booking.totalPrice <= 500) {
        refundMessage = "Booking cancelled. No refund applicable for bookings below ₹500.";
        booking.paymentStatus = "paid"; // No refund
    } else {
        booking.paymentStatus = "paid"; // No refund
    }

    booking.status = "cancelled";
    booking.refundAmount = refundAmount;
    await booking.save();

    req.flash("success", refundMessage);
    res.redirect("/bookings");
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
