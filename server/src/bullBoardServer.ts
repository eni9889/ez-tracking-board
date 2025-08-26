#!/usr/bin/env ts-node

/**
 * Bull Board Server for Monitoring BullMQ Jobs
 * 
 * This server provides a web UI for monitoring the job queues:
 * - Vital Signs Processing Queue
 * - AI Note Scan Queue  
 * - AI Note Check Queue
 * 
 * Access the dashboard at: http://localhost:3001
 */

import express = require('express');
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import IORedis = require('ioredis');
import { Queue } from 'bullmq';
import { config } from 'dotenv';
import * as session from 'express-session';
import * as crypto from 'crypto';

// Load environment variables
config();

const app = express();
const PORT = parseInt(process.env.BULL_BOARD_PORT || '3001', 10);

// Authentication configuration
const BULL_BOARD_USERNAME = process.env.BULL_BOARD_USERNAME || 'admin';
const BULL_BOARD_PASSWORD = process.env.BULL_BOARD_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.BULL_BOARD_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Middleware setup
app.use(express.urlencoded({ extended: false }));
app.use(session.default({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Authentication middleware
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if ((req as any).session.authenticated) {
    return next();
  }
  res.redirect('/login');
}

// Authentication routes
app.get('/login', (req: express.Request, res: express.Response) => {
  const error = (req as any).session.error;
  delete (req as any).session.error;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bull Board Login</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
        .container { max-width: 400px; margin: 100px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { text-align: center; color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; color: #555; }
        input[type="text"], input[type="password"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; background: #007bff; color: white; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background: #0056b3; }
        .error { color: red; margin-bottom: 15px; text-align: center; }
        .info { color: #666; font-size: 12px; text-align: center; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🐂 Bull Board Access</h1>
        ${error ? `<div class="error">${error}</div>` : ''}
        <form method="post" action="/login">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required>
          </div>
          <button type="submit">Login</button>
        </form>
        <div class="info">
          Job Queue Monitoring Dashboard<br>
          Authorized personnel only
        </div>
      </div>
    </body>
    </html>
  `);
});

app.post('/login', (req: express.Request, res: express.Response) => {
  const { username, password } = req.body;
  
  if (username === BULL_BOARD_USERNAME && password === BULL_BOARD_PASSWORD) {
    (req as any).session.authenticated = true;
    (req as any).session.username = username;
    console.log(`🔐 Bull Board: User ${username} logged in successfully`);
    res.redirect('/');
  } else {
    (req as any).session.error = 'Invalid username or password';
    console.log(`🚫 Bull Board: Failed login attempt for username: ${username}`);
    res.redirect('/login');
  }
});

app.post('/logout', (req: express.Request, res: express.Response) => {
  const username = (req as any).session.username;
  (req as any).session.destroy(() => {
    console.log(`🚪 Bull Board: User ${username} logged out`);
    res.redirect('/login');
  });
});

// Redis connection configuration (same as jobProcessor)
const redisConfig: any = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // Required by BullMQ
};

// Only add password if it's defined
if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

// Add TLS support for DigitalOcean managed Redis
if (process.env.NODE_ENV === 'production') {
  redisConfig.tls = { rejectUnauthorized: false };
}

const redis = new IORedis.default(redisConfig);

// Create queue instances for monitoring (read-only)
const vitalSignsQueue = new Queue('vital-signs-processing', {
  connection: redis,
});

const aiNoteScanQueue = new Queue('ai-note-scan', {
  connection: redis,
});

const aiNoteCheckQueue = new Queue('ai-note-check', {
  connection: redis,
});

// Create Express adapter for Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/');

// Create Bull Board with queue adapters
createBullBoard({
  queues: [
    new BullMQAdapter(vitalSignsQueue) as any,
    new BullMQAdapter(aiNoteScanQueue) as any,
    new BullMQAdapter(aiNoteCheckQueue) as any,
  ],
  serverAdapter: serverAdapter,
});

// Mount the Bull Board UI with authentication
app.use('/', requireAuth, serverAdapter.getRouter());

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    redis: redis.status,
    queues: {
      vitalSigns: 'vital-signs-processing',
      aiNoteScan: 'ai-note-scan', 
      aiNoteCheck: 'ai-note-check'
    }
  });
});

// Error handling
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Bull Board error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Start the server
async function startBullBoardServer() {
  try {
    console.log('🎯 Starting Bull Board Server...');
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Port: ${PORT}`);
    
    // Test Redis connection
    await redis.ping();
    console.log('✅ Redis connection established');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Bull Board is running on port ${PORT}`);
      console.log(`📊 Dashboard: http://0.0.0.0:${PORT}`);
      console.log(`🏥 Health check: http://0.0.0.0:${PORT}/health`);
      console.log(`📋 Monitoring queues:`);
      console.log(`   - Vital Signs Processing: vital-signs-processing`);
      console.log(`   - AI Note Scan: ai-note-scan`);
      console.log(`   - AI Note Check: ai-note-check`);
      console.log(`✅ Bull Board startup complete!`);
    });
  } catch (error) {
    console.error('❌ Failed to start Bull Board server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Gracefully shutting down Bull Board server...');
  await redis.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Gracefully shutting down Bull Board server...');
  await redis.quit();
  process.exit(0);
});

// Start the server
startBullBoardServer().catch((error) => {
  console.error('❌ Unhandled error starting Bull Board server:', error);
  process.exit(1);
});
