import User from '../user/model.js'
import AuthToken from './model.js'
import crypto from 'crypto'

// Register user
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      })
    }

    // Create new user
    const user = new User({
      name,
      email,
      password
    })

    await user.save()

    // Generate auth token
    const token = generateToken()
    
    // Save token
    const authToken = new AuthToken({
      userId: user._id,
      token,
      type: 'access',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    })

    await authToken.save()

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        token
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message)
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      })
    }

    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    })
  }
}

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user by email
    const user = await User.findOne({ email, isActive: true })
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      })
    }

    // Simple password check (in production, use bcrypt)
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      })
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save()

    // Generate auth token
    const token = generateToken()
    
    // Save token
    const authToken = new AuthToken({
      userId: user._id,
      token,
      type: 'access',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    })

    await authToken.save()

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    })
  }
}

// Logout user
export const logout = async (req, res) => {
  try {
    const { token } = req.body

    // Mark token as used
    await AuthToken.findOneAndUpdate(
      { token, isUsed: false },
      { isUsed: true }
    )

    res.json({
      success: true,
      message: 'Logout successful'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during logout',
      error: error.message
    })
  }
}

// Verify token
export const verifyToken = async (req, res) => {
  try {
    const { token } = req.params

    const authToken = await AuthToken.findOne({
      token,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    }).populate('userId')

    if (!authToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      })
    }

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: authToken.userId,
        tokenInfo: {
          type: authToken.type,
          expiresAt: authToken.expiresAt,
          createdAt: authToken.createdAt
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying token',
      error: error.message
    })
  }
}

// Get user profile
export const getProfile = async (req, res) => {
  try {
    const { token } = req.headers.authorization?.replace('Bearer ', '') || req.query.token

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token required'
      })
    }

    const authToken = await AuthToken.findOne({
      token,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    }).populate('userId')

    if (!authToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      })
    }

    res.json({
      success: true,
      data: {
        user: authToken.userId
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    })
  }
}

// Helper function to generate token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex')
}
