import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

// Import microservices
import userRoutes from './services/user/routes.js'
import authRoutes from './services/auth/routes.js'
import healthRoutes from './services/health/routes.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000'],
  credentials: true
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.API_RATE_LIMIT || 100,
  message: 'Too many requests from this IP, please try again later.'
})
app.use('/api/', limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Compression and logging
app.use(compression())
app.use(morgan('combined'))

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mern_database', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB')
})

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err)
})

// API Routes - Microservices
app.use('/api/users', userRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/health', healthRoutes)

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to MERN Stack API',
    version: '1.0.0',
    services: ['users', 'auth', 'health'],
    documentation: '/api/docs'
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 API URL: http://localhost:${PORT}/api`)
})
