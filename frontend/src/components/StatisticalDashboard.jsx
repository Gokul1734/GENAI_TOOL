import { useState, useEffect } from 'react'
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale
} from 'chart.js'
import { FaArrowUp, FaArrowDown, FaEye, FaLock, FaExclamation } from 'react-icons/fa'
import './StatisticalDashboard.css'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale
)

// Set default Chart.js configuration
ChartJS.defaults.color = '#ffffff'
ChartJS.defaults.borderColor = 'rgba(255, 255, 255, 0.1)'

const StatisticalDashboard = ({ analysisResult, isMisinfo }) => {
  const [timeFilter, setTimeFilter] = useState('7d')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Mock data for demonstrations
  const mockTimeSeriesData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Misinformation Detected',
        data: [12, 19, 3, 5, 2, 3, 8],
        borderColor: '#ff4757',
        backgroundColor: 'rgba(255, 71, 87, 0.1)',
        tension: 0.4
      },
      {
        label: 'Verified Content',
        data: [45, 52, 67, 78, 82, 75, 68],
        borderColor: '#2ed573',
        backgroundColor: 'rgba(46, 213, 115, 0.1)',
        tension: 0.4
      }
    ]
  }

  const mockCategoryData = {
    labels: ['Technology', 'Politics', 'Health', 'Finance', 'Entertainment', 'Sports'],
    datasets: [
      {
        label: 'Misinformation Rate %',
        data: [15, 25, 8, 12, 5, 3],
        backgroundColor: [
          'rgba(102, 126, 234, 0.8)',
          'rgba(118, 75, 162, 0.8)',
          'rgba(255, 71, 87, 0.8)',
          'rgba(46, 213, 115, 0.8)',
          'rgba(255, 193, 7, 0.8)',
          'rgba(52, 144, 220, 0.8)'
        ],
        borderColor: [
          'rgba(102, 126, 234, 1)',
          'rgba(118, 75, 162, 1)',
          'rgba(255, 71, 87, 1)',
          'rgba(46, 213, 115, 1)',
          'rgba(255, 193, 7, 1)',
          'rgba(52, 144, 220, 1)'
        ],
        borderWidth: 2
      }
    ]
  }

  const mockAccuracyData = {
    labels: ['Accuracy', 'Precision', 'Recall', 'F1-Score'],
    datasets: [
      {
        label: 'Model Performance',
        data: [94.2, 91.5, 96.8, 94.1],
        backgroundColor: 'rgba(102, 126, 234, 0.6)',
        borderColor: 'rgba(102, 126, 234, 1)',
        borderWidth: 2
      }
    ]
  }

  const mockSourceCredibilityData = {
    labels: ['High Credibility', 'Medium Credibility', 'Low Credibility', 'Unknown'],
    datasets: [
      {
        data: [65, 20, 10, 5],
        backgroundColor: [
          'rgba(46, 213, 115, 0.8)',
          'rgba(255, 193, 7, 0.8)',
          'rgba(255, 71, 87, 0.8)',
          'rgba(108, 117, 125, 0.8)'
        ],
        borderColor: [
          'rgba(46, 213, 115, 1)',
          'rgba(255, 193, 7, 1)',
          'rgba(255, 71, 87, 1)',
          'rgba(108, 117, 125, 1)'
        ],
        borderWidth: 2
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'white'
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: 'white'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      y: {
        ticks: {
          color: 'white'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    }
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: 'white',
          padding: 20
        }
      }
    }
  }

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'white'
        }
      }
    },
    scales: {
      r: {
        angleLines: {
          color: 'rgba(255, 255, 255, 0.2)'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        pointLabels: {
          color: 'white'
        },
        ticks: {
          color: 'white'
        }
      }
    }
  }

  return (
    <div className="statistical-dashboard">
      <div className="dashboard-header">
        <h2>Predictive Monitoring & Analytics</h2>
        <div className="dashboard-controls">
          <select 
            value={timeFilter} 
            onChange={(e) => setTimeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Categories</option>
            <option value="technology">Technology</option>
            <option value="politics">Politics</option>
            <option value="health">Health</option>
            <option value="finance">Finance</option>
          </select>
        </div>
      </div>

      <div className="stats-grid">
        {/* Key Metrics Cards */}
        <div className="metrics-cards">
          <div className={`metric-card ${isMisinfo ? 'misinfo-glass' : 'truth-glass'}`}>
            <div className="metric-icon">
              <FaEye className={isMisinfo ? 'misinfo-icon' : 'truth-icon'} />
            </div>
            <div className="metric-content">
              <h3>Current Detection</h3>
              <p className={`metric-value ${isMisinfo ? 'misinfo' : 'truth'}`}>
                {isMisinfo ? 'MISINFO' : 'VERIFIED'}
              </p>
              <span className="metric-change">
                <FaArrowUp className="trend-up" />
                +12.5% vs last week
              </span>
            </div>
          </div>

          <div className="metric-card accuracy-glass">
            <div className="metric-icon">
              <FaLock className="accuracy-icon" />
            </div>
            <div className="metric-content">
              <h3>Model Accuracy</h3>
              <p className="metric-value accuracy">{analysisResult?.confidence ? analysisResult.confidence.toFixed(1) : '94.2'}%</p>
              <span className="metric-change">
                <FaArrowUp className="trend-up" />
                +2.1% improvement
              </span>
            </div>
          </div>

          <div className="metric-card warning-glass">
            <div className="metric-icon">
              <FaExclamation className="alert-icon" />
            </div>
            <div className="metric-content">
              <h3>False Positives</h3>
              <p className="metric-value warning">{analysisResult?.statistics?.falsePositives || '2.8'}%</p>
              <span className="metric-change">
                <FaArrowDown className="trend-down" />
                -0.8% reduction
              </span>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="charts-grid">
          <div className="chart-container">
            <h3>Detection Trends Over Time</h3>
            <div className="chart-wrapper">
              <Line data={mockTimeSeriesData} options={chartOptions} />
            </div>
          </div>

          <div className="chart-container">
            <h3>Category Analysis</h3>
            <div className="chart-wrapper">
              <Bar data={mockCategoryData} options={chartOptions} />
            </div>
          </div>

          <div className="chart-container">
            <h3>Model Performance Metrics</h3>
            <div className="chart-wrapper">
              <Radar data={mockAccuracyData} options={radarOptions} />
            </div>
          </div>

          <div className="chart-container">
            <h3>Source Credibility Distribution</h3>
            <div className="chart-wrapper">
              <Doughnut data={mockSourceCredibilityData} options={doughnutOptions} />
            </div>
          </div>
        </div>

        {/* Real-time Alerts */}
        <div className="alerts-section">
          <h3>Real-time Alerts & Insights</h3>
          <div className="alerts-list">
            <div className="alert-item high-priority">
              <div className="alert-icon">⚠️</div>
              <div className="alert-content">
                <h4>Spike in Political Misinformation</h4>
                <p>Detected 23% increase in political misinformation in the last 2 hours</p>
                <span className="alert-time">2 minutes ago</span>
              </div>
            </div>
            <div className="alert-item medium-priority">
              <div className="alert-icon">📊</div>
              <div className="alert-content">
                <h4>Model Performance Update</h4>
                <p>Accuracy improved to 94.2% after latest training cycle</p>
                <span className="alert-time">15 minutes ago</span>
              </div>
            </div>
            <div className="alert-item low-priority">
              <div className="alert-icon">✅</div>
              <div className="alert-content">
                <h4>System Health Check</h4>
                <p>All systems operational, response time within normal range</p>
                <span className="alert-time">1 hour ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatisticalDashboard
