const express = require("express");
const { getWareHouseColl } = require("../controllers/wareHousesController");
const router = express.Router();

router.get("/", getWareHouseColl);

module.exports = router;
