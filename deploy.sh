#!/bin/bash

#############################################
# TeleMind Deployment Script for AWS EC2
#
# Usage:
#   ./deploy.sh              # Deploy to production
#   ./deploy.sh local        # Deploy to local environment
#
# Requirements:
#   - Node.js 18+
#   - npm 9+
#   - pm2 (npm install -g pm2)
#############################################

set -e  # Exit on any error
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="tele-mind"
APP_DIR="/opt/${APP_NAME}"
LOG_DIR="${APP_DIR}/logs"
BACKUP_DIR="${APP_DIR}/backups"
GIT_REPO="git@github.com:d3lap1ace/tele-mind.git"  # Update with your repo
BRANCH="main"

# Functions
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
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root"
        exit 1
    fi
}

# Check required commands
check_requirements() {
    log_info "Checking requirements..."

    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi

    if ! command -v git &> /dev/null; then
        log_error "git is not installed"
        exit 1
    fi

    if ! command -v pm2 &> /dev/null; then
        log_warn "PM2 is not installed. Installing..."
        npm install -g pm2
    fi

    log_success "All requirements met"
}

# Create necessary directories
create_directories() {
    log_info "Creating directories..."

    sudo mkdir -p "${APP_DIR}"
    sudo mkdir -p "${LOG_DIR}"
    sudo mkdir -p "${BACKUP_DIR}"

    # Set ownership (assuming ubuntu user, adjust if needed)
    sudo chown -R $USER:$USER "${APP_DIR}"

    log_success "Directories created"
}

# Clone or update repository
setup_repository() {
    log_info "Setting up repository..."

    if [[ -d "${APP_DIR}/.git" ]]; then
        log_info "Repository exists, pulling latest changes..."
        cd "${APP_DIR}"
        git fetch origin
        git checkout "${BRANCH}"
        git pull origin "${BRANCH}"
    else
        log_info "Cloning repository..."
        git clone -b "${BRANCH}" "${GIT_REPO}" "${APP_DIR}"
        cd "${APP_DIR}"
    fi

    log_success "Repository setup complete"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."

    cd "${APP_DIR}"

    # Clean install to ensure fresh dependencies
    npm ci

    log_success "Dependencies installed"
}

# Build the project
build_project() {
    log_info "Building project..."

    cd "${APP_DIR}"

    npm run build

    log_success "Project built"
}

# Setup environment file
setup_environment() {
    log_info "Setting up environment..."

    cd "${APP_DIR}"

    if [[ ! -f .env ]]; then
        if [[ -f .env.example ]]; then
            log_warn ".env file not found. Creating from .env.example..."
            cp .env.example .env
            log_warn "Please edit .env with your configuration"
            log_warn "Required variables: TELEGRAM_BOT_TOKEN, LLM_PROVIDER, API keys"
        else
            log_error ".env.example not found. Cannot create .env"
            exit 1
        fi
    fi

    log_success "Environment setup complete"
}

# Backup existing deployment
backup_deployment() {
    if [[ -f "${APP_DIR}/dist/index.js" ]]; then
        log_info "Backing up existing deployment..."
        BACKUP_FILE="${BACKUP_DIR}/backup-$(date +%Y%m%d-%H%M%S).tar.gz"
        tar -czf "${BACKUP_FILE}" -C "${APP_DIR}" dist/
        log_success "Backup created: ${BACKUP_FILE}"
    fi
}

# Stop existing PM2 process
stop_process() {
    log_info "Stopping existing process..."

    if pm2 describe "${APP_NAME}" &> /dev/null; then
        pm2 stop "${APP_NAME}" || true
        pm2 delete "${APP_NAME}" || true
    fi

    log_success "Process stopped"
}

# Start application with PM2
start_application() {
    log_info "Starting application with PM2..."

    cd "${APP_DIR}"

    # Start with PM2
    pm2 start ecosystem.config.js

    # Save PM2 process list
    pm2 save

    log_success "Application started"
}

# Show application status
show_status() {
    log_info "Application status:"
    pm2 status "${APP_NAME}"
    echo ""
    log_info "Recent logs:"
    pm2 logs "${APP_NAME}" --nostream --lines 20
}

# Setup PM2 startup script
setup_pm2_startup() {
    log_info "Setting up PM2 startup script..."

    if ! pm2 startup | grep -q "already been"; then
        log_warn "Run the following command to enable PM2 startup on boot:"
        pm2 startup
    else
        log_success "PM2 startup already configured"
    fi
}

# Main deployment function
deploy() {
    log_info "Starting deployment of ${APP_NAME}..."
    echo ""

    check_root
    check_requirements
    create_directories
    setup_repository
    backup_deployment
    install_dependencies
    build_project
    setup_environment
    stop_process
    start_application
    setup_pm2_startup
    show_status

    echo ""
    log_success "Deployment completed successfully!"
    echo ""
    log_info "Useful commands:"
    echo "  pm2 logs ${APP_NAME}      - View logs"
    echo "  pm2 restart ${APP_NAME}   - Restart application"
    echo "  pm2 stop ${APP_NAME}      - Stop application"
    echo "  pm2 monit                 - Monitor all processes"
    echo ""
}

# Parse command line arguments
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    local)
        log_info "Running local deployment..."
        npm install
        npm run build
        npm run build
        log_success "Local deployment complete. Run 'npm run dev' to start."
        ;;
    restart)
        log_info "Restarting ${APP_NAME}..."
        cd "${APP_DIR}"
        npm run build
        pm2 restart "${APP_NAME}"
        log_success "Restart complete"
        ;;
    stop)
        log_info "Stopping ${APP_NAME}..."
        pm2 stop "${APP_NAME}"
        log_success "Stopped"
        ;;
    start)
        log_info "Starting ${APP_NAME}..."
        cd "${APP_DIR}"
        pm2 start ecosystem.config.js
        log_success "Started"
        ;;
    logs)
        pm2 logs "${APP_NAME}"
        ;;
    status)
        pm2 status "${APP_NAME}"
        ;;
    *)
        echo "Usage: $0 {deploy|local|restart|stop|start|logs|status}"
        exit 1
        ;;
esac
