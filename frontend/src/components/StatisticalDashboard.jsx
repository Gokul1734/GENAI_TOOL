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

  // Use real API data if available
  const stats = analysisResult?.statistics || {};
  const prediction = analysisResult?.rumour_prediction || {};

  // Time series for forecast chart
  const forecastData = prediction.forecast || [];
  const timeSeriesLabels = forecastData.map(f => f.ds ? new Date(f.ds).toLocaleString() : '');
  const timeSeriesValues = forecastData.map(f => f.yhat || 0);
  const timeSeriesChartData = {
    labels: timeSeriesLabels,
    datasets: [
      {
        label: 'Predicted Claims (Next 12h)',
        data: timeSeriesValues,
        borderColor: '#ff4757',
        backgroundColor: 'rgba(255, 71, 87, 0.1)',
        tension: 0.4
      }
    ]
  };

  // Category chart
  const categoryLabels = Object.keys(stats.categories || {});
  const categoryValues = Object.values(stats.categories || {});
  const categoryChartData = {
    labels: categoryLabels,
    datasets: [
      {
        label: 'Checks per Category',
        data: categoryValues,
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
  };

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
          <div className="metric-card">
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
                {stats.totalChecks ? `+${stats.totalChecks} checks` : '+0 checks'}
              </span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">
              <FaLock className="accuracy-icon" />
            </div>
            <div className="metric-content">
              <h3>Model Accuracy</h3>
              <p className="metric-value accuracy">{stats.avgConfidence ? stats.avgConfidence + '%' : 'N/A'}</p>
              <span className="metric-change">
                <FaArrowUp className="trend-up" />
                {stats.avgConfidence ? `+${stats.avgConfidence}%` : '+0%'}
              </span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">
              <FaExclamation className="alert-icon" />
            </div>
            <div className="metric-content">
              <h3>False Positives</h3>
              <p className="metric-value warning">{stats.falsePositives ?? 0}%</p>
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
            <h3>Rumour Prediction (Next 12h)</h3>
            <div className="chart-wrapper">
              <Line data={timeSeriesChartData} options={chartOptions} />
            </div>
          </div>

          <div className="chart-container">
            <h3>Category Analysis</h3>
            <div className="chart-wrapper">
              <Bar data={categoryChartData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Real-time Alerts */}
        <div className="alerts-section">
          <h3>Rumour Alerts & Insights</h3>
          {prediction.alert ? (
            <div className="alert-item high-priority">
              <div className="alert-icon">⚠️</div>
              <div className="alert-content">
                <h4>Rumour Spike Predicted!</h4>
                <p>Possible spike hours: {prediction.spike_hours?.join(', ')}</p>
              </div>
            </div>
          ) : (
            <div className="alert-item low-priority">
              <div className="alert-icon">✅</div>
              <div className="alert-content">
                <h4>No rumour spike predicted</h4>
                <p>System stable, no abnormal spread detected.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StatisticalDashboard
