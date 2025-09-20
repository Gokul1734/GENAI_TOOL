import express from 'express'
import {
  analyzeContent,
  getAnalysisHistory,
  getAnalysisStats,
  getAnalysisById
} from './controller.js'

const router = express.Router()

// Misinfo analysis routes
router.post('/analyze', analyzeContent)              // POST /api/misinfo/analyze
router.get('/history', getAnalysisHistory)           // GET /api/misinfo/history
router.get('/stats', getAnalysisStats)               // GET /api/misinfo/stats
router.get('/:id', getAnalysisById)                  // GET /api/misinfo/:id

export default router
