import express from 'express';
import { AuthService } from '../services/AuthService';
import { DatabaseService } from '../services/DatabaseService';

const router = express.Router();

export function createAuthRoutes(dbService: DatabaseService): express.Router {
  const authService = new AuthService(dbService);
  
  router.post('/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      
      const user = await authService.register({ username, email, password });
      res.status(201).json({ message: 'User registered successfully', user });
      
    } catch (error: any) {
      if (error.message.includes('ORA-00001')) {
        res.status(400).json({ message: 'Username or email already exists' });
      } else {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed' });
      }
    }
  });
  
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      
      const result = await authService.login(email, password);
      res.json(result);
      
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(401).json({ message: 'Invalid credentials' });
    }
  });
  
  router.get('/verify', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }
      
      const user = await authService.verifyToken(token);
      res.json({ user });
      
    } catch (error) {
      res.status(401).json({ message: 'Invalid token' });
    }
  });
  
  return router;
}