const express = require("express");
const router = express.Router();
const {
  verifyFirebaseToken,
  verifyAdmin,
  verifyRider,
} = require("../middleware/auth");
const {
  getStatusCount,
  getParcels,
  getParcelById,
  createParcel,
  updateParcel,
  assignRider,
  deleteParcel,
  updateParcelStatus,
} = require("../controllers/parcelController");

router.get("/status-count", getStatusCount);

router.get("/", verifyFirebaseToken, getParcels);
router.get("/:id", verifyFirebaseToken, getParcelById);
router.post("/", verifyFirebaseToken, createParcel);
router.put("/:id", verifyFirebaseToken, updateParcel);
router.patch(
  "/:id/assign/:rider_email",
  verifyFirebaseToken,
  verifyAdmin,
  assignRider
);
// develope it to update parcel status
router.patch(
  "/:id/status",
  verifyFirebaseToken,
  verifyRider,
  updateParcelStatus
);
router.delete("/:id", verifyFirebaseToken, deleteParcel);

module.exports = router;
