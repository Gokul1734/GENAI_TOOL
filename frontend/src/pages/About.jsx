const About = () => {
  return (
    <div className="card">
      <h2>About This Project</h2>
      <p>
        This is a modern MERN stack application showcasing best practices for full-stack development.
        The application is structured with a microservices architecture on the backend and a 
        component-based React frontend.
      </p>
      
      <div style={{ textAlign: 'left', margin: '2rem 0' }}>
        <h3>Technology Stack:</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <h4>Frontend:</h4>
            <ul>
              <li>React 18</li>
              <li>Vite</li>
              <li>React Router</li>
              <li>Axios</li>
              <li>CSS3</li>
            </ul>
          </div>
          <div>
            <h4>Backend:</h4>
            <ul>
              <li>Node.js</li>
              <li>Express.js</li>
              <li>MongoDB</li>
              <li>Mongoose</li>
              <li>Microservices</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Architecture:</h3>
        <p>
          The backend follows a microservices pattern with separate services for different 
          business domains. Each service has its own models, routes, controllers, and middleware.
          The frontend communicates with these services through a centralized API gateway.
        </p>
      </div>
    </div>
  )
}

export default About
