const Password = require("../models/Password");
const User = require("../models/User");

// GET /passwords - Users: own only, Admin: All
exports.getPasswords = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'user') {
      query.userId = req.user.id;  
    }
    // Admin sees ALL (no filter)
    
    const passwords = await Password.find(query).populate('userId', 'email');
    res.json(passwords);
  } catch (error) {
    console.error("Get passwords error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// POST /passwords - Always for current user
exports.createPassword = async (req, res) => {
  try {
    const password = new Password({
      ...req.body,
      userId: req.user.id  
    });
    await password.save();
    const populated = await Password.findById(password._id).populate('userId', 'email');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// PUT /passwords/:id - Users: own only, Admin: any
exports.updatePassword = async (req, res) => {
  try {
    const passwordId = req.params.id;
    
    if (req.user.role === 'user') {
      // Users check ownership
      const password = await Password.findOne({ _id: passwordId, userId: req.user.id });
      if (!password) return res.status(404).json({ error: "Password not found" });
    }
    
    const updated = await Password.findByIdAndUpdate(passwordId, req.body, { 
      new: true,
      runValidators: true 
    }).populate('userId', 'email');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// DELETE /passwords/:id 
exports.deletePassword = async (req, res) => {
  try {
    const passwordId = req.params.id;
    
    if (req.user.role === 'user') {
      const password = await Password.findOneAndDelete({ 
        _id: passwordId, 
        userId: req.user.id 
      });
      if (!password) return res.status(404).json({ error: "Password not found" });
    } else {
      await Password.findByIdAndDelete(passwordId);  // Admin deletes any
    }
    
    res.json({ message: "Password deleted" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};
