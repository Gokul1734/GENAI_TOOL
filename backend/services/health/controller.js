import mongoose from 'mongoose'

// Health check endpoint
export const healthCheck = async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    const uptime = process.uptime()
    
    res.json({
      success: true,
      message: 'Backend service is healthy',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 60)} minutes ${Math.floor(uptime % 60)} seconds`,
        database: {
          status: dbStatus,
          connection: mongoose.connection.readyState
        },
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    })
  }
}

// Database health check
export const dbHealthCheck = async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState
    let status = 'unknown'
    
    switch (dbStatus) {
      case 0:
        status = 'disconnected'
        break
      case 1:
        status = 'connected'
        break
      case 2:
        status = 'connecting'
        break
      case 3:
        status = 'disconnecting'
        break
    }

    // Test database connection with a simple query
    await mongoose.connection.db.admin().ping()

    res.json({
      success: true,
      message: 'Database is healthy',
      data: {
        status: 'healthy',
        connectionState: status,
        connectionStateCode: dbStatus,
        database: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database health check failed',
      error: error.message
    })
  }
}

// API status check
export const apiStatus = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'API is operational',
      data: {
        status: 'operational',
        timestamp: new Date().toISOString(),
        services: {
          users: 'operational',
          auth: 'operational',
          health: 'operational'
        },
        endpoints: {
          users: '/api/users',
          auth: '/api/auth',
          health: '/api/health'
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'API status check failed',
      error: error.message
    })
  }
}
