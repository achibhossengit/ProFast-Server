const { client } = require("../config/db");
const { getUserEmailUtil, getUserRoleUtil } = require("../middleware/utils");

const ridersColl = client.db("ProFastDB").collection("riders");
const usersColl = client.db("ProFastDB").collection("users");

const createRiderApplication = async (req, res) => {
  try {
    const email = getUserEmailUtil(req, res);
    const existing = await ridersColl.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "You have already applied." });

    const newRiderApplication = {
      ...req.body,
      email,
      appliedAt: new Date().toISOString(),
    };
    const result = await ridersColl.insertOne(newRiderApplication);
    res.status(201).json(result);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to submit application" });
  }
};

const getRiderApplications = async (req, res) => {
  try {
    const riders = await ridersColl.find().toArray();
    res.status(200).json(riders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch riders" });
  }
};

const getRiderApplicationsByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const authRole = getUserRoleUtil(req);
    const authEmail = getUserEmailUtil(req);

    // Permission check: only admin can fetch others' applications
    if ((authRole === "user" || authRole === "rider") && email !== authEmail) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const riderApplication = await ridersColl.findOne({ email });
    if (!riderApplication) {
      return res.status(404).json({ error: "Application not found" });
    }

    res.status(200).json(riderApplication);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch rider application" });
  }
};

const updateRiderApplication = async (req, res) => {
  try {
    const { email } = req.params;
    const authEmail = getUserEmailUtil(req);

    // Permission check: user can only update their own application
    if (email !== authEmail) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const updateData = req.body; // fields to update
    const result = await ridersColl.updateOne({ email }, { $set: updateData });

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    const updatedApplication = await ridersColl.findOne({ email });
    res.status(200).json(updatedApplication);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update rider application" });
  }
};

const deleteRiderApplication = async (req, res) => {
  try {
    const { email } = req.params;
    const authEmail = getUserEmailUtil(req);

    // Permission check: user can only delete their own application
    if (email !== authEmail) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const result = await ridersColl.deleteOne({ email });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    res.status(200).json({ message: "Application deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete rider application" });
  }
};

const acceptOrRejectApplication = async (req, res) => {
  try {
    const { email } = req.params;
    let { accept } = req.params;

    // Validate accept (must be "true" or "false")
    if (accept !== "true" && accept !== "false") {
      return res
        .status(400)
        .json({ error: "Invalid accept value. Must be 'true' or 'false'." });
    }

    accept = accept === "true"; // convert string to boolean

    // Find rider application
    const application = await ridersColl.findOne({ email });
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Find applicant user
    const applicantUser = await usersColl.findOne({ email });

    if (!applicantUser) {
      // delete application if user not found
      await ridersColl.deleteOne({ email });
      return res
        .status(404)
        .json({ error: "User not found. Application deleted." });
    }

    if (accept) {
      const { _id, email, name, appliedAt, ...rest } = application;

      const riderDetails = {
        ...rest,
        status: "active",
        joined_date: new Date(),
      };

      await usersColl.updateOne(
        { email },
        { $set: { details: riderDetails, role: "rider" } }
      );
    }

    // After accept/reject, delete application
    await ridersColl.deleteOne({ email });

    return res.status(200).json({
      message: `Application ${accept ? "accepted" : "rejected"} successfully`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to process application" });
  }
};

module.exports = {
  createRiderApplication,
  getRiderApplications,
  getRiderApplicationsByEmail,
  updateRiderApplication,
  deleteRiderApplication,
  acceptOrRejectApplication,
};
