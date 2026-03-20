const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Password = require("../models/Password");
const authMiddleware = require("../middleware/auth");  
const { encrypt, decrypt } = require("../utils/encryption");
const zxcvbn = require("zxcvbn");

// ===========================
// ADD PASSWORD
// ===========================
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const { website, username, password } = req.body;

    // Accepts only full URL
    const urlPattern = /^https?:\/\/.+/i;
    if (!urlPattern.test(website)) {
      return res.status(400).json({ 
        error: "Full URL required (https://example.com)" 
      });
    }
    
    if (!website || !username || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const encryptedPassword = encrypt(password);

    const newPass = new Password({
      userId: req.user.id,
      website,
      username,
      password: encryptedPassword,
    });

    await newPass.save();

    res.json({
      message: "Password saved successfully",
      password: {
        id: newPass._id,
        website: newPass.website,
        username: newPass.username,
        password, // plain for UI
        createdAt: newPass.createdAt,
        updatedAt: newPass.updatedAt,
      },
    });
  } catch (err) {
    console.error("Add password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===========================
// GET ALL PASSWORDS 
// ===========================
router.get("/", authMiddleware, async (req, res) => {
  try {
    let query = { userId: req.user.id };  
    
    if (req.user.role === 'admin') {
      query = {};
    }

    const passwords = await Password.find(query);
    
    if (!passwords || passwords.length === 0) {
      return res.json([]);  
    }

    // Only decrypt VALID passwords (password field exists)
    const decryptedList = passwords
      .filter(item => item.password && typeof item.password === 'string')
      .map((item) => {
        try {
          return {
            id: item._id,
            website: item.website,
            username: item.username,
            password: decrypt(item.password),  
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          };
        } catch (decryptError) {
          console.log(`Decrypt failed for ${item._id}:`, decryptError.message);
          return null;  // Skip corrupted entries
        }
      })
      .filter(Boolean);  // Remove null entries

    res.json(decryptedList);
  } catch (err) {
    console.error("Get passwords error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===========================
// DELETE PASSWORD 
// ===========================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid password ID" });

    let query = { _id: id, userId: req.user.id };
    
    if (req.user.role === 'admin') {
      query = { _id: id };
    }

    const deleted = await Password.findOneAndDelete(query);

    if (!deleted) return res.status(404).json({ error: "Password not found" });

    res.json({ message: "Password deleted successfully" });
  } catch (err) {
    console.error("Delete password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===========================
// UPDATE PASSWORD
// ===========================
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { website, username, password } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid password ID" });

    let query = { _id: id, userId: req.user.id };
    
    if (req.user.role === 'admin') {
      query = { _id: id };
    }

    const updatedFields = {};
    if (website) updatedFields.website = website;
    if (username) updatedFields.username = username;
    if (password) updatedFields.password = encrypt(password);
    updatedFields.updatedAt = new Date();

    const updatedPassword = await Password.findOneAndUpdate(
      query,
      updatedFields,
      { new: true }
    );

    if (!updatedPassword)
      return res.status(404).json({ error: "Password not found" });

    res.json({
      message: "Password updated successfully",
      updated: {
        id: updatedPassword._id,
        website: updatedPassword.website,
        username: updatedPassword.username,
        password: password || decrypt(updatedPassword.password),
        createdAt: updatedPassword.createdAt,
        updatedAt: updatedPassword.updatedAt,
      },
    });
  } catch (err) {
    console.error("Update password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===========================
// GENERATE PASSWORD
// ===========================
router.get("/generate", authMiddleware, (req, res) => {
  const length = parseInt(req.query.length) || 16;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}<>?";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  res.json({ generatedPassword: password });
});

// ===========================
// CHECK STRENGTH
// ===========================
router.post("/check-strength", authMiddleware, (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password is required" });

  const result = zxcvbn(password);
  let strength = "Weak";
  let feedback = result.feedback.suggestions;

  if (result.score === 3) {
    strength = "Medium";
    if (feedback.length === 0) feedback.push("Consider adding symbols.");
  }
  if (result.score === 4) {
    strength = "Strong";
    if (feedback.length === 0) feedback.push("Strong password!");
  }
  if (result.score < 3 && feedback.length === 0) {
    feedback.push("Use uppercase, lowercase, numbers, symbols.");
  }

  res.json({ strength, score: result.score, feedback, crackTimesDisplay: result.crack_times_display });
});

module.exports = router;
