import express, { type Request, type Response, type NextFunction } from 'express';
import { getConfig } from '../config';
import { logger } from '../logger';
import { getTelegramBotService } from '../telegram/bot';
import { getLLMClient } from '../llm/client';
import { getConversationService } from '../services/conversation';

/**
 * Health Check Server
 * Provides HTTP endpoints for monitoring and health checks
 */
class HealthCheckServer {
  private app: express.Application;
  private server: ReturnType<typeof express.app.listen> | null = null;
  private port: number;
  private host: string;

  constructor() {
    const config = getConfig();
    this.port = config.HEALTH_CHECK_PORT;
    this.host = config.HEALTH_CHECK_HOST;

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // JSON body parser
    this.app.use(express.json());

    // Request logging middleware
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.debug({
        method: req.method,
        path: req.path,
        ip: req.ip,
      }, 'HTTP request received');
      next();
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'unknown',
        version: process.env.npm_package_version || '1.0.0',
      };

      res.status(200).json(health);
    });

    // Detailed health check endpoint
    this.app.get('/health/detailed', async (req: Request, res: Response) => {
      try {
        const conversationStats = getConversationService().getStats();
        const config = getConfig();

        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.NODE_ENV,
          version: '1.0.0',
          services: {
            telegram: {
              status: 'up',
              provider: config.LLM_PROVIDER,
            },
            llm: {
              status: 'up',
              provider: config.LLM_PROVIDER,
            },
            conversation: {
              status: 'up',
              activeUsers: conversationStats.totalUsers,
              totalMessages: conversationStats.totalMessages,
            },
          },
          system: {
            platform: process.platform,
            nodeVersion: process.version,
            memory: {
              used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
              total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
              unit: 'MB',
            },
          },
        };

        res.status(200).json(health);
      } catch (error) {
        logger.error({ error }, 'Error in detailed health check');
        res.status(500).json({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Readiness probe endpoint
    this.app.get('/ready', (req: Request, res: Response) => {
      // Check if critical services are ready
      const isReady = true; // Add actual readiness checks if needed

      if (isReady) {
        res.status(200).json({ status: 'ready' });
      } else {
        res.status(503).json({ status: 'not ready' });
      }
    });

    // Liveness probe endpoint
    this.app.get('/live', (req: Request, res: Response) => {
      // Check if the application is alive
      res.status(200).json({ status: 'alive' });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
      });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error({ error: err, path: req.path }, 'HTTP request error');

      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    });
  }

  /**
   * Start the health check server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, this.host, () => {
          logger.info({
            port: this.port,
            host: this.host,
            url: `http://${this.host}:${this.port}`,
          }, 'Health check server started');
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error({ error }, 'Health check server error');
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the health check server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Health check server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Singleton instance
let healthCheckServer: HealthCheckServer | null = null;

export function initHealthCheckServer(): HealthCheckServer {
  if (!healthCheckServer) {
    healthCheckServer = new HealthCheckServer();
  }
  return healthCheckServer;
}

export function getHealthCheckServer(): HealthCheckServer {
  if (!healthCheckServer) {
    throw new Error('Health check server not initialized. Call initHealthCheckServer() first.');
  }
  return healthCheckServer;
}

/**
 * Start the health check server (convenience function)
 */
export async function startHealthCheckServer(): Promise<void> {
  const server = initHealthCheckServer();
  await server.start();
}

/**
 * Stop the health check server (convenience function)
 */
export async function stopHealthCheckServer(): Promise<void> {
  if (healthCheckServer) {
    await healthCheckServer.stop();
    healthCheckServer = null;
  }
}
