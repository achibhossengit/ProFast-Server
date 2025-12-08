const { client } = require("../config/db");
const warehouseColl = client.db("ProFastDB").collection("warehouses");

const getWareHouseColl = async (req, res) => {
  try {
    const warehouses = await warehouseColl.find().toArray();
    return res.status(200).json(warehouses);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getWareHouseColl };
