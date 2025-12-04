const { client } = require("../config/db");
const { ObjectId } = require("mongodb");
const { getUserEmail } = require("../middleware/utils");

const parcelsColl = client.db("ProFastDB").collection("parcels");

// ✅ Define getStatusCount
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

const getMyParcels = async (req, res) => {
  try {
    const email = getUserEmail(req, res);
    const parcels = await parcelsColl.find({ created_by: email }).toArray();
    res.status(200).json(parcels);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch parcels" });
  }
};

const getParcels = async (req, res) => {
  try {
    const { email, delivery_status, payment_status } = req.query;
    let query = {};
    if (email) query.created_by = email;
    if (delivery_status) query.delivery_status = delivery_status;
    if (payment_status) query.payment_status = payment_status;
    const parcels = await parcelsColl.find(query).toArray();
    res.status(200).json(parcels);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch parcels" });
  }
};

const getParcelById = async (req, res) => {
  try {
    const email = getUserEmail(req, res);
    const id = req.params.id;
    const query = { _id: new ObjectId(id), created_by: email };
    const result = await parcelsColl.findOne(query);
    if (!result) return res.status(404).json({ error: "Parcel not found" });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const createParcel = async (req, res) => {
  try {
    const email = getUserEmail(req, res);
    const parcelData = { ...req.body, created_by: email };
    const result = await parcelsColl.insertOne(parcelData);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create parcel" });
  }
};

const updateParcel = async (req, res) => {
  try {
    const email = getUserEmail(req, res);
    const id = req.params.id;
    const updatedData = req.body;
    delete updatedData._id;
    const query = { _id: new ObjectId(id), created_by: email };
    const result = await parcelsColl.updateOne(query, { $set: updatedData });
    if (result.matchedCount === 0) return res.status(404).json({ error: "Parcel not found" });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update parcel!" });
  }
};

const assignRider = async (req, res) => {
  try {
    const parcelId = req.params.id;
    const riderInfo = req.body;
    if (!riderInfo || !riderInfo.email) {
      return res.status(400).json({ error: "Rider information is missing!" });
    }

    const query = { _id: new ObjectId(parcelId) };
    const updateDoc = {
      $set: {
        delivery_status: "way-to-collect",
        assigned_rider: riderInfo,
        assigned_at: new Date(),
      },
    };

    const result = await parcelsColl.updateOne(query, updateDoc);
    if (result.matchedCount === 0) return res.status(404).json({ error: "Parcel not found!" });

    res.status(200).json({ success: true, message: "Rider assigned successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to assign rider!" });
  }
};

const deleteParcel = async (req, res) => {
  try {
    const email = getUserEmail(req, res);
    const id = req.params.id;
    const query = { _id: new ObjectId(id), created_by: email };
    const result = await parcelsColl.deleteOne(query);
    if (result.deletedCount === 0) return res.status(404).json({ error: "Parcel not found" });
    res.status(200).json({ message: "Parcel deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Something went wrong while deleting parcel!" });
  }
};

module.exports = {
  getStatusCount,
  getMyParcels,
  getParcels,
  getParcelById,
  createParcel,
  updateParcel,
  assignRider,
  deleteParcel,
};
