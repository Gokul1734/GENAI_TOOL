import User from './model.js'

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const users = await User.find({ isActive: true })
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })

    const total = await User.countDocuments({ isActive: true })

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    })
  }
}

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    res.json({
      success: true,
      data: user
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    })
  }
}

// Create new user
export const createUser = async (req, res) => {
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

    const user = new User({
      name,
      email,
      password
    })

    await user.save()

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user
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
      message: 'Error creating user',
      error: error.message
    })
  }
}

// Update user
export const updateUser = async (req, res) => {
  try {
    const { name, email, profile } = req.body
    const userId = req.params.id

    const user = await User.findByIdAndUpdate(
      userId,
      { name, email, profile },
      { new: true, runValidators: true }
    ).select('-password')

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
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
      message: 'Error updating user',
      error: error.message
    })
  }
}

// Delete user (soft delete)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    })
  }
}

// Search users
export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const searchQuery = {
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    }

    const users = await User.find(searchQuery)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })

    const total = await User.countDocuments(searchQuery)

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching users',
      error: error.message
    })
  }
}
