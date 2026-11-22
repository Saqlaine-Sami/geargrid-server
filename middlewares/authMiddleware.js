const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
    );
    req.decoded = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
  }
};

const verifyRenter = async (req, res, next) => {
  try {
    const user = await req.db.collection("users").findOne({ email: req.decoded.email });
    const role = user?.role || "Customer";
    if (!user || (role !== "Customer" && role !== "Renter")) {
      return res.status(403).json({ message: "Forbidden: Customer/Renter access only" });
    }
    req.currentUser = user;
    next();
  } catch (error) {
    return res.status(500).json({ message: "Role verification failed" });
  }
};

const verifyOwner = async (req, res, next) => {
  try {
    const user = await req.db.collection("users").findOne({ email: req.decoded.email });
    if (!user || user.role !== "Owner") {
      return res.status(403).json({ message: "Forbidden: Owner access only" });
    }
    req.currentUser = user;
    next();
  } catch (error) {
    return res.status(500).json({ message: "Role verification failed" });
  }
};

const verifyAdmin = async (req, res, next) => {
  try {
    const user = await req.db.collection("users").findOne({ email: req.decoded.email });
    if (!user || user.role !== "Admin") {
      return res.status(403).json({ message: "Forbidden: Admin access only" });
    }
    req.currentUser = user;
    next();
  } catch (error) {
    return res.status(500).json({ message: "Role verification failed" });
  }
};

module.exports = { verifyToken, verifyRenter, verifyOwner, verifyAdmin };
