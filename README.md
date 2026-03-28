# TeleMind - Telegram AI Assistant Bot

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-ready Telegram LLM Bot deployed on AWS EC2. Features multi-turn conversations, context memory, access control, and support for multiple LLM providers (OpenAI, Anthropic, Azure OpenAI).

## Features

- 🤖 **Multi-LLM Support**: OpenAI, Anthropic Claude, Azure OpenAI
- 💬 **Context-Aware Conversations**: Maintains conversation history for better responses
- 🔒 **Access Control**: User whitelist and admin permissions
- 🔄 **Automatic Retry**: Built-in retry logic for failed requests
- 📊 **Health Monitoring**: HTTP health check endpoints
- 🛡️ **Error Handling**: Comprehensive error handling and logging
- 🚀 **Production-Ready**: PM2 process management, graceful shutdown

## Architecture

```
tele-mind/
├── src/
│   ├── config/           # Configuration and environment validation
│   ├── logger/           # Pino logger with sanitization
│   ├── llm/              # LLM client abstraction layer
│   ├── services/         # Business logic (conversation, whitelist)
│   ├── telegram/         # Telegram bot and handlers
│   ├── server/           # Health check HTTP server
│   └── index.ts          # Application entry point
├── dist/                 # Compiled JavaScript
├── logs/                 # Application logs
└── package.json
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Telegram Bot Token
- LLM API Key (OpenAI/Anthropic/Azure)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/d3lap1ace/tele-mind.git
cd tele-mind
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Build the project**
```bash
npm run build
```

5. **Start the bot**
```bash
npm start
```

For development with hot reload:
```bash
npm run dev
```

## Configuration

### Getting Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the provided token
5. Add to `.env`: `TELEGRAM_BOT_TOKEN=your_token_here`

### Getting Your Telegram User ID

1. Open Telegram and search for [@userinfobot](https://t.me/userinfobot)
2. Send any message to the bot
3. Copy your user ID
4. Add to `.env`: `ALLOWED_USER_IDS=your_user_id_here`

### LLM Provider Configuration

#### OpenAI
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_BASE=https://api.openai.com/v1
```

#### Anthropic Claude
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

#### Azure OpenAI
```env
LLM_PROVIDER=azure
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

## Deployment

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### AWS EC2 Deployment

1. **Connect to your EC2 instance**
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

2. **Install Node.js (Ubuntu)**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Install PM2 globally**
```bash
sudo npm install -g pm2
```

4. **Clone your repository**
```bash
git clone https://github.com/d3lap1ace/tele-mind.git /opt/tele-mind
cd /opt/tele-mind
```

5. **Configure environment**
```bash
cp .env.example .env
nano .env  # Add your configuration
```

6. **Run deployment script**
```bash
chmod +x deploy.sh
./deploy.sh
```

7. **Enable PM2 startup on boot**
```bash
pm2 startup
# Follow the instructions provided
pm2 save
```

### PM2 Commands

```bash
# Start application
pm2 start ecosystem.config.js

# Stop application
pm2 stop tele-mind

# Restart application
pm2 restart tele-mind

# View logs
pm2 logs tele-mind

# Monitor all processes
pm2 monit

# View status
pm2 status

# Save current processes
pm2 save
```

## Health Check

The application includes HTTP endpoints for health monitoring:

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health information
- `GET /ready` - Readiness probe
- `GET /live` - Liveness probe

Example:
```bash
curl http://localhost:3000/health
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize the bot and see welcome message |
| `/help` | Display help information |
| `/clear` | Clear your conversation history |

## Troubleshooting

### Bot not responding to messages

1. **Check if PM2 process is running**
```bash
pm2 status tele-mind
```

2. **Check logs for errors**
```bash
pm2 logs tele-mind --lines 100
```

3. **Verify bot token is correct**
```bash
# Test your bot token
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe
```

4. **Check if user ID is in whitelist**
```bash
# Verify your user ID
echo $ALLOWED_USER_IDS
```

### LLM API errors

1. **Verify API key is correct**
```bash
# For OpenAI
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# For Anthropic
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

2. **Check rate limits**
- Ensure you're not exceeding API rate limits
- Consider adding delay between requests

3. **Verify model name**
- Check that the model name is correct for your provider
- Some models may not be available in all regions

### Build errors

```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### PM2 startup issues

```bash
# Reset PM2
pm2 delete tele-mind
pm2 kill
pm2 start ecosystem.config.js
pm2 save
```

## Future Enhancements

### 1. PostgreSQL Persistence

Replace in-memory conversation store with PostgreSQL:

```bash
npm install pg @types/pg
```

```typescript
// Example schema
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_id ON conversations(user_id);
```

### 2. Redis Rate Limiting

Add rate limiting per user:

```bash
npm install ioredis @types/ioredis
npm install express-rate-limit
```

### 3. Webhook Mode + Nginx

Switch from polling to webhook for better performance:

**Nginx Configuration:**
```nginx
server {
    listen 443 ssl;
    server_name bot.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /telegram-webhook {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Set Webhook:**
```bash
curl -X POST https://api.telegram.org/bot<token>/setWebhook \
  -d "url=https://bot.yourdomain.com/telegram-webhook"
```

### 4. Multi-Model Routing

Route different requests to different models:

```typescript
const modelRouter = {
  simple: 'gpt-4o-mini',
  complex: 'gpt-4o',
  creative: 'claude-3-5-sonnet',
  coding: 'gpt-4'
};

function selectModel(userInput: string): string {
  // Analyze input and select appropriate model
  if (userInput.includes('code') || userInput.includes('programming')) {
    return modelRouter.coding;
  }
  // ... more logic
}
```

### 5. Admin Commands

Add administrative features:

```typescript
// /broadcast - Send message to all users
// /stats - Show usage statistics
// /users - List active users
// /ban - Ban a user
// /unban - Unban a user
```

### 6. RAG (Retrieval Augmented Generation)

Add document-based knowledge:

```bash
npm install @langchain/openai @langchain/community
```

```typescript
// Vector database (Pinecone, Weaviate, etc.)
// Document chunking and embedding
// Semantic search
// Context injection
```

## Monitoring

### Log Locations

- Application logs: `./logs/`
- PM2 logs: `~/.pm2/logs/`

### Log Rotation

Configure logrotate:

```bash
sudo nano /etc/logrotate.d/tele-mind
```

```
/opt/tele-mind/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 ubuntu ubuntu
    sharedscripts
    postrotate
        pm2 reload tele-mind
    endscript
}
```

## Security Considerations

1. **Never commit `.env` file** - Contains sensitive API keys
2. **Use strong, unique API keys** - Rotate them regularly
3. **Implement rate limiting** - Prevent abuse
4. **Keep dependencies updated** - `npm audit` and `npm update`
5. **Use HTTPS in production** - Protect webhooks
6. **Monitor logs for suspicious activity** - Set up alerts
7. **Limit bot permissions** - Principle of least privilege

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions

## Acknowledgments

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) - Telegram Bot API wrapper
- [Pino](https://getpino.io/) - Fast logger
- [Zod](https://zod.dev/) - Schema validation
