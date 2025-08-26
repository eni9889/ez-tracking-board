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

import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { config } from 'dotenv';

// Load environment variables
config();

const app = express();
const PORT = parseInt(process.env.BULL_BOARD_PORT || '3001', 10);

// Redis connection configuration (same as jobProcessor)
const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required by BullMQ
});

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
const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [
    new BullMQAdapter(vitalSignsQueue),
    new BullMQAdapter(aiNoteScanQueue),
    new BullMQAdapter(aiNoteCheckQueue),
  ],
  serverAdapter: serverAdapter,
});

// Mount the Bull Board UI
app.use('/', serverAdapter.getRouter());

// Health check endpoint
app.get('/health', (req, res) => {
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
    
    app.listen(PORT, () => {
      console.log(`🚀 Bull Board is running on port ${PORT}`);
      console.log(`📊 Dashboard: http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
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
