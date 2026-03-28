#!/bin/bash

#############################################
# Secure Deployment Script for AWS EC2
# This script ensures secure deployment with proper permissions
#############################################

set -e  # Exit on any error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_NAME="tele-mind"
APP_DIR="/opt/${APP_NAME}"
SERVICE_USER="telebot"
ENV_FILE="/etc/${APP_NAME}/production.env"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Create service user
create_service_user() {
    log_info "Creating service user..."

    if id "$SERVICE_USER" &>/dev/null; then
        log_warn "User $SERVICE_USER already exists"
    else
        useradd -r -s /bin/bash -d "$APP_DIR" "$SERVICE_USER"
        log_success "User $SERVICE_USER created"
    fi
}

# Create secure environment file
setup_secure_env() {
    log_info "Setting up secure environment..."

    # Create config directory
    mkdir -p "/etc/${APP_NAME}"
    chmod 700 "/etc/${APP_NAME}"

    if [[ ! -f "$ENV_FILE" ]]; then
        log_warn "Environment file not found at $ENV_FILE"
        log_info "Creating template..."

        cat > "$ENV_FILE" << 'EOF'
# Production Environment Configuration
# Fill in your actual values

TELEGRAM_BOT_TOKEN=your_bot_token_here
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=gpt-4o-mini

ALLOWED_USER_IDS=
ADMIN_USER_IDS=

HEALTH_CHECK_PORT=3000
LOG_LEVEL=info
NODE_ENV=production
EOF

        chmod 600 "$ENV_FILE"
        chown "$SERVICE_USER:$SERVICE_USER" "$ENV_FILE"

        log_warn "Please edit $ENV_FILE with your actual configuration:"
        log_warn "  sudo nano $ENV_FILE"
        read -p "Press Enter after editing the file..."
    else
        log_info "Environment file exists"
    fi

    # Verify permissions
    PERMS=$(stat -c "%a" "$ENV_FILE")
    if [[ "$PERMS" != "600" ]]; then
        chmod 600 "$ENV_FILE"
        log_success "Fixed permissions on $ENV_FILE"
    fi
}

# Setup systemd service
setup_systemd() {
    log_info "Setting up systemd service..."

    cat > "/etc/systemd/system/${APP_NAME}.service" << EOF
[Unit]
Description=TeleMind Telegram AI Assistant
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node $APP_DIR/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR /var/log/${APP_NAME}

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "${APP_NAME}"
    log_success "Systemd service configured"
}

# Setup application directory
setup_app_directory() {
    log_info "Setting up application directory..."

    mkdir -p "$APP_DIR"
    mkdir -p "$APP_DIR/logs"
    mkdir -p "/var/log/${APP_NAME}"

    # Set ownership
    chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
    chown -R "$SERVICE_USER:$SERVICE_USER" "/var/log/${APP_NAME}"

    # Set permissions
    chmod 755 "$APP_DIR"
    chmod 700 "$APP_DIR/logs"
    chmod 700 "/var/log/${APP_NAME}"

    log_success "Application directory configured"
}

# Setup firewall
setup_firewall() {
    log_info "Configuring firewall..."

    if command -v ufw >/dev/null 2>&1; then
        ufw allow 22/tcp comment 'SSH'
        ufw allow 443/tcp comment 'HTTPS'
        ufw --force enable
        log_success "Firewall configured"
    else
        log_warn "UFW not installed, skipping firewall setup"
    fi
}

# Main deployment
main() {
    log_info "Starting secure deployment of ${APP_NAME}..."
    echo ""

    check_root
    create_service_user
    setup_app_directory
    setup_secure_env
    setup_systemd
    setup_firewall

    echo ""
    log_success "Secure deployment completed!"
    echo ""
    echo "Next steps:"
    echo "  1. Edit environment: sudo nano $ENV_FILE"
    echo "  2. Deploy application: cd $APP_DIR && git pull && npm install && npm run build"
    echo "  3. Start service: sudo systemctl start $APP_NAME"
    echo "  4. Check status: sudo systemctl status $APP_NAME"
    echo "  5. View logs: sudo journalctl -u $APP_NAME -f"
    echo ""
}

# Run main function
main "$@"
