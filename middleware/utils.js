const getUserEmail = (req, res) => {
  const email = req.user?.email;
  if (!email) {
    res.status(403).json({ error: "User email not found!" });
    throw new Error("Email missing");
  }
  return email;
};

module.exports = { getUserEmail };
