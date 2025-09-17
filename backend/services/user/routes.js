import express from 'express'
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  searchUsers
} from './controller.js'

const router = express.Router()

// User routes
router.get('/', getAllUsers)           // GET /api/users
router.get('/search', searchUsers)     // GET /api/users/search?q=query
router.get('/:id', getUserById)        // GET /api/users/:id
router.post('/', createUser)           // POST /api/users
router.put('/:id', updateUser)         // PUT /api/users/:id
router.delete('/:id', deleteUser)      // DELETE /api/users/:id

export default router
