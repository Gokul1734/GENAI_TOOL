import express from 'express'
import {
  register,
  login,
  logout,
  verifyToken,
  getProfile
} from './controller.js'

const router = express.Router()

// Auth routes
router.post('/register', register)     // POST /api/auth/register
router.post('/login', login)           // POST /api/auth/login
router.post('/logout', logout)         // POST /api/auth/logout
router.get('/verify/:token', verifyToken)  // GET /api/auth/verify/:token
router.get('/profile', getProfile)     // GET /api/auth/profile

export default router
