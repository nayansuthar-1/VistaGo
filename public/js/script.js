(() => {
  "use strict";

  // Bootstrap custom validation
  const forms = document.querySelectorAll(".needs-validation");
  Array.from(forms).forEach((form) => {
    form.addEventListener(
      "submit",
      (event) => {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }

        form.classList.add("was-validated");
      },
      false
    );
  });

  // Category selection toggle
  const categoryItems = document.querySelectorAll(".category-item");
  const listingContainers = document.querySelectorAll(".listing-wrapper");
  
  if(categoryItems.length > 0) {
    categoryItems.forEach(item => {
      item.addEventListener("click", () => {
        // Active State
        categoryItems.forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        
        // Filter Logic
        let selectedCategory = item.querySelector("p").innerText.trim();
        const listings = document.querySelectorAll(".listing-wrapper");

        listings.forEach(listing => {
          let cat = listing.getAttribute("data-category");
          if (selectedCategory === "Trending" || cat === selectedCategory) {
            listing.style.display = "block";
          } else {
            listing.style.display = "none";
          }
        });
      });
    });
  }

  // Tax Toggle functionality
  const taxSwitch = document.getElementById("flexSwitchCheckDefault");
  if (taxSwitch) {
    taxSwitch.addEventListener("change", () => {
      const priceElements = document.querySelectorAll(".price-element");
      const taxTexts = document.querySelectorAll(".tax-text");
      
      priceElements.forEach(element => {
        let basePrice = element.getAttribute("data-baseprice");
        if (basePrice && basePrice !== "null") {
          basePrice = parseInt(basePrice);
          if (taxSwitch.checked) {
            let priceWithTax = Math.round(basePrice * 1.18); // Example: 18% tax
            element.innerHTML = `&#8377; ${priceWithTax.toLocaleString()}`;
          } else {
            element.innerHTML = `&#8377; ${basePrice.toLocaleString()}`;
          }
        }
      });

      taxTexts.forEach(text => {
        if(taxSwitch.checked) {
          text.style.display = "inline";
        } else {
          text.style.display = "none";
        }
      })
    });
  }

  // Persistent Wishlist Toggle (AJAX)
  const wishlistTriggers = document.querySelectorAll(".heart-icon, #save-btn");
  if (wishlistTriggers.length > 0) {
    wishlistTriggers.forEach(trigger => {
      trigger.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const listingId = trigger.getAttribute("data-id");
        if (!listingId) return;

        try {
          const response = await fetch(`/listings/${listingId}/wishlist`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "X-Requested-With": "XMLHttpRequest"
            }
          });

          if (response.status === 401) {
             window.location.href = "/signup";
             return;
          }

          const data = await response.json();
          
          // Find all icons/buttons for this listing on the page to sync them
          const allListingTriggers = document.querySelectorAll(`[data-id="${listingId}"]`);
          
          allListingTriggers.forEach(target => {
            if (data.status === "added") {
              // Update generic heart icons
              if (target.classList.contains("heart-icon")) {
                target.classList.add("liked", "text-brand");
                const iconInside = target.tagName === "I" ? target : target.querySelector("i");
                if (iconInside) {
                  iconInside.classList.remove("fa-regular");
                  iconInside.classList.add("fa-solid");
                  if (target.tagName !== "I") iconInside.classList.add("text-brand");
                }
              }
              // Update specific Save button
              if (target.id === "save-btn") {
                target.innerHTML = `<i class="fa-solid fa-heart me-1 text-brand"></i> Saved`;
              }
            } else if (data.status === "removed") {
              // Update generic heart icons
              if (target.classList.contains("heart-icon")) {
                target.classList.remove("liked", "text-brand");
                const iconInside = target.tagName === "I" ? target : target.querySelector("i");
                if (iconInside) {
                  iconInside.classList.add("fa-regular");
                  iconInside.classList.remove("fa-solid");
                  if (target.tagName !== "I") iconInside.classList.remove("text-brand");
                }
              }
              // Update specific Save button
              if (target.id === "save-btn") {
                target.innerHTML = `<i class="fa-regular fa-heart me-1"></i> Save`;
              }
            }
          });
        } catch (err) {
          console.error("Wishlist error:", err);
        }
      });
    });
  }
  
  // --- Premium Guest Selection Logic ---
  const guestToggle = document.getElementById("guest-dropdown-toggle");
  const guestDropdown = document.getElementById("guest-dropdown");
  const guestCountDisplay = document.getElementById("guest-count-display");
  const guestCountVal = document.getElementById("guest-count-val");
  const guestsInput = document.getElementById("guests-input");
  const guestMinus = document.getElementById("guest-minus");
  const guestPlus = document.getElementById("guest-plus");
  const closeGuestDropdown = document.getElementById("close-guest-dropdown");

  if (guestToggle && guestDropdown) {
    function updateGuestCount(count) {
      if (guestCountVal) guestCountVal.innerText = count;
      if (guestsInput) guestsInput.value = count;
      if (guestCountDisplay) guestCountDisplay.innerText = count === 1 ? "1 guest" : `${count} guests`;
      
      if (guestMinus) guestMinus.disabled = (count <= 1);
      if (guestPlus) guestPlus.disabled = (count >= 10);
    }

    let toggleThrottle = false;
    guestToggle.addEventListener("click", (e) => {
      if (toggleThrottle) return;
      toggleThrottle = true;
      setTimeout(() => toggleThrottle = false, 100);
      
      // If clicking exactly the toggle area or children (but not the dropdown content itself)
      if (!guestDropdown.contains(e.target) || e.target === closeGuestDropdown) {
        e.stopPropagation(); // Prevent document level click listener from firing
        guestDropdown.classList.toggle("d-none");
      }
    });

    // Close on clicking outside
    document.addEventListener("click", (e) => {
      if (guestToggle && !guestToggle.contains(e.target) && guestDropdown && !guestDropdown.classList.contains("d-none")) {
        guestDropdown.classList.add("d-none");
      }
    });

    if (guestPlus) {
      guestPlus.addEventListener("click", (e) => {
        e.stopPropagation();
        let count = parseInt(guestCountVal.innerText);
        if (count < 10) {
          count++;
          updateGuestCount(count);
        }
      });
    }

    if (guestMinus) {
      guestMinus.addEventListener("click", (e) => {
        e.stopPropagation();
        let count = parseInt(guestCountVal.innerText);
        if (count > 1) {
          count--;
          updateGuestCount(count);
        }
      });
    }

    if (closeGuestDropdown) {
      closeGuestDropdown.addEventListener("click", (e) => {
        e.stopPropagation();
        guestDropdown.classList.add("d-none");
      });
    }

    // Initial button state
    updateGuestCount(1);
  }

  // --- Mobile Guest Selection Logic ---
  const guestToggleMobile = document.getElementById("guest-dropdown-toggle-mobile");
  const guestDropdownMobile = document.getElementById("guest-dropdown-mobile");
  const guestCountDisplayMobile = document.getElementById("guest-count-display-mobile");
  const guestCountValMobile = document.getElementById("guest-count-val-mobile");
  const guestsInputMobile = document.getElementById("guests-input-mobile");
  const guestMinusMobile = document.getElementById("guest-minus-mobile");
  const guestPlusMobile = document.getElementById("guest-plus-mobile");
  const closeGuestDropdownMobile = document.getElementById("close-guest-dropdown-mobile");

  if (guestToggleMobile && guestDropdownMobile) {
    function updateGuestCountMobile(count) {
      if (guestCountValMobile) guestCountValMobile.innerText = count;
      if (guestsInputMobile) guestsInputMobile.value = count;
      if (guestCountDisplayMobile) guestCountDisplayMobile.innerText = count === 1 ? "1 guest" : `${count} guests`;
      
      if (guestMinusMobile) guestMinusMobile.disabled = (count <= 1);
      if (guestPlusMobile) guestPlusMobile.disabled = (count >= 10);
    }

    guestToggleMobile.addEventListener("click", (e) => {
      e.stopPropagation();
      guestDropdownMobile.classList.toggle("d-none");
    });

    document.addEventListener("click", (e) => {
      if (guestToggleMobile && !guestToggleMobile.contains(e.target) && guestDropdownMobile && !guestDropdownMobile.classList.contains("d-none")) {
        guestDropdownMobile.classList.add("d-none");
      }
    });

    if (guestPlusMobile) {
      guestPlusMobile.addEventListener("click", (e) => {
        e.stopPropagation();
        let count = parseInt(guestCountValMobile.innerText);
        if (count < 10) {
          count++;
          updateGuestCountMobile(count);
        }
      });
    }

    if (guestMinusMobile) {
      guestMinusMobile.addEventListener("click", (e) => {
        e.stopPropagation();
        let count = parseInt(guestCountValMobile.innerText);
        if (count > 1) {
          count--;
          updateGuestCountMobile(count);
        }
      });
    }

    if (closeGuestDropdownMobile) {
      closeGuestDropdownMobile.addEventListener("click", (e) => {
        e.stopPropagation();
        guestDropdownMobile.classList.add("d-none");
      });
    }

    updateGuestCountMobile(1);
  }

  // --- Share Functionality ---
  const shareBtns = document.querySelectorAll("#share-btn, #share-btn-mobile");
  if (shareBtns.length > 0) {
    shareBtns.forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const title = document.title;
        const url = window.location.href;
        const text = "Check out this amazing place on VistaGo!";

        if (navigator.share) {
          try {
            await navigator.share({
              title: title,
              text: text,
              url: url
            });
          } catch (err) {
            if (err.name !== "AbortError") {
              console.error("Error sharing:", err);
            }
          }
        } else {
          // Fallback: Copy to clipboard
          try {
            await navigator.clipboard.writeText(url);
            // Simple visual feedback if possible, or just log
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-check me-1"></i> Copied`;
            setTimeout(() => {
              btn.innerHTML = originalHTML;
            }, 2000);
          } catch (err) {
            console.error("Fallback sharing error:", err);
          }
        }
      });
    });
  }

  // --- Booking Date Picker & Price Calculation ---
  try {
    const checkInInput = document.getElementById("checkIn");
    const checkOutInput = document.getElementById("checkOut");
    const priceSummary = document.getElementById("price-summary");
    const pricePlaceholder = document.getElementById("price-placeholder");
    const nightCalcLabel = document.getElementById("night-calc-label");
    const basePriceTotal = document.getElementById("base-price-total");
    const serviceFeeDisplay = document.getElementById("service-fee");
    const finalPriceDisplay = document.getElementById("final-price-display");
    const finalTotalInput = document.getElementById("final-total");
    const totalNightsInput = document.getElementById("total-nights");
    const listingPriceElement = document.getElementById("listing-price");
    const bookedDatesElement = document.getElementById("booked-dates");

    if (checkInInput && checkOutInput && listingPriceElement) {
      const listingPrice = parseInt(listingPriceElement.getAttribute("data-price")) || 0;
      let bookedDatesData = [];
      try {
        bookedDatesData = JSON.parse(bookedDatesElement ? bookedDatesElement.getAttribute("data-dates") : "[]");
      } catch(e) { console.error("Error parsing booked dates", e); }
      
      const disabledDates = bookedDatesData.map(range => ({
        from: new Date(range.from),
        to: new Date(range.to)
      }));

      const checkoutPicker = flatpickr("#checkOut", {
        minDate: "today",
        altInput: true,
        altFormat: "Y-m-d",
        dateFormat: "Y-m-d",
        disable: disabledDates,
        onChange: function(selectedDates, dateStr, instance) {
          const checkInDate = new Date(checkInInput.value);
          const checkOutDate = new Date(dateStr);
          
          if (checkInDate && checkOutDate && checkOutDate > checkInDate) {
            const diffTime = Math.abs(checkOutDate - checkInDate);
            const diffNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            updatePriceDetails(diffNights, listingPrice);
          } else {
            priceSummary.classList.add("d-none");
            pricePlaceholder.classList.remove("d-none");
          }
        }
      });

      flatpickr("#checkIn", {
        minDate: "today",
        altInput: true,
        altFormat: "Y-m-d",
        dateFormat: "Y-m-d",
        disable: disabledDates,
        onChange: function(selectedDates, dateStr, instance) {
          checkoutPicker.set("minDate", dateStr);
          if (new Date(checkOutInput.value) < new Date(dateStr)) {
            checkOutInput.value = "";
            priceSummary.classList.add("d-none");
            pricePlaceholder.classList.remove("d-none");
          }
        }
      });

      function updatePriceDetails(nights, price) {
        if (!priceSummary || !pricePlaceholder) return;
        
        const basePrice = price * nights;
        const serviceFee = Math.round(basePrice * 0.14);
        const totalPrice = basePrice + serviceFee;

        if (nightCalcLabel) nightCalcLabel.innerText = `₹ ${price.toLocaleString()} x ${nights} nights`;
        if (basePriceTotal) basePriceTotal.innerText = `₹ ${basePrice.toLocaleString()}`;
        if (serviceFeeDisplay) serviceFeeDisplay.innerText = `₹ ${serviceFee.toLocaleString()}`;
        if (finalPriceDisplay) finalPriceDisplay.innerText = `₹ ${totalPrice.toLocaleString()}`;

        if (finalTotalInput) finalTotalInput.value = totalPrice;
        if (totalNightsInput) totalNightsInput.value = nights;

        priceSummary.classList.remove("d-none");
        pricePlaceholder.classList.add("d-none");
        
        // Enable desktop reserve button
        const reserveBtn = document.getElementById("reserve-btn");
        if (reserveBtn) {
          reserveBtn.disabled = false;
          reserveBtn.style.opacity = "1";
        }
      }

      // --- Mobile Specific Booking Logic ---
      const checkInInputMobile = document.getElementById("checkInMobile");
      const checkOutInputMobile = document.getElementById("checkOutMobile");
      const priceSummaryMobile = document.getElementById("price-summary-mobile");
      
      if (checkInInputMobile && checkOutInputMobile) {
        const checkoutPickerMobile = flatpickr("#checkOutMobile", {
          minDate: "today",
          altInput: true,
          altFormat: "Y-m-d",
          dateFormat: "Y-m-d",
          disable: disabledDates,
          onChange: function(selectedDates, dateStr) {
            const checkInDate = new Date(checkInInputMobile.value);
            const checkOutDate = new Date(dateStr);
            if (checkInDate && checkOutDate && checkOutDate > checkInDate) {
              const diffTime = Math.abs(checkOutDate - checkInDate);
              const diffNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              updatePriceDetailsMobile(diffNights, listingPrice);
            }
          }
        });

        flatpickr("#checkInMobile", {
          minDate: "today",
          altInput: true,
          altFormat: "Y-m-d",
          dateFormat: "Y-m-d",
          disable: disabledDates,
          onChange: function(selectedDates, dateStr) {
            checkoutPickerMobile.set("minDate", dateStr);
          }
        });

        function updatePriceDetailsMobile(nights, price) {
          if (!priceSummaryMobile) return;
          
          const basePrice = price * nights;
          const serviceFee = Math.round(basePrice * 0.14);
          const totalPrice = basePrice + serviceFee;

          if (document.getElementById("night-calc-label-mobile")) document.getElementById("night-calc-label-mobile").innerText = `₹ ${price.toLocaleString()} x ${nights} nights`;
          if (document.getElementById("base-price-total-mobile")) document.getElementById("base-price-total-mobile").innerText = `₹ ${basePrice.toLocaleString()}`;
          if (document.getElementById("final-price-display-mobile")) document.getElementById("final-price-display-mobile").innerText = `₹ ${totalPrice.toLocaleString()}`;
          
          if (document.getElementById("final-total-mobile")) document.getElementById("final-total-mobile").value = totalPrice;
          if (document.getElementById("total-nights-mobile")) document.getElementById("total-nights-mobile").value = nights;

          priceSummaryMobile.classList.remove("d-none");
          
          // Enable mobile reserve button
          const mobileReserveBtn = document.querySelector("#booking-form-mobile button[type='submit']");
          if (mobileReserveBtn) {
            mobileReserveBtn.disabled = false;
            mobileReserveBtn.style.opacity = "1";
          }
        }
      }
    }
  } catch (err) {
    console.error("Booking widget JS error:", err);
  }
})();
