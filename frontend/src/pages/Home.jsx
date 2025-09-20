import { useState, useEffect } from 'react'
import axios from 'axios'

const Home = () => {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [inputType, setInputType] = useState('text')
  const [mlResult, setMlResult] = useState(null)
  const [mlLoading, setMlLoading] = useState(false)

  const fetchMessage = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/health`)
      setMessage(response.data.message)
    } catch (error) {
      setMessage('Error connecting to backend')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessage()
  }, [])

  return (
    <div className="card">
      <h2>Welcome to FactSense AI Prototype</h2>
      <p>
        This is a GenAI-powered misinformation detection system. Enter text or a link below to verify claims using the ML pipeline.
      </p>

      <div style={{ margin: '2rem 0' }}>
        <h3>Backend Connection Status:</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <p style={{ color: typeof message === 'string' && message.includes('Error') ? '#e74c3c' : '#27ae60' }}>
            {message}
          </p>
        )}
        <button onClick={fetchMessage} className="btn">
          Refresh Status
        </button>
      </div>

      <div style={{ margin: '2rem 0' }}>
        <h3>Try FactSense AI:</h3>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <input
              type="radio"
              value="text"
              checked={inputType === 'text'}
              onChange={() => setInputType('text')}
              style={{ marginRight: '0.5rem' }}
            />
            Text
          </label>
          <label style={{ marginLeft: '1rem' }}>
            <input
              type="radio"
              value="link"
              checked={inputType === 'link'}
              onChange={() => setInputType('link')}
              style={{ marginRight: '0.5rem' }}
            />
            Link
          </label>
        </div>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={inputType === 'text' ? 'Enter claim text...' : 'Enter source link...'}
          style={{ width: '60%', padding: '0.5rem', marginBottom: '1rem' }}
        />
        <button
          className="btn"
          onClick={async () => {
            setMlLoading(true)
            setMlResult(null)
            try {
              const payload = inputType === 'text' ? { text: input } : { link: input }
              const response = await axios.post(`${import.meta.env.VITE_ML_API_URL || 'http://localhost:8000'}/verify`, payload)
              setMlResult(response.data)
            } catch (err) {
              setMlResult({ error: err?.response?.data?.error || 'API error' })
            } finally {
              setMlLoading(false)
            }
          }}
          disabled={!input || mlLoading}
        >
          {mlLoading ? 'Verifying...' : 'Verify'}
        </button>
        {mlResult && (
          <div style={{ marginTop: '1.5rem', background: '#f6f6f6', padding: '1rem', borderRadius: '8px' }}>
            {mlResult.error ? (
              <p style={{ color: '#e74c3c' }}>Error: {mlResult.error}</p>
            ) : (
              <>
                <p><strong>Label:</strong> {mlResult.label}</p>
                <p><strong>Confidence:</strong> {mlResult.confidence}</p>
                <p><strong>Explanation:</strong> {mlResult.explanation}</p>
                <p><strong>Risk Score:</strong> {mlResult.risk_score}</p>
              </>
            )}
          </div>
        )}
      </div>

      <div>
        <h3>Features:</h3>
        <ul style={{ textAlign: 'left', display: 'inline-block' }}>
          <li>GenAI-powered fact-checking</li>
          <li>Text, link, image, audio, video support</li>
          <li>Language detection & translation</li>
          <li>Risk mapping for rumors</li>
          <li>Modular ML pipeline</li>
          <li>Modern UI/UX</li>
        </ul>
      </div>
    </div>
  )
}

export default Home
