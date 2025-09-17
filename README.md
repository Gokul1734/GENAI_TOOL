# MERN Stack Application

A modern full-stack application built with MongoDB, Express.js, React, and Node.js using a microservices architecture.

## 🚀 Features

- **Frontend**: React 18 with Vite for fast development
- **Backend**: Express.js with microservices architecture
- **Database**: MongoDB with Mongoose ODM
- **Architecture**: Microservices with separate services for users, auth, and health
- **Security**: Helmet, CORS, Rate limiting
- **Development**: Hot reloading, ESLint, Nodemon

## 📁 Project Structure

```
mern-stack-app/
├── frontend/                 # React frontend with Vite
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── pages/          # Page components
│   │   ├── App.jsx         # Main App component
│   │   └── main.jsx        # Entry point
│   ├── package.json
│   └── vite.config.js
├── backend/                 # Express.js backend
│   ├── services/           # Microservices
│   │   ├── user/          # User service
│   │   ├── auth/          # Authentication service
│   │   └── health/        # Health check service
│   ├── server.js          # Main server file
│   └── package.json
├── package.json           # Root package.json
└── README.md
```

## 🛠️ Tech Stack

### Frontend
- React 18
- Vite
- React Router
- Axios
- CSS3

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- Helmet
- CORS
- Rate Limiting
- Compression

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mern-stack-app
   ```

2. **Install dependencies**
   ```bash
   npm run setup
   ```

3. **Environment Setup**
   
   Create `.env` files in both frontend and backend directories:
   
   **Backend (.env)**:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/mern_database
   NODE_ENV=development
   JWT_SECRET=your_jwt_secret_key_here
   API_RATE_LIMIT=100
   ```
   
   **Frontend (.env.local)**:
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_PORT=3000
   ```

4. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

5. **Run the application**
   ```bash
   # Development mode (both frontend and backend)
   npm run dev
   
   # Or run separately:
   npm run dev:frontend  # Frontend only
   npm run dev:backend   # Backend only
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000/api
   - Health Check: http://localhost:5000/api/health

## 📡 API Endpoints

### Health Service
- `GET /api/health` - Overall health check
- `GET /api/health/db` - Database health check
- `GET /api/health/api` - API status check

### User Service
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `GET /api/users/search?q=query` - Search users

### Auth Service
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/verify/:token` - Verify token
- `GET /api/auth/profile` - Get user profile

## 🏗️ Microservices Architecture

The backend follows a microservices pattern with separate services:

### User Service
- User management (CRUD operations)
- User search and filtering
- User profile management

### Auth Service
- User registration and login
- Token management
- Session handling

### Health Service
- System health monitoring
- Database connectivity checks
- API status monitoring

## 🔧 Development

### Available Scripts

```bash
# Install all dependencies
npm run install:all

# Run development servers (both frontend and backend)
npm run dev

# Run frontend only
npm run dev:frontend

# Run backend only
npm run dev:backend

# Build frontend for production
npm run build

# Start production server
npm start

# Clean all node_modules
npm run clean
```

### Adding New Services

1. Create a new directory in `backend/services/`
2. Add `model.js`, `controller.js`, and `routes.js`
3. Import and use the routes in `server.js`

Example:
```javascript
import newServiceRoutes from './services/newService/routes.js'
app.use('/api/newService', newServiceRoutes)
```

## 🚀 Production Deployment

1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Set production environment variables**
   ```env
   NODE_ENV=production
   MONGODB_URI=your_production_mongodb_uri
   ```

3. **Start the production server**
   ```bash
   npm start
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter any issues or have questions, please create an issue in the repository.

---

**Happy Coding! 🎉**
