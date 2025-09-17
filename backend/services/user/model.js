import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  profile: {
    avatar: String,
    bio: String,
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Index for better performance
userSchema.index({ email: 1 })
userSchema.index({ createdAt: -1 })

// Virtual for user ID
userSchema.virtual('id').get(function() {
  return this._id.toHexString()
})

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject()
  delete user.password
  delete user.__v
  return user
}

const User = mongoose.model('User', userSchema)

export default User
