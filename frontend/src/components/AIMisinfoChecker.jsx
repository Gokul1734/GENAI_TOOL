import { useState } from 'react'
import { FaImage, FaMicrophone, FaVideo, FaFile, FaSpinner, FaCheck, FaTimes, FaExclamation } from 'react-icons/fa'
import StatisticalDashboard from './StatisticalDashboard'
import './AIMisinfoChecker.css'

const AIMisinfoChecker = () => {
  const [currentPage, setCurrentPage] = useState('input') // input, loading, dashboard
  const [inputType, setInputType] = useState('text') // 'text' or 'link' only
  const [inputData, setInputData] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleInputSubmit = async () => {
    if (!inputData.trim()) return
    
    setIsAnalyzing(true)
    setCurrentPage('loading')
    
    try {
      // Use FastAPI endpoint, default to localhost:8000/verify
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/verify';
      let payload = {};
      if (inputType === 'text') {
        payload = { text: inputData };
      } else {
        payload = { link: inputData };
      }
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      // Handle non-200 responses and empty body
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      let result = null;
      try {
        result = await response.json();
      } catch (jsonErr) {
        throw new Error('Invalid JSON response');
      }
      // Debug log: show raw API response
      console.log('Raw API response:', result);
      // If backend uses { success: true, data: {...} }
      const apiData = result.data || result;
      const vr = apiData.verification_result || {};
      const cc = apiData.content_categorization || {};
      const label = apiData.label || vr.label;
      const confidence = (vr.confidence ?? apiData.confidence ?? 0) * 100;
      const srcs = Array.isArray(apiData.sources) ? apiData.sources : (apiData.evidence_analysis?.top_sources || []);

      if (label) {
        const truthyLabels = ['True', 'Likely True', 'Partially True', 'Needs Context', 'Opinion', 'Opinion/Editorial', 'Satire', 'Satire/Sarcasm'];
        // Map backend result to frontend format
        const mappedResult = {
          misinfo: !truthyLabels.includes(label),
          source: srcs,
          sourceClassifier: cc.category || apiData.category || 'General',
          classifiedType: cc.type || apiData.type || 'General',
          inputType: inputType,
          confidence,
          relatedNews: apiData.relatedNews || [],
          statistics: apiData.system_stats || apiData.statistics || {
            totalChecks: 0,
            avgConfidence: 0,
            falsePositives: 0,
            categories: {}
          },
          rumour_prediction: apiData.rumour_prediction || {},
        };
        setAnalysisResult(mappedResult);
        setCurrentPage('dashboard');
      } else {
        throw new Error('API returned incomplete result');
      }
    } catch (error) {
      console.error('Error calling API:', error);
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
      };
      setAnalysisResult(mockResult);
      setCurrentPage('dashboard');
    } finally {
      setIsAnalyzing(false);
    }
  }

  const renderInputPage = () => (
    <div className="input-page">
      <div className="main-content-area">
        <div className="input-type-toggle">
          <button
            className={`toggle-btn ${inputType === 'text' ? 'active' : ''}`}
            onClick={() => setInputType('text')}
          >Text</button>
          <button
            className={`toggle-btn ${inputType === 'link' ? 'active' : ''}`}
            onClick={() => setInputType('link')}
          >Source Link</button>
        </div>
        <div className="text-input-container">
          <textarea
            className="main-text-input"
            placeholder={inputType === 'text' ? 'Enter claim or statement...' : 'Paste source link (URL)...'}
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
    const isMisinfo = analysisResult?.misinfo;
    const backdropClass = isMisinfo ? 'misinfo-backdrop' : 'truth-backdrop';
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
                {Array.isArray(analysisResult.source) && analysisResult.source.map((source, index) => (
                  <div key={index} className="source-item">
                    {source.title && <span className="source-title">{source.title}</span>}{' '}
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noopener noreferrer">{source.domain || source.url}</a>
                    ) : (
                      <span>{source.domain}</span>
                    )}{' '}
                    {typeof source.credibility !== 'undefined' && (
                      <span className="source-credibility">Credibility: {source.credibility}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="statistics-box">
              <h3>Prediction Findings</h3>
              <div className="stats-content">
                <StatisticalDashboard 
                  analysisResult={analysisResult} 
                  isMisinfo={isMisinfo} 
                />
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
        </div>
      </div>
    );
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
