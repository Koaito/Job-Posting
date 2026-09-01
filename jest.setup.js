// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock environment variables
process.env.FASTAPI_URL = 'http://localhost:8000'
process.env.CRAWLER_API_KEY = 'test-api-key'
process.env.JWT_SECRET = 'test-jwt-secret'
