const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Password = require("../models/Password");
const authMiddleware = require("../middleware/auth");  
const { adminMiddleware } = require("../middleware/admin"); 

// GET ALL USERS (admin only)
router.get("/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find({}).select('-masterPassword -salt -__v');
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET STATS (admin only)
router.get("/stats", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalRegular = totalUsers - totalAdmins;
    
    const totalPasswords = await Password.countDocuments();

    res.json({
      totalUsers,
      totalAdmins,
      totalRegular,
      totalPasswords
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PROMOTE USER
router.put("/promote", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ error: "Cannot promote yourself" });
    }
    
    user.role = "admin";
    await user.save();
    res.json({ message: `${email} has been promoted to admin` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DEMOTE USER
router.put("/demote", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ error: "Cannot demote yourself" });
    }

    user.role = "user";
    await user.save();
    res.json({ message: `${email} has been demoted to user` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE USER (admin only)
router.delete("/user/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }
    
    // Delete all passwords associated with this user
    await Password.deleteMany({ userId: userId });
    
    // Delete the user
    await User.findByIdAndDelete(userId);

    res.json({ message: "User deleted successfully" });
    
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
