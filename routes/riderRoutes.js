const express = require("express");
const router = express.Router();
const { verifyFirebaseToken, verifyAdmin, verifyRider } = require("../middleware/auth");
const {
  applyRider,
  getRiders,
  getAvailableRiders,
  updateRider,
  deleteRider,
  getRiderParcels,
  updateParcelStatus,
  getDeliveredParcels,
  cashoutParcel,
} = require("../controllers/riderController");

router.post("/", verifyFirebaseToken, applyRider);
router.get("/", verifyFirebaseToken, verifyAdmin, getRiders);
router.get("/available", verifyFirebaseToken, verifyAdmin, getAvailableRiders);
router.patch("/:id", verifyFirebaseToken, verifyAdmin, updateRider);
router.delete("/:id", verifyFirebaseToken, deleteRider);

// Rider-only
router.get("/parcels", verifyFirebaseToken, verifyRider, getRiderParcels);
router.patch("/parcels/:id", verifyFirebaseToken, verifyRider, updateParcelStatus);
router.get("/parcels/delivered", verifyFirebaseToken, verifyRider, getDeliveredParcels);
router.patch("/parcels/:id/cashout", verifyFirebaseToken, verifyRider, cashoutParcel);

module.exports = router;
