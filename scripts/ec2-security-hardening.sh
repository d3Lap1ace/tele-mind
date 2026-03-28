#!/bin/bash

#############################################
# EC2 Security Hardening Script
# Run this on a fresh EC2 instance to secure it
#
# Usage:
#   sudo bash ec2-security-hardening.sh
#############################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root"
    exit 1
fi

log_info "Starting EC2 security hardening..."
echo ""

# ============================================
# 1. System Updates
# ============================================
log_info "Step 1: Updating system packages..."

apt-get update -y
apt-get upgrade -y
apt-get autoremove -y

log_success "System updated"

# ============================================
# 2. Create Non-Root User
# ============================================
log_info "Step 2: Creating non-root user..."

ADMIN_USER="admin"
if ! id "$ADMIN_USER" &>/dev/null; then
    adduser --disabled-password --gecos "" "$ADMIN_USER"
    usermod -aG sudo "$ADMIN_USER"

    # Setup sudo without password for specific commands
    echo "$ADMIN_USER ALL=(ALL) NOPASSWD:/usr/bin/systemctl restart tele-mind,/usr/bin/systemctl status tele-mind,/usr/bin/npm" >> /etc/sudoers.d/telebot
    chmod 440 /etc/sudoers.d/telebot

    log_success "User $ADMIN_USER created"
    log_warn "Please set a password for $ADMIN_USER: sudo passwd $ADMIN_USER"
else
    log_warn "User $ADMIN_USER already exists"
fi

# ============================================
# 3. SSH Hardening
# ============================================
log_info "Step 3: Hardening SSH configuration..."

SSH_CONFIG="/etc/ssh/sshd_config"

# Backup original config
cp "$SSH_CONFIG" "${SSH_CONFIG}.backup.$(date +%Y%m%d)"

# Secure SSH settings
cat > "$SSH_CONFIG" << 'EOF'
# SSH Hardening Configuration

# Basic settings
Port 22
Protocol 2
HostKey /etc/ssh/ssh_host_rsa_key
HostKey /etc/ssh/ssh_host_ecdsa_key
HostKey /etc/ssh/ssh_host_ed25519_key

# Logging
SyslogFacility AUTH
LogLevel VERBOSE

# Authentication
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys

# Session settings
MaxAuthTries 3
MaxSessions 2
ClientAliveInterval 300
ClientAliveCountMax 2

# Security
X11Forwarding no
AllowTcpForwarding no
PermitTunnel no
GatewayPorts no

# Allow users
AllowUsers admin ubuntu
# AllowUsers admin ubuntu telebot  # Add telebot if needed

# Use DNS no
UseDNS no

# Login grace time
LoginGraceTime 60

# Banner
Banner /etc/issue.net

# Modern ciphers
Ciphers aes256-gcm@openssh.com,chacha20-poly1305@openssh.com,aes256-ctr
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
KexAlgorithms curve25519-sha256@libssh.org,diffie-hellman-group14-sha256
EOF

# Create banner
cat > /etc/issue.net << 'EOFBANNER'
***************************************************************************
                           AUTHORIZED ACCESS ONLY

***************************************************************************
This system is for authorized use only. All activities may be monitored.
Unauthorized access is prohibited and may be prosecuted to the fullest
extent of the law.
***************************************************************************
EOFBANNER

# Restart SSH
systemctl restart sshd

log_success "SSH hardened"
log_warn "⚠️  Password authentication disabled. Make sure you have SSH key access!"
log_warn "⚠️  Root login disabled. Use user '$ADMIN_USER' instead"

# ============================================
# 4. Firewall Configuration
# ============================================
log_info "Step 4: Configuring firewall..."

# Install UFW if not present
apt-get install -y ufw

# Reset to defaults
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (from anywhere for now, restrict later)
ufw allow 22/tcp comment 'SSH'

