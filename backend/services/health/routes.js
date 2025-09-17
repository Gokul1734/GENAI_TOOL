import express from 'express'
import {
  healthCheck,
  dbHealthCheck,
  apiStatus
} from './controller.js'

const router = express.Router()

// Health routes
router.get('/', healthCheck)           // GET /api/health
router.get('/db', dbHealthCheck)       // GET /api/health/db
router.get('/api', apiStatus)          // GET /api/health/api

export default router
