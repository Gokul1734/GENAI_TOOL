import mongoose from 'mongoose'

const authTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['access', 'refresh', 'password_reset', 'email_verification'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    device: String
  }
}, {
  timestamps: true
})

// Index for better performance
authTokenSchema.index({ token: 1 })
authTokenSchema.index({ userId: 1 })
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const AuthToken = mongoose.model('AuthToken', authTokenSchema)

export default AuthToken
