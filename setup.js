#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

console.log('🚀 Setting up MERN Stack Application...\n')

// Function to run commands
const runCommand = (command, description) => {
  console.log(`📦 ${description}...`)
  try {
    execSync(command, { stdio: 'inherit' })
    console.log(`✅ ${description} completed\n`)
  } catch (error) {
    console.error(`❌ Error during ${description}:`, error.message)
    process.exit(1)
  }
}

// Function to create .env files if they don't exist
const createEnvFiles = () => {
  console.log('📝 Creating environment files...')
  
  // Backend .env
  const backendEnvPath = './backend/.env'
  if (!fs.existsSync(backendEnvPath)) {
    const backendEnvContent = `PORT=5000
MONGODB_URI=mongodb://localhost:27017/mern_database
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_here_change_in_production
API_RATE_LIMIT=100`
    
    fs.writeFileSync(backendEnvPath, backendEnvContent)
    console.log('✅ Created backend/.env')
  }
  
  // Frontend .env.local
  const frontendEnvPath = './frontend/.env.local'
  if (!fs.existsSync(frontendEnvPath)) {
    const frontendEnvContent = `VITE_API_URL=http://localhost:5000/api
VITE_PORT=3000`
    
    fs.writeFileSync(frontendEnvPath, frontendEnvContent)
    console.log('✅ Created frontend/.env.local')
  }
  
  console.log('✅ Environment files setup completed\n')
}

// Main setup process
const main = async () => {
  try {
    // Install root dependencies
    runCommand('npm install', 'Installing root dependencies')
    
    // Install frontend dependencies
    runCommand('cd frontend && npm install', 'Installing frontend dependencies')
    
    // Install backend dependencies
    runCommand('cd backend && npm install', 'Installing backend dependencies')
    
    // Create environment files
    createEnvFiles()
    
    console.log('🎉 Setup completed successfully!')
    console.log('\n📋 Next steps:')
    console.log('1. Make sure MongoDB is running on your system')
    console.log('2. Update the .env files with your specific configuration')
    console.log('3. Run "npm run dev" to start both frontend and backend')
    console.log('4. Visit http://localhost:3000 for the frontend')
    console.log('5. Visit http://localhost:5000/api for the backend API')
    console.log('\n📚 Check README.md for detailed documentation')
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message)
    process.exit(1)
  }
}

main()
