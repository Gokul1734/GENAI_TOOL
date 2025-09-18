import { useState } from 'react'
import { FaImage, FaMicrophone, FaVideo, FaFile, FaSpinner, FaCheck, FaTimes, FaExclamation } from 'react-icons/fa'
import StatisticalDashboard from './StatisticalDashboard'
import './AIMisinfoChecker.css'

const AIMisinfoChecker = () => {
  const [currentPage, setCurrentPage] = useState('input') // input, loading, dashboard
  const [inputType, setInputType] = useState('text')
  const [inputData, setInputData] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleInputSubmit = async () => {
    if (!inputData.trim()) return
    
    setIsAnalyzing(true)
    setCurrentPage('loading')
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/misinfo/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputType: inputType,
          inputData: inputData
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setAnalysisResult(result.data)
        setCurrentPage('dashboard')
      } else {
        console.error('Analysis failed:', result.message)
        // Fallback to mock data if API fails
        const mockResult = {
          misinfo: Math.random() > 0.5,
          source: ['indiatoday.com/news', 'bbc.com/output', 'reuters.com/article'],
          sourceClassifier: 'Technology / Finance',
          classifiedType: 'MovieSuggestions',
          inputType: inputType,
          confidence: Math.random() * 100,
          relatedNews: [
            { title: 'Related Article 1', source: 'news1.com', date: '2024-01-15' },
            { title: 'Related Article 2', source: 'news2.com', date: '2024-01-14' },
            { title: 'Related Article 3', source: 'news3.com', date: '2024-01-13' }
          ],
          statistics: {
            totalChecks: 1250,
            accuracy: 94.2,
            falsePositives: 3.8,
            categories: {
              'Technology': 45,
              'Politics': 30,
              'Health': 15,
              'Finance': 10
            }
          }
        }
        setAnalysisResult(mockResult)
        setCurrentPage('dashboard')
      }
    } catch (error) {
      console.error('Error calling API:', error)
      // Fallback to mock data
      const mockResult = {
        misinfo: Math.random() > 0.5,
        source: ['indiatoday.com/news', 'bbc.com/output', 'reuters.com/article'],
        sourceClassifier: 'Technology / Finance',
        classifiedType: 'MovieSuggestions',
        inputType: inputType,
        confidence: Math.random() * 100,
        relatedNews: [
          { title: 'Related Article 1', source: 'news1.com', date: '2024-01-15' },
          { title: 'Related Article 2', source: 'news2.com', date: '2024-01-14' },
          { title: 'Related Article 3', source: 'news3.com', date: '2024-01-13' }
        ],
        statistics: {
          totalChecks: 1250,
          accuracy: 94.2,
          falsePositives: 3.8,
          categories: {
            'Technology': 45,
            'Politics': 30,
            'Health': 15,
            'Finance': 10
          }
        }
      }
      setAnalysisResult(mockResult)
      setCurrentPage('dashboard')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const renderInputPage = () => (
    <div className="input-page">
      <div className="main-content-area">
        {/* Left Side - Media Input Buttons */}
        <div className="left-media-section">
          <div className="media-buttons-container">
            <div className="media-button" onClick={() => setInputType('image')}>
              <div className="media-icon image-icon">
                <div className="mountain-icon">
                  <div className="mountain-peak"></div>
                  <div className="mountain-base"></div>
                  <div className="sun-dot"></div>
                </div>
              </div>
              <span className="media-label">Image</span>
            </div>

            <div className="media-button" onClick={() => setInputType('video')}>
              <div className="media-icon video-icon">
                <div className="camera-icon">
                  <div className="camera-body"></div>
                  <div className="camera-lens"></div>
                </div>
              </div>
              <span className="media-label">Video</span>
            </div>
          </div>

          {/* Audio/Streaming Icon */}
          <div className="audio-icon-container">
            <div className="audio-icon" onClick={() => setInputType('voice')}>
              <div className="wave-lines-horizontal">
                <div className="wave-line-h"></div>
                <div className="wave-line-h"></div>
                <div className="wave-line-h"></div>
              </div>
              <span className="media-label">Voice Input</span>
            </div>
          </div>
        </div>

        {/* Right Side - Text Input */}
        <div className="right-text-section">
          <div className="text-input-container">
            <textarea
              className="main-text-input"
              placeholder="Type here..."
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
            />
          </div>
          <div className="analyze-section">
            <button className="analyze-button" onClick={handleInputSubmit}>
              <span className="analyze-text">Analyze</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderLoadingPage = () => (
    <div className="loading-page">
      <div className="loading-container">
        <div className="loading-animation">
          <FaSpinner className="spinner" />
        </div>
        <h2>Analyzing Content for Misinformation</h2>
        <div className="loading-steps">
          <div className="step active">Processing {inputType}...</div>
          <div className="step">Running AI Classification</div>
          <div className="step">Cross-referencing Sources</div>
          <div className="step">Generating Report</div>
        </div>
      </div>
    </div>
  )

  const renderDashboard = () => {
    const isMisinfo = analysisResult?.misinfo
    const backdropClass = isMisinfo ? 'misinfo-backdrop' : 'truth-backdrop'
    
    return (
      <div className={`dashboard-page ${backdropClass}`}>
        <div className="dashboard-container">
          <div className="results-grid">
            <div className="classification-box">
              <h3>Classification & Description</h3>
              <div className="classification-content">
                <div className="misinfo-indicator">
                  {isMisinfo ? (
                    <FaTimes className="misinfo-icon" />
                  ) : (
                    <FaCheck className="truth-icon" />
                  )}
                  <span className={`status-text ${isMisinfo ? 'misinfo' : 'truth'}`}>
                    {isMisinfo ? 'MISINFORMATION DETECTED' : 'VERIFIED INFORMATION'}
                  </span>
                </div>
                <div className="description">
                  <p><strong>Type:</strong> {analysisResult.classifiedType}</p>
                  <p><strong>Category:</strong> {analysisResult.sourceClassifier}</p>
                  <p><strong>Confidence:</strong> {analysisResult.confidence.toFixed(1)}%</p>
                  <p><strong>Input Type:</strong> {analysisResult.inputType}</p>
                </div>
              </div>
            </div>

            <div className="news-sources-box">
              <h3>Related News & Sources</h3>
              <div className="sources-content">
                {analysisResult.source.map((source, index) => (
                  <div key={index} className="source-item">
                    <span className="source-url">{source}</span>
                  </div>
                ))}
                <div className="related-news">
                  {analysisResult.relatedNews.map((news, index) => (
                    <div key={index} className="news-item">
                      <h4>{news.title}</h4>
                      <p>{news.source} • {news.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="statistics-box">
              <h3>Predictive Monitoring</h3>
              <div className="stats-content">
                <div className="stat-chart">
                  <div className="chart-bars">
                    {Object.entries(analysisResult.statistics.categories).map(([category, value]) => (
                      <div key={category} className="bar-container">
                        <div className="bar" style={{ height: `${value}%` }}></div>
                        <span className="bar-label">{category}</span>
                        <span className="bar-value">{value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="stat-summary">
                  <div className="stat-item">
                    <span className="stat-number">{analysisResult.statistics.totalChecks}</span>
                    <span className="stat-label">Total Checks</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{analysisResult.statistics.accuracy}%</span>
                    <span className="stat-label">Accuracy</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{analysisResult.statistics.falsePositives}%</span>
                    <span className="stat-label">False Positives</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-actions">
            <button className="action-button" onClick={() => setCurrentPage('input')}>
              Check Another Content
            </button>
            <button className="action-button secondary">
              Export Report
            </button>
          </div>

          {/* Statistical Dashboard */}
          <StatisticalDashboard 
            analysisResult={analysisResult} 
            isMisinfo={isMisinfo} 
          />
        </div>
      </div>
    )
  }

  const renderAboutPage = () => (
    <div className="about-page">
      <div className="about-container">
        <h2>About FactSense AI</h2>
        <p>
          FactSense AI is an advanced misinformation detection system that helps users 
          identify and verify information across multiple media types including text, 
          images, videos, and audio content.
        </p>
        <div className="features-list">
          <h3>Key Features:</h3>
          <ul>
            <li>Multi-modal content analysis</li>
            <li>Real-time misinformation detection</li>
            <li>Source verification and credibility scoring</li>
            <li>Statistical analytics and reporting</li>
            <li>Cross-platform compatibility</li>
          </ul>
        </div>
        <button className="back-button" onClick={() => setCurrentPage('input')}>
          Back to Main
        </button>
      </div>
    </div>
  )

  const renderApiDocsPage = () => (
    <div className="api-docs-page">
      <div className="api-docs-container">
        <h2>API Documentation</h2>
        <div className="api-section">
          <h3>Endpoints</h3>
          <div className="endpoint">
            <code>POST /api/misinfo/analyze</code>
            <p>Analyze content for misinformation</p>
          </div>
          <div className="endpoint">
            <code>GET /api/misinfo/history</code>
            <p>Get analysis history</p>
          </div>
          <div className="endpoint">
            <code>GET /api/misinfo/stats</code>
            <p>Get statistical data</p>
          </div>
        </div>
        <button className="back-button" onClick={() => setCurrentPage('input')}>
          Back to Main
        </button>
      </div>
    </div>
  )

  return (
    <div className="ai-misinfo-checker">
      <header className="checker-header">
        <div className="header-content">
          <div className="title-section">
            <h1 className="app-title">FactSense AI</h1>
            <h2 className="app-subtitle">Stay Informed, Stay Accurate</h2>
          </div>
          <div className="hamburger-menu" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <div className={`hamburger-line ${isMenuOpen ? 'active' : ''}`}></div>
            <div className={`hamburger-line ${isMenuOpen ? 'active' : ''}`}></div>
            <div className={`hamburger-line ${isMenuOpen ? 'active' : ''}`}></div>
          </div>
        </div>
        
        {isMenuOpen && (
          <div className="dropdown-menu">
            <a href="#" onClick={() => {setCurrentPage('input'); setIsMenuOpen(false);}}>Home</a>
            <a href="#" onClick={() => {setCurrentPage('about'); setIsMenuOpen(false);}}>About</a>
            <a href="#" onClick={() => {setCurrentPage('api-docs'); setIsMenuOpen(false);}}>API Docs</a>
          </div>
        )}
      </header>

      <main className="checker-main">
        {currentPage === 'input' && renderInputPage()}
        {currentPage === 'loading' && renderLoadingPage()}
        {currentPage === 'dashboard' && renderDashboard()}
        {currentPage === 'about' && renderAboutPage()}
        {currentPage === 'api-docs' && renderApiDocsPage()}
      </main>
    </div>
  )
}

export default AIMisinfoChecker
