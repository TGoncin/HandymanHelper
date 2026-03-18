const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true, 
    lowercase: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['CLIENT', 'CONTRACTOR'], 
    default: 'CLIENT' 
  },
  
  // VERIFICATION FIELDS
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  licenseNumber: { 
    type: String, 
    default: "" 
  },
  idPhotoPath: { 
    type: String, 
    default: "" // This stores the filename of the camera photo
  },
  instagram: { 
    type: String, 
    default: "" 
  },
  
  // RATING SYSTEM (Repurposing the 'Score' logic)
  ratings: [{
    from: String, // Username of the person who rated
    score: { type: Number, min: 1, max: 5 },
    comment: String,
    date: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('User', UserSchema);