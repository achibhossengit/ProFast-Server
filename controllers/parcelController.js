const { client } = require("../config/db");
const { ObjectId } = require("mongodb");
const { getUserEmailUtil, getUserRoleUtil } = require("../middleware/utils");

const parcelsColl = client.db("ProFastDB").collection("parcels");
const userColl = client.db("ProFastDB").collection("users");

const getParcels = async (req, res) => {
  try {
    const authRole = await getUserRoleUtil(req); // "admin", "rider", "user"
    const userEmail = req.user?.email;
    const {
      email,
      delivery_status,
      payment_status,
      assigned_to_collect,
      page = 1,
      limit = 10,
    } = req.query;

    let query = {};

    // Role-based restrictions
    if (authRole === "admin") {
      if (email) query.created_by = email;
      if (assigned_to_collect) query.assigned_to_collect = assigned_to_collect;
    } else if (authRole === "rider") {
      query.$or = [
        { assigned_to_collect: userEmail },
        { assigned_to_deliver: userEmail },
      ];
    } else if (authRole === "user") {
      query.created_by = userEmail;
    }

    // Common filters
    if (delivery_status) query.delivery_status = delivery_status;
    if (payment_status) query.payment_status = payment_status;

    // Convert page/limit to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch paginated results
    const parcels = await parcelsColl
      .find(query)
      .skip(skip)
      .limit(limitNum)
      .toArray();

    // Count total for pagination metadata
    const totalCount = await parcelsColl.countDocuments(query);

    res.status(200).json({
      data: parcels,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch parcels" });
  }
};

const getParcelById = async (req, res) => {
  try {
    const { id } = req.params;
    const authEmail = getUserEmailUtil(req, res);
    const authRole = getUserRoleUtil(req);

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid parcel ID" });
    }

    // Fetch parcel by ID
    const query = { _id: new ObjectId(id) };
    const parcel = await parcelsColl.findOne(query);

    if (!parcel) {
      return res.status(404).json({ error: "Parcel not found" });
    }

    // Role-based access control
    if (
      authRole === "rider" &&
      (parcel.assigned_to_collect !== authEmail ||
        parcel.assigned_to_deliver !== authEmail)
    ) {
      return res.status(403).json({
        error: "Access denied: Rider can only view their assigned parcels",
      });
    }

    if (authRole === "user" && parcel.created_by !== authEmail) {
      return res
        .status(403)
        .json({ error: "Access denied: User can only view their own parcels" });
    }

    // Admin has unrestricted access
    res.status(200).json(parcel);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const createParcel = async (req, res) => {
  try {
    const email = getUserEmailUtil(req, res);
    const parcelData = { ...req.body, created_by: email };
    const result = await parcelsColl.insertOne(parcelData);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create parcel" });
  }
};

const updateParcel = async (req, res) => {
  try {
    const email = getUserEmailUtil(req, res);
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid parcel ID" });
    }

    const query = { _id: new ObjectId(id), created_by: email };
    const parcel = await parcelsColl.findOne(query);

    if (!parcel) {
      return res.status(404).json({ error: "Parcel not found" });
    }

    // Check status restrictions
    if (
      !(
        parcel.delivery_status === "pending" &&
        parcel.payment_status === "unpaid"
      )
    ) {
      return res.status(403).json({
        error:
          "Parcel cannot be updated unless status is 'pending' and payment is 'unpaid'.",
      });
    }

    const updatedData = req.body;
    delete updatedData._id;

    const result = await parcelsColl.updateOne(query, { $set: updatedData });

    res.status(200).json({ message: "Parcel updated successfully", result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update parcel!" });
  }
};

const deleteParcel = async (req, res) => {
  try {
    const email = getUserEmailUtil(req, res);
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid parcel ID" });
    }

    const query = { _id: new ObjectId(id), created_by: email };
    const parcel = await parcelsColl.findOne(query);

    if (!parcel) {
      return res.status(404).json({ error: "Parcel not found" });
    }

    // Check status restrictions
    if (
      !(
        parcel.delivery_status === "pending" &&
        parcel.payment_status === "unpaid"
      )
    ) {
      return res.status(403).json({
        error:
          "Parcel cannot be deleted unless status is 'pending' and payment is 'unpaid'.",
      });
    }

    const result = await parcelsColl.deleteOne(query);
    res.status(200).json({ message: "Parcel deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Something went wrong while deleting parcel!" });
  }
};

const assignRider = async (req, res) => {
  try {
    const { id, rider_email } = req.params;

    // Validate rider existence
    const rider = await userColl.findOne({ email: rider_email, role: "rider" });
    if (!rider) {
      return res.status(404).json({ error: "No rider found with this email" });
    }

    // Validate parcel ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid parcel ID" });
    }

    const query = { _id: new ObjectId(id) };
    const parcel = await parcelsColl.findOne(query);
    if (!parcel) {
      return res.status(404).json({ error: "Parcel not found!" });
    }

    // Decide assignment field and status
    const isPending = parcel.delivery_status === "pending";
    const field = isPending ? "assigned_to_collect" : "assigned_to_deliver";
    const status = isPending ? "collecting" : "delivering";

    // Build updateDoc in one go
    const updateDoc = {
      $set: {
        delivery_status: status,
        [field]: rider.email, // dynamic key
        assigned_at: new Date(),
      },
    };

    // Update parcel
    const result = await parcelsColl.updateOne(query, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Parcel not found!" });
    }

    // Success response
    res.status(200).json({
      success: true,
      message: `Rider ${rider.email} assigned successfully!`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to assign rider!" });
  }
};

const updateParcelStatus = async (req, res) => {
  try {
    const authEmail = getUserEmailUtil(req, res);
    const { id } = req.params;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid parcel ID." });
    }

    const objId = new ObjectId(id);

    // Find parcel restricted to rider
    const parcel = await parcelsColl.findOne({
      _id: objId,
      $or: [
        { assigned_to_collect: authEmail },
        { assigned_to_deliver: authEmail },
      ],
    });

    if (!parcel) {
      return res
        .status(404)
        .json({ message: "Parcel not found or unauthorized." });
    }

    const { delivery_status, sender_district, receiver_district } = parcel;

    // Determine next status
    let new_status = "";
    let updateData = {
      $set: { updated_at: new Date() },
    };

    if (delivery_status === "collecting") {
      new_status = "collected";
    } else if (
      delivery_status === "collected" &&
      sender_district !== receiver_district
    ) {
      new_status = "sendWarehouse";
    } else if (
      delivery_status === "collected" &&
      sender_district === receiver_district
    ) {
      new_status = "delivering";
      updateData.$set.assigned_to_deliver = authEmail;
    } else if (delivery_status === "delivering") {
      new_status = "delivered"; // fixed spelling
    }

    if (!new_status) {
      return res.status(400).json({ message: "Invalid status transition." });
    }

    // Add new status to updateData
    updateData.$set.delivery_status = new_status;

    // Update parcel
    const result = await parcelsColl.updateOne({ _id: objId }, updateData);

    if (result.modifiedCount === 0) {
      return res.status(500).json({ message: "Failed to update status." });
    }

    // Success
    res.status(200).json({
      success: true,
      message: `Parcel status updated to '${new_status}' successfully.`,
    });
  } catch (error) {
    console.error("Error updating parcel status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Define getStatusCount
const getStatusCount = async (req, res) => {
  try {
    const pipeline = [
      { $group: { _id: "$delivery_status", count: { $sum: 1 } } },
      { $project: { _id: 0, status: "$_id", count: 1 } },
      { $sort: { status: 1 } },
    ];
    const result = await parcelsColl.aggregate(pipeline).toArray();
    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting parcel status counts:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


const getRiderEarnings = async (req, res) => {
  try {
    const riderEmail = getUserEmailUtil(req, res);

    // Fetch all parcels where rider is either collector or deliverer
    const parcels = await parcelsColl
      .find({
        $or: [
          { assigned_to_collect: riderEmail },
          { assigned_to_deliver: riderEmail },
        ],
      })
      .toArray();

    let totalCollectedParcel = 0;
    let totalDeliveredParcel = 0;
    let collectedParcelEarning = 0;
    let deliveredParcelEarning = 0;

    parcels.forEach((parcel) => {
      const cost = Number(parcel.cost) || 0;

      if (parcel.assigned_to_collect === riderEmail) {
        totalCollectedParcel += 1;
        collectedParcelEarning += cost * 0.35;
      }

      if (parcel.assigned_to_deliver === riderEmail) {
        totalDeliveredParcel += 1;
        deliveredParcelEarning += cost * 0.35;
      }
    });

    const totalEarning = collectedParcelEarning + deliveredParcelEarning;

    res.status(200).json({
      total_collected_parcel: totalCollectedParcel,
      total_delivered_parcel: totalDeliveredParcel,
      collected_parcel_earning: collectedParcelEarning,
      delivered_parcel_earning: deliveredParcelEarning,
      total_earning: totalEarning,
    });
  } catch (error) {
    console.error("Error calculating rider earnings:", error);
    res.status(500).json({ error: "Failed to calculate rider earnings" });
  }
};


module.exports = {
  getStatusCount,
  getParcels,
  getParcelById,
  createParcel,
  updateParcel,
  assignRider,
  updateParcelStatus,
  deleteParcel,
  getRiderEarnings
};
