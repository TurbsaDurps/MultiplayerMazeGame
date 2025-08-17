import express from 'express';
import { AuthController } from '../controllers/AuthController';

export function createAuthRoutes(authController: AuthController): express.Router {
  const router = express.Router();
  
  // Register endpoint
  router.post('/register', (req, res) => {
    authController.register(req, res);
  });
  
  // Login endpoint
  router.post('/login', (req, res) => {
    authController.login(req, res);
  });
  
  // Token verification endpoint
  router.get('/verify', (req, res) => {
    authController.verifyToken(req, res);
  });
  
  return router;
}