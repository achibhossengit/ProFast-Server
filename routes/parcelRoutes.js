const express = require("express");
const router = express.Router();
const { verifyFirebaseToken } = require("../middleware/auth");
const { verifyAdmin } = require("../middleware/role");
const {
  getStatusCount,
  getMyParcels,
  getParcels,
  getParcelById,
  createParcel,
  updateParcel,
  assignRider,
  deleteParcel,
} = require("../controllers/parcelController");

router.get("/status-count", getStatusCount);
router.get("/my-parcels", verifyFirebaseToken, verifyAdmin, getMyParcels);
router.get("/", verifyFirebaseToken, getParcels);
router.get("/:id", verifyFirebaseToken, getParcelById);
router.post("/", verifyFirebaseToken, createParcel);
router.put("/:id", verifyFirebaseToken, updateParcel);
router.put("/:id/assign", verifyFirebaseToken, verifyAdmin, assignRider);
router.delete("/:id", verifyFirebaseToken, deleteParcel);

module.exports = router;
