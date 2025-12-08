const express = require("express");
const router = express.Router();
const {
  verifyFirebaseToken,
  verifyAdmin,
  verifyUser,
  verifyRider,
} = require("../middleware/auth");
const {
  createRiderApplication,
  getRiderApplications,
  getRiderApplicationsByEmail,
  updateRiderApplication,
  deleteRiderApplication,
  acceptOrRejectApplication,
} = require("../controllers/riderController");
const { getRiderEarnings } = require("../controllers/parcelController");

// only normal user allowed to apply
router.post(
  "/applications",
  verifyFirebaseToken,
  verifyUser,
  createRiderApplication
);
// admin can get any; user can only his own
router.get(
  "/applications/:email",
  verifyFirebaseToken,
  getRiderApplicationsByEmail
);
router.put("/applications/:email", verifyFirebaseToken, updateRiderApplication);
router.delete(
  "/applications/:email",
  verifyFirebaseToken,
  deleteRiderApplication
);

// only admin
router.get(
  "/applications",
  verifyFirebaseToken,
  verifyAdmin,
  getRiderApplications
);
router.patch(
  "/applications/:email/:accept",
  verifyFirebaseToken,
  verifyAdmin,
  acceptOrRejectApplication
);

// rider only
router.get("/my-earnings", verifyFirebaseToken, verifyRider, getRiderEarnings);

module.exports = router;
