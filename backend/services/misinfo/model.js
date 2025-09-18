import mongoose from 'mongoose'

const misinfoAnalysisSchema = new mongoose.Schema({
  inputType: {
    type: String,
    enum: ['text', 'image', 'video', 'voice'],
    required: true
  },
  inputData: {
    type: String,
    required: true
  },
  analysisResult: {
    misinfo: {
      type: Boolean,
      required: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    source: [{
      type: String
    }],
    sourceClassifier: {
      type: String,
      required: true
    },
    classifiedType: {
      type: String,
      required: true
    },
    relatedNews: [{
      title: String,
      source: String,
      date: Date,
      url: String
    }],
    statistics: {
      totalChecks: Number,
      accuracy: Number,
      falsePositives: Number,
      categories: mongoose.Schema.Types.Mixed
    }
  },
  processingTime: {
    type: Number,
    required: true
  },
  userAgent: String,
  ipAddress: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

// Index for better performance
misinfoAnalysisSchema.index({ 'analysisResult.misinfo': 1 })
misinfoAnalysisSchema.index({ 'analysisResult.confidence': 1 })
misinfoAnalysisSchema.index({ createdAt: -1 })
misinfoAnalysisSchema.index({ inputType: 1 })

const MisinfoAnalysis = mongoose.model('MisinfoAnalysis', misinfoAnalysisSchema)

export default MisinfoAnalysis
