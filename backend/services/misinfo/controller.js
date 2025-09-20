import MisinfoAnalysis from './model.js'

// Analyze content for misinformation
export const analyzeContent = async (req, res) => {
  try {
    const { inputType, inputData } = req.body
    const startTime = Date.now()

    // Simulate AI analysis (replace with actual AI model integration)
    const analysisResult = await performAIAnalysis(inputType, inputData)
    
    const processingTime = Date.now() - startTime

    // Save analysis to database
    const analysis = new MisinfoAnalysis({
      inputType,
      inputData,
      analysisResult,
      processingTime,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    })

    await analysis.save()

    res.json({
      success: true,
      data: {
        ...analysisResult,
        processingTime,
        analysisId: analysis._id
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error analyzing content',
      error: error.message
    })
  }
}

// Get analysis history
export const getAnalysisHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const analyses = await MisinfoAnalysis.find()
      .select('inputType analysisResult.misinfo analysisResult.confidence createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await MisinfoAnalysis.countDocuments()

    res.json({
      success: true,
      data: analyses,
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
      message: 'Error fetching analysis history',
      error: error.message
    })
  }
}

// Get analysis statistics
export const getAnalysisStats = async (req, res) => {
  try {
    const timeFilter = req.query.timeFilter || '7d'
    const startDate = getStartDate(timeFilter)

    const stats = await MisinfoAnalysis.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalAnalyses: { $sum: 1 },
          misinfoCount: {
            $sum: { $cond: [{ $eq: ['$analysisResult.misinfo', true] }, 1, 0] }
          },
          avgConfidence: { $avg: '$analysisResult.confidence' },
          avgProcessingTime: { $avg: '$processingTime' }
        }
      }
    ])

    const categoryStats = await MisinfoAnalysis.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$analysisResult.classifiedType',
          count: { $sum: 1 },
          misinfoCount: {
            $sum: { $cond: [{ $eq: ['$analysisResult.misinfo', true] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          misinfoCount: 1,
          misinfoRate: { $multiply: [{ $divide: ['$misinfoCount', '$count'] }, 100] }
        }
      },
      {
        $sort: { count: -1 }
      }
    ])

    const dailyStats = await MisinfoAnalysis.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          misinfoCount: {
            $sum: { $cond: [{ $eq: ['$analysisResult.misinfo', true] }, 1, 0] }
          },
          totalCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ])

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalAnalyses: 0,
          misinfoCount: 0,
          avgConfidence: 0,
          avgProcessingTime: 0
        },
        categoryBreakdown: categoryStats,
        dailyTrends: dailyStats
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching analysis statistics',
      error: error.message
    })
  }
}

// Get specific analysis by ID
export const getAnalysisById = async (req, res) => {
  try {
    const analysis = await MisinfoAnalysis.findById(req.params.id)
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'Analysis not found'
      })
    }

    res.json({
      success: true,
      data: analysis
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching analysis',
      error: error.message
    })
  }
}

// Helper function to simulate AI analysis
const performAIAnalysis = async (inputType, inputData) => {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))

  // Mock analysis result (replace with actual AI model)
  const categories = ['Technology', 'Politics', 'Health', 'Finance', 'Entertainment', 'Sports']
  const types = ['News Article', 'Social Media Post', 'Video Content', 'Image Post', 'Audio Message']
  const sources = [
    'reuters.com/article',
    'bbc.com/news',
    'cnn.com/world',
    'nytimes.com/article',
    'theguardian.com/news',
    'indiatoday.com/news',
    'ndtv.com/news',
    'timesofindia.com/article'
  ]

  const isMisinfo = Math.random() > 0.6 // 40% chance of misinformation
  const confidence = 75 + Math.random() * 25 // 75-100% confidence

  return {
    misinfo: isMisinfo,
    confidence: confidence,
    source: sources.slice(0, Math.floor(Math.random() * 4) + 1),
    sourceClassifier: categories[Math.floor(Math.random() * categories.length)],
    classifiedType: types[Math.floor(Math.random() * types.length)],
    relatedNews: [
      {
        title: 'Related News Article 1',
        source: 'reuters.com',
        date: new Date(),
        url: 'https://example.com/news1'
      },
      {
        title: 'Related News Article 2',
        source: 'bbc.com',
        date: new Date(),
        url: 'https://example.com/news2'
      }
    ],
    statistics: {
      totalChecks: 1250 + Math.floor(Math.random() * 500),
      accuracy: 90 + Math.random() * 8,
      falsePositives: 2 + Math.random() * 3,
      categories: {
        'Technology': 45,
        'Politics': 30,
        'Health': 15,
        'Finance': 10
      }
    }
  }
}

// Helper function to get start date based on time filter
const getStartDate = (timeFilter) => {
  const now = new Date()
  switch (timeFilter) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
}
