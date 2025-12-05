const { client } = require("../config/db");
const { admin } = require("../config/firebase");
const {
  getUserEmailUtil,
  getUserUidUtil,
  getUserRoleUtil,
} = require("../middleware/utils");

const usersColl = client.db("ProFastDB").collection("users");
const ridersColl = client.db("ProFastDB").collection("riders");

// Create or login user (called after Firebase authentication)
const createUser = async (req, res) => {
  try {
    const {
      email,
      role = "user",
      phoneNumber = "",
      gender = "",
      address = "",
    } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const alreadyExists = await usersColl.findOne({ email });

    if (alreadyExists) {
      // Update last login time for existing user
      await usersColl.updateOne(
        { email },
        { $set: { lastLoggedIn: new Date().toISOString() } }
      );
      return res.status(200).json({
        message: "Login successful",
        user: alreadyExists,
        isNewUser: false,
      });
    }

    // Create new user
    const newUser = {
      email,
      role,
      phoneNumber: phoneNumber,
      gender: gender,
      address: address,
      createdAt: new Date().toISOString(),
      lastLoggedIn: new Date().toISOString(),
    };

    const result = await usersColl.insertOne(newUser);
    return res.status(201).json({
      message: "User created successfully",
      userId: result.insertedId,
      isNewUser: true,
    });
  } catch (error) {
    console.error("Error creating/logging user:", error);
    return res.status(500).json({ error: "Failed to create user" });
  }
};

// Get user profile
const getUserRole = async (req, res) => {
  try {
    const role = await getUserRoleUtil(req);

    return res.status(200).json({ role });
  } catch (error) {
    console.error("Error fetching user role:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const email = getUserEmailUtil(req, res);

    const user = await usersColl.findOne({ email }, { projection: { _id: 0 } });

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const email = getUserEmailUtil(req, res);
    const { fullName, contact, gender, profession, address, age } = req.body;

    // Build update object only with provided fields
    const updateFields = {};
    if (fullName !== undefined) updateFields.fullName = fullName;
    if (gender !== undefined) updateFields.gender = gender;
    if (age !== undefined) updateFields.age = age;
    if (profession !== undefined) updateFields.profession = profession;
    if (contact !== undefined) updateFields.contact = contact;
    if (address !== undefined) updateFields.address = address;

    // updated timestamp
    updateFields.updatedAt = new Date().toISOString();

    if (Object.keys(updateFields).length === 1) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const result = await usersColl.updateOne({ email }, { $set: updateFields });

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return res.status(500).json({ error: "Failed to update profile" });
  }
};

// Update user email (protected route)
// reauthenticate with oldPassword in client before call this api
const updateUserEmail = async (req, res) => {
  try {
    const email = getUserEmailUtil(req, res);
    const { newEmail } = req.body;

    if (!newEmail) {
      return res.status(400).json({ error: "New email is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if new email already exists
    const emailExists = await usersColl.findOne({ email: newEmail });
    if (emailExists) {
      return res.status(409).json({ error: "Email already exists" });
    }

    // Get Firebase UID from decoded token
    const uid = getUserUidUtil;

    // Update email in Firebase Authentication
    await admin.auth().updateUser(uid, {
      email: newEmail,
    });

    // Update email in MongoDB users collection
    const result = await usersColl.updateOne(
      { email },
      { $set: { email: newEmail, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found in database" });
    }

    // If user is a rider, update email in riders collection too
    const user = await usersColl.findOne({ email: newEmail });
    if (user && user.role === "rider") {
      await ridersColl.updateOne(
        { email },
        { $set: { email: newEmail, updatedAt: new Date().toISOString() } }
      );
    }

    return res.status(200).json({
      message: "Email updated successfully",
      newEmail,
    });
  } catch (error) {
    console.error("Error updating user email:", error);

    // Handle Firebase specific errors
    if (error.code === "auth/email-already-exists") {
      return res
        .status(409)
        .json({ error: "Email already exists in Firebase" });
    }
    if (error.code === "auth/invalid-email") {
      return res.status(400).json({ error: "Invalid email format" });
    }

    return res.status(500).json({ error: "Failed to update email" });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const {
      role = "",
      district = "",
      city = "",
      page = 1,
      limit = 10,
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter
    const filter = {};
    if (role) filter.role = role;
    if (district) filter["details.district"] = district;
    if (city) filter["details.city"] = city;

    const users = await usersColl
      .find(filter, { projection: { _id: 0 } })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await usersColl.countDocuments(filter);

    return res.status(200).json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
};

// Get user by email (admin only)
const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Get user from MongoDB
    const user = await usersColl.findOne({ email }, { projection: { _id: 0 } });

    // Try to get user from Firebase Auth
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUserByEmail(email);
    } catch (err) {
      firebaseUser = null;
    }

    // Case 1: Not in MongoDB but exists in Firebase → delete from Firebase
    if (!user && firebaseUser) {
      await admin.auth().deleteUser(firebaseUser.uid);
      return res.status(410).json({
        error: "User not found in MongoDB, deleted from Firebase",
      });
    }

    // Case 2: Not in Firebase but exists in MongoDB → delete from MongoDB
    if (user && !firebaseUser) {
      await usersColl.deleteOne({ email });
      return res.status(410).json({
        error: "User not found in Firebase, deleted from MongoDB",
      });
    }

    // Case 3: Not in both → return 404
    if (!user && !firebaseUser) {
      return res.status(404).json({ error: "User not found in both systems" });
    }

    // Case 4: Found in both → merge and return
    const enrichedUser = {
      ...user,
      name: firebaseUser.displayName || user.name || null,
      photoURL: firebaseUser.photoURL || null,
      firebaseUid: firebaseUser.uid,
    };

    return res.status(200).json(enrichedUser);
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) return res.status(400).json({ error: "Email is required" });

    // Get user info before deletion
    const user = await usersColl.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Delete from MongoDB
    const result = await usersColl.deleteOne({ email });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json({ error: "Failed to delete user from database" });
    }

    // If user is a rider, delete rider profile too
    if (user.role === "rider") {
      await ridersColl.deleteOne({ email });
    }

    // Delete from Firebase Authentication
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().deleteUser(userRecord.uid);
    } catch (firebaseError) {
      console.error("Error deleting user from Firebase:", firebaseError);
      // Continue even if Firebase deletion fails
    }

    return res.status(200).json({
      message: "User deleted successfully",
      deletedRole: user.role,
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ error: "Failed to delete user" });
  }
};

module.exports = {
  createUser,
  getUserProfile,
  getUserRole,
  updateUserProfile,
  updateUserEmail,
  getAllUsers,
  getUserByEmail,
  deleteUser,
};
