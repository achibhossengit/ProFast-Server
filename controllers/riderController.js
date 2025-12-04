const applyRider = async (req, res) => {
  try {
    const email = getUserEmail(req, res);
    const existing = await ridersColl.findOne({ email });
    if (existing) return res.status(409).json({ message: "You have already applied." });

    const newRider = { ...req.body, email, appliedAt: new Date().toISOString() };
    const result = await ridersColl.insertOne(newRider);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to submit application" });
  }
};

const getRiders = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    if (status) query.status = status;
    const riders = await ridersColl.find(query).toArray();
    res.status(200).json(riders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch riders" });
  }
};

const getAvailableRiders = async (req, res) => {
  try {
    const { status, warehouse_district } = req.query;
    let query = {};
    if (status) query.status = status;
    if (warehouse_district) query.warehouse_district = warehouse_district;
    const riders = await ridersColl.find(query).toArray();
    res.status(200).json(riders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch riders" });
  }
};

const updateRider = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;
    if (!["active", "deactive"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const query = { _id: new ObjectId(id) };
    const riderUser = await ridersColl.findOne(query);
    if (!riderUser) return res.status(404).json({ error: "Rider not found" });

    const role = status === "active" ? "rider" : "user";
    await ridersColl.updateOne(query, { $set: { status } });
    if (riderUser.email) {
      await usersColl.updateOne({ email: riderUser.email }, { $set: { role } });
    }

    res.status(200).json({ success: true, message: "Rider updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteRider = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await ridersColl.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Rider not found" });
    res.status(200).json({ message: "Rider deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete rider" });
  }
};

const getRiderParcels = async (req, res) => {
  try {
    const email = req.user.email;
    const query = {
      "assigned_rider.email": email,
      delivery_status: { $in: ["way-to-collect", "in-transit"] },
    };
    const parcels = await parcelsColl.find(query).sort({ createdAt: -1 }).toArray();
    res.status(200).json(parcels);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateParcelStatus = async (req, res) => {
  try {
    const parcelId = req.params.id;
    const email = req.user.email;
    const { delivery_status } = req.body;
    const allowedStatuses = ["in-transit", "delivered"];
    if (!allowedStatuses.includes(delivery_status)) {
      return res.status(400).json({ message: "Invalid delivery status." });
    }

    const parcel = await parcelsColl.findOne({
      _id: new ObjectId(parcelId),
      "assigned_rider.email": email,
    });
    if (!parcel) return res.status(404).json({ message: "Parcel not found or unauthorized." });

    await parcelsColl.updateOne({ _id: new ObjectId(parcelId) }, { $set: { delivery_status } });
    res.status(200).json({ message: "Delivery status updated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const getDeliveredParcels = async (req, res) => {
  try {
    const email = req.user.email;
    const query = { "assigned_rider.email": email, delivery_status: "delivered" };
    const parcels = await parcelsColl.find(query).sort({ createdAt: -1 }).toArray();
    res.status(200).json(parcels);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const cashoutParcel = async (req, res) => {
  try {
    const parcelId = req.params.id;
    const email = req.user.email;
    const filter = { _id: new ObjectId(parcelId), "assigned_rider.email": email };
    const update = { $set: { cashout_status: "cashed_out" } };
    const result = await parcelsColl.updateOne(filter, update);
    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Parcel not found or already cashed out" });
    }
    res.status(200).json({ message: "Cashout successful" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  applyRider,
  getRiders,
  getAvailableRiders,
  updateRider,
  deleteRider,
  getRiderParcels,
  updateParcelStatus,
  getDeliveredParcels,
  cashoutParcel,
};