# Allow HTTP/HTTPS for webhook (if needed)
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Allow health check port (optional, for LB)
ufw allow 3000/tcp comment 'Health Check'

# Enable firewall
ufw --force enable

log_success "Firewall configured and enabled"

# ============================================
# 5. Fail2Ban Installation
# ============================================
log_info "Step 5: Installing and configuring Fail2Ban..."

apt-get install -y fail2ban

# Create custom jail for SSH
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
destemail = admin@example.com
sendername = Fail2Ban
action = %(action_mwl)s

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
EOF

systemctl enable fail2ban
systemctl start fail2ban

log_success "Fail2Ban installed and configured"

# ============================================
# 6. Automatic Security Updates
# ============================================
log_info "Step 6: Setting up automatic security updates..."

apt-get install -y unattended-upgrades

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Remove-Unused-Dependencies "true";
EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::Verbose "0";
EOF

systemctl enable unattended-upgrades
systemctl start unattended-upgrades

log_success "Automatic security updates configured"

# ============================================
# 7. System Hardening
# ============================================
log_info "Step 7: Applying system hardening..."

# Disable core dumps
echo "* soft core 0" >> /etc/security/limits.conf
echo "* hard core 0" >> /etc/security/limits.conf

# Restrict access to kernel logs
chmod 640 /var/log/syslog
chmod 640 /var/log/auth.log

# Secure shared memory
echo "tmpfs /run/shm tmpfs defaults,noexec,nosuid,size=1G 0 0" >> /etc/fstab

# Disable unused filesystems
echo "install dccp /bin/true" >> /etc/modprobe.d/CIS.conf
echo "install sctp /bin/true" >> /etc/modprobe.d/CIS.conf
echo "install rds /bin/true" >> /etc/modprobe.d/CIS.conf
echo "install tipc /bin/true" >> /etc/modprobe.d/CIS.conf

log_success "System hardening applied"

# ============================================
# 8. Install Security Tools
# ============================================
log_info "Step 8: Installing security monitoring tools..."

apt-get install -y htop lynx rkhunter chkrootkit

# Update rkhunter database
rkhunter --propupdate

log_success "Security tools installed"

# ============================================
# 9. Configure Log Rotation
# ============================================
log_info "Step 9: Configuring log rotation..."

cat > /etc/logrotate.d/telebot << 'EOF'
/opt/tele-mind/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 telebot telebot
    sharedscripts
    postrotate
        systemctl reload telebot > /dev/null 2>&1 || true
    endscript
}
EOF

log_success "Log rotation configured"

# ============================================
# 10. Network Time Sync
# ============================================
log_info "Step 10: Configuring time synchronization..."

apt-get install -y chrony
systemctl enable chrony
systemctl start chrony

log_success "Time synchronization configured"

# ============================================
# Summary
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "EC2 Security Hardening Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Summary of changes:"
echo "  ✅ System packages updated"
echo "  ✅ Non-root user '$ADMIN_USER' created"
echo "  ✅ SSH hardened (no password, no root login)"
echo "  ✅ Firewall (UFW) enabled"
echo "  ✅ Fail2Ban installed"
echo "  ✅ Automatic security updates enabled"
echo "  ✅ System hardening applied"
echo "  ✅ Security tools installed"
echo "  ✅ Log rotation configured"
echo ""
log_warn "IMPORTANT: Next Steps"
echo "  1. Add your SSH public key to /home/$ADMIN_USER/.ssh/authorized_keys"
echo "  2. Set password for $ADMIN_USER: sudo passwd $ADMIN_USER"
echo "  3. Test SSH login with: ssh $ADMIN_USER@$(hostname -I | awk '{print $1}')"
echo "  4. Disconnect and verify root login is disabled"
echo "  5. Check Fail2Ban status: sudo fail2ban-client status sshd"
echo ""
echo "Firewall status:"
ufw status verbose
echo ""
echo "Listening ports:"
ss -tuln | grep LISTEN
echo ""
