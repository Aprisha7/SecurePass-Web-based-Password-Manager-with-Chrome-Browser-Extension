const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    match: /.+\@.+\..+/
  },
  masterPassword: { type: String, required: true },
  
  role: { 
    type: String, 
    enum: ['user', 'admin'],  
    default: "user" 
  },

  // Add this to your existing UserSchema
pinEnabled: { type: Boolean, default: false },
pinHash: { type: String }, // Store hashed PIN
lastUnlock: { type: Date },

  twoFactorSecret: { type: String }, // TOTP secret (encrypted)
  twoFactorEnabled: { type: Boolean, default: false },
  backupCodes: [{ type: String }], // Hashed backup codes
  
},
 { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
