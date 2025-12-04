const verifyAdmin = (req, res, next) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden access" });
  next();
};

const verifyRider = (req, res, next) => {
  if (req.user.role !== "rider") return res.status(403).json({ message: "Forbidden access" });
  next();
};

module.exports = { verifyAdmin, verifyRider };
