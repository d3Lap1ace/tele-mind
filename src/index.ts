import { getConfig } from './config';
import { logger } from './logger';
import { startBot, stopBot } from './telegram/bot';
import { startHealthCheckServer, stopHealthCheckServer } from './server/health';

/**
 * Application lifecycle management
 */
class Application {
  private isShuttingDown = false;

  /**
   * Start the application
   */
  async start(): Promise<void> {
    try {
      // Load and validate configuration
      const config = getConfig();

      logger.info({
        nodeEnv: config.NODE_ENV,
        llmProvider: config.LLM_PROVIDER,
        logLevel: config.LOG_LEVEL,
      }, 'Starting TeleMind AI Assistant');

      // Start health check server first
      await startHealthCheckServer();

      // Start Telegram bot
      await startBot();

      logger.info('TeleMind AI Assistant started successfully');

      // Setup graceful shutdown handlers
      this.setupShutdownHandlers();

    } catch (error) {
      logger.error({ error }, 'Failed to start application');
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        logger.warn({ signal }, 'Shutdown already in progress, ignoring signal');
        return;
      }

      this.isShuttingDown = true;
      logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');

      try {
        // Stop accepting new requests
        logger.info('Stopping bot...');
        await stopBot();

        // Stop health check server
        logger.info('Stopping health check server...');
        await stopHealthCheckServer();

        logger.info('Graceful shutdown completed');
        process.exit(0);

      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle SIGTERM (kill command)
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error({ error }, 'Uncaught exception');
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise }, 'Unhandled promise rejection');
      shutdown('unhandledRejection');
    });
  }

  /**
   * Stop the application
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    logger.info('Stopping application...');

    await stopBot();
    await stopHealthCheckServer();

    logger.info('Application stopped');
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const app = new Application();
  await app.start();
}

// Start the application if this is the main module
if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

export { Application, main };
