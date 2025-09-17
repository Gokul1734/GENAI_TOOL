import { useState, useEffect } from 'react'
import axios from 'axios'

const Home = () => {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

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
      <h2>Welcome to MERN Stack Application</h2>
      <p>
        This is a full-stack application built with MongoDB, Express.js, React, and Node.js.
        The frontend is powered by Vite for fast development and hot reloading.
      </p>
      
      <div style={{ margin: '2rem 0' }}>
        <h3>Backend Connection Status:</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <p style={{ color: message.includes('Error') ? '#e74c3c' : '#27ae60' }}>
            {message}
          </p>
        )}
        <button onClick={fetchMessage} className="btn">
          Refresh Status
        </button>
      </div>

      <div>
        <h3>Features:</h3>
        <ul style={{ textAlign: 'left', display: 'inline-block' }}>
          <li>React 18 with Vite</li>
          <li>Express.js Microservices</li>
          <li>MongoDB with Mongoose</li>
          <li>RESTful API</li>
          <li>Environment Configuration</li>
          <li>Modern UI/UX</li>
        </ul>
      </div>
    </div>
  )
}

export default Home
