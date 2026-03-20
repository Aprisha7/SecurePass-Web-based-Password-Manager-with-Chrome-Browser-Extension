const express = require("express");
const router = express.Router();
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");  
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
console.log("✅ 2FA ROUTES LOADED!");

// GET 2FA STATUS 
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('twoFactorEnabled');
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ 
      enabled: user.twoFactorEnabled || false 
    });
  } catch (error) {
    console.error("2FA status error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ===========================
// GENERATE 2FA SECRET & QR CODE
// ===========================
router.post("/setup", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `SecurePass (${user.email})`,
      issuer: "SecurePass"
    });
    
    // Store secret (you can encrypt this for extra security)
    user.twoFactorSecret = secret.base32;
    await user.save();
    
    // Generate QR code as data URL
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
    
    res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl,
      otpauthUrl: secret.otpauth_url
    });
    
  } catch (error) {
    console.error("2FA setup error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ===========================
// VERIFY AND ENABLE 2FA
// ===========================
router.post("/verify", authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user.twoFactorSecret) {
      return res.status(400).json({ error: "2FA not set up" });
    }
    
    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 1 // Allows 30 seconds of drift
    });
    
    if (verified) {
      // Generate 8 backup codes (plain text for user, hashed in DB)
      const plainBackupCodes = [];
      const hashedBackupCodes = [];
      
      for (let i = 0; i < 8; i++) {
        // Generate random 8-character code (e.g., XXXX-XXXX)
        const code = Math.random().toString(36).substring(2, 6).toUpperCase() + 
                     "-" + 
                     Math.random().toString(36).substring(2, 6).toUpperCase();
        plainBackupCodes.push(code);
        
        // Hash the backup code for storage
        const hashed = await bcrypt.hash(code, 10);
        hashedBackupCodes.push(hashed);
      }
      
      user.twoFactorEnabled = true;
      user.backupCodes = hashedBackupCodes;
      await user.save();
      
      // Send plain backup codes to user (only once!)
      res.json({
        success: true,
        message: "2FA enabled successfully",
        backupCodes: plainBackupCodes
      });
    } else {
      res.status(400).json({ error: "Invalid verification code" });
    }
    
  } catch (error) {
    console.error("2FA verify error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ===========================
// VERIFY 2FA DURING LOGIN
// ===========================
// VERIFY 2FA AND LOGIN
router.post("/verify-login", async (req, res) => {
  try {
    const { email, token, isBackupCode } = req.body;
    console.log("=================================");
    console.log("2FA Verification attempt:");
    console.log("Email:", email);
    console.log("Token received:", token);
    console.log("Is backup code:", isBackupCode);

    const user = await User.findOne({ email });
    
    if (!user) {
      console.log("❌ User not found");
      return res.status(400).json({ error: "User not found" });
    }
    
    console.log("User found:", user.email);
    console.log("2FA Enabled:", user.twoFactorEnabled);
    console.log("Stored secret:", user.twoFactorSecret);
    
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      console.log("❌ 2FA not properly enabled");
      return res.status(400).json({ error: "2FA not enabled" });
    }
    
    if (isBackupCode) {
      console.log("Checking backup codes...");
      // Check backup codes
      for (let i = 0; i < user.backupCodes.length; i++) {
        const match = await bcrypt.compare(token, user.backupCodes[i]);
        if (match) {
          console.log("✅ Valid backup code found at index", i);
          user.backupCodes.splice(i, 1);
          await user.save();
          
          // ✅ Generate JWT token for backup code success
          const jwtToken = jwt.sign(
            {
              id: user._id,
              userId: user._id,
              email: user.email,
              role: user.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
          );
          
          return res.json({ 
            success: true, 
            token: jwtToken,
            user: { 
              id: user._id, 
              email: user.email, 
              role: user.role 
            },
            remainingCodes: user.backupCodes.length 
          });
        }
      }
      console.log("❌ No matching backup code");
    } else {
      console.log("Verifying TOTP code...");
      
      // Generate the expected code for debugging
      const expectedToken = speakeasy.totp({
        secret: user.twoFactorSecret,
        encoding: 'base32'
      });
      console.log("Expected token at this time:", expectedToken);
      console.log("Provided token:", token);
      
      // Try with different window sizes
      for (let window = 0; window <= 5; window++) {
        const verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token: token,
          window: window
        });
        console.log(`Window size ${window}: ${verified ? '✅ VALID' : '❌ invalid'}`);
        
        if (verified) {
          console.log(`✅ Verified with window size ${window}`);
          
          // ✅ Generate JWT token for TOTP success
          const jwtToken = jwt.sign(
            {
              id: user._id,
              userId: user._id,
              email: user.email,
              role: user.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
          );
          
          return res.json({ 
            success: true,
            token: jwtToken,
            user: { 
              id: user._id, 
              email: user.email, 
              role: user.role 
            }
          });
        }
      }
      
      console.log("❌ TOTP verification failed with all window sizes");
    }
    
    return res.status(400).json({ error: "Invalid verification code" });
    
  } catch (error) {
    console.error("2FA verify error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ===========================
// DISABLE 2FA
// ===========================
router.post("/disable", authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: "2FA is not enabled" });
    }

    // Verify token before disabling
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 4
    });
    
    if (verified) {
      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      user.backupCodes = [];
      await user.save();
      
      res.json({ success: true, message: "2FA disabled successfully" });
    } else {
      res.status(400).json({ error: "Invalid verification code" });
    }
    
  } catch (error) {
    console.error("2FA disable error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ===========================
// GET 2FA STATUS
// ===========================
router.get("/debug-secret", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorSecret: user.twoFactorSecret,
      hasBackupCodes: user.backupCodes?.length > 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resync 2FA without resetting (fix time drift/mismatch)
router.post("/resync", authMiddleware, async (req, res) => {
  try {
    const { token1, token2 } = req.body; // Two consecutive codes
    const user = await User.findById(req.user.id);
    
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: "2FA not enabled" });
    }
    
    // Try to verify with larger window
    const verified1 = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token1,
      window: 4
    });
    
    const verified2 = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token2,
      window: 4
    });
    
    if (verified1 && verified2) {
      // Codes work - just time drift
      res.json({ 
        success: true, 
        message: "2FA is working. Your device time may be slightly off.",
        needsSync: false
      });
    } else {
      // Try to find which code works
      let workingWindow = -1;
      for (let w = 0; w <= 10; w++) {
        if (speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token: token1,
          window: w
        })) {
          workingWindow = w;
          break;
        }
      }
      
      if (workingWindow >= 0) {
        res.json({
          success: true,
          message: `Your 2FA works with window size ${workingWindow}. Update your verification window.`,
          recommendedWindow: workingWindow
        });
      } else {
        res.status(400).json({ 
          error: "Cannot resync. Please reset 2FA.",
          needsReset: true 
        });
      }
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;