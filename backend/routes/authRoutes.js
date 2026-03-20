const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const authMiddleware = require("../middleware/auth"); 

// REGISTER ROUTE
router.post("/register", async (req, res) => {
  try {
    const { email, masterPassword } = req.body;
    if (!email || !masterPassword) {
      return res.status(400).json({ error: "Email and master password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(masterPassword, 10);

    // Auto-admin for first user
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? "admin" : "user";

    const user = new User({
      email: normalizedEmail,
      masterPassword: hashedPassword,
      role  // Set role
    });

    await user.save();
    res.json({ message: `User registered successfully as ${role}` ,
    user: {
        id: user._id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// LOGIN ROUTE 
router.post("/login", async (req, res) => {
  try {
    const { email, masterPassword } = req.body;
    if (!email || !masterPassword) {
      return res.status(400).json({ error: "Email and master password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(masterPassword, user.masterPassword);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      return res.json({ 
        requiresTwoFactor: true, 
        email: user.email 
      });
    }

    // No 2FA - generate token directly
    const token = jwt.sign(
      {
        id: user._id,
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ 
      message: "Login successful", 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role 
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


    // Verify 2FA and login in one call (ADD THIS)
router.post("/verify-2fa-login", async (req, res) => {
  try {
    const { email, masterPassword, token, isBackupCode } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(masterPassword, user.masterPassword);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    
    // Verify 2FA
    let twoFactorValid = false;
    
    if (isBackupCode) {
      // Check backup codes
      for (let i = 0; i < user.backupCodes.length; i++) {
        const match = await bcrypt.compare(token, user.backupCodes[i]);
        if (match) {
          twoFactorValid = true;
          // Remove used backup code
          user.backupCodes.splice(i, 1);
          await user.save();
          break;
        }
      }
    } else {
      // Verify TOTP
      twoFactorValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 2
      });
    }
    
    if (!twoFactorValid) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Include role in JWT
    const jwtToken = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

    res.json({ 
      message: "Login successful", 
      token: jwtToken, 
      user: { id: user._id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
/*
// Check if PIN is enabled for a specific email (without authentication)
router.post("/pin-status-by-email", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.json({ enabled: false });
    }
    
    res.json({ enabled: user.pinEnabled || false });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/pin-status", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ enabled: user.pinEnabled || false });
  } catch (error) {
    console.error("PIN status error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
/*
// Setup PIN
router.post("/setup-pin", authMiddleware, async (req, res) => {
  try {
    const { pin } = req.body;
    
    if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      return res.status(400).json({ error: "PIN must be 4-6 digits" });
    }
    
    const hashedPin = await bcrypt.hash(pin, 10);
    
    const user = await User.findById(req.user.id);
    user.pin = hashedPin;
    user.pinEnabled = true;
    await user.save();
    
    res.json({ message: "PIN enabled successfully" });
  } catch (error) {
    console.error("PIN setup error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Verify PIN
router.post("/verify-pin", async (req, res) => {
  try {
    const { email, pin } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "User not found" }); // Add this
    }
    if (!user.pinEnabled) {
      return res.status(400).json({ error: "PIN not enabled" });
    }
    
    const isValid = await bcrypt.compare(pin, user.pin);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid PIN" });
    }
    
    // Generate token
    const token = jwt.sign(
      {
        id: user._id,
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Disable PIN
router.post("/disable-pin", authMiddleware, async (req, res) => {
  try {
    const { pin } = req.body;
    const user = await User.findById(req.user.id);
    if (!user.pinEnabled) {
      return res.status(400).json({ error: "PIN not enabled" });
    }
    
    const isValid = await bcrypt.compare(pin, user.pin);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid PIN" });
    }
    
    user.pin = null;
    user.pinEnabled = false;
    await user.save();
    
    res.json({ message: "PIN disabled successfully" });
  } catch (error) {
    console.error("PIN disable error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
*/
// Verify master password (for re-authentication)
router.post("/verify-password", authMiddleware, async (req, res) => {
  try {
    const { email, masterPassword } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ valid: false });
    }
    
    const isMatch = await bcrypt.compare(masterPassword, user.masterPassword);
    
    res.json({ valid: isMatch });
  } catch (err) {
    console.error("Password verification error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
