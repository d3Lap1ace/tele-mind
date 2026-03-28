# 🔐 安全配置指南

本文档说明如何保护敏感配置信息，防止 API Key 和其他密钥泄露。

---

## 📋 目录

1. [本地开发安全](#1-本地开发安全)
2. [服务器部署安全](#2-服务器部署安全)
3. [Git 仓库安全](#3-git-仓库安全)
4. [密钥管理最佳实践](#4-密钥管理最佳实践)
5. [应急处理](#5-应急处理)

---

## 1. 本地开发安全

### ✅ 已实施的保护措施

#### 1.1 .gitignore 配置
`.env` 文件已被排除在 Git 跟踪之外。

#### 1.2 Git Pre-commit Hooks
每次提交前自动检查：
- 是否试图提交 `.env` 文件
- 代码中是否包含 API Key

#### 1.3 日志脱敏
使用 Pino logger 自动移除敏感信息：
```typescript
// src/logger/index.ts 中已实现
function sanitize(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/sk-[A-Za-z0-9]{48}/gi, 'sk-[REDACTED]')
    // ... 更多模式
}
```

### 📝 开发者操作指南

**本地配置文件（不提交）：**
```bash
# 创建本地配置
cp .env.example .env.local
nano .env.local

# .env.local 也在 .gitignore 中
```

**验证配置是否安全：**
```bash
# 检查是否有敏感文件被跟踪
git ls-files | grep -E '\.env$|secret|key'

# 搜索代码中的硬编码密钥
grep -r "sk-" src/ --exclude-dir=node_modules
grep -r "api_key" src/ --exclude-dir=node_modules
```

---

## 2. 服务器部署安全

### 2.1 文件权限设置

**在服务器上执行：**
```bash
# 设置正确的文件权限
cd /opt/tele-mind

# .env 文件仅所有者可读写
chmod 600 .env

# 或更严格：只读
chmod 400 .env

# 确保目录权限正确
chmod 755 .
chmod -R 644 src/
chmod -R 755 src/

# PM2 日志目录
chmod 700 logs/
```

### 2.2 使用非 root 用户运行

```bash
# 创建专用用户
sudo useradd -m -s /bin/bash telebot
sudo usermod -aG sudo telebot

# 设置项目所有权
sudo chown -R telebot:telebot /opt/tele-mind

# 切换用户运行
su - telebot
cd /opt/tele-mind
pm2 start ecosystem.config.js
```

### 2.3 环境变量安全存储

**方案 A：使用 systemd EnvironmentFile（推荐）**

```bash
# 创建安全的配置文件
sudo mkdir -p /etc/telebot
sudo nano /etc/telebot/production.env
sudo chmod 600 /etc/telebot/production.env

# 创建 systemd 服务
sudo nano /etc/systemd/system/telebot.service
```

`/etc/systemd/system/telebot.service`:
```ini
[Unit]
Description=TeleMind Telegram Bot
After=network.target

[Service]
Type=simple
User=telebot
WorkingDirectory=/opt/tele-mind
EnvironmentFile=/etc/telebot/production.env
ExecStart=/usr/bin/node /opt/tele-mind/dist/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable telebot
sudo systemctl start telebot
sudo systemctl status telebot
```

**方案 B：使用 AWS Secrets Manager（云原生）**

```bash
# 安装 AWS CLI
sudo apt-get install -y awscli

# 存储密钥
aws secretsmanager create-secret \
  --name telebot/production \
  --secret-string '{"TELEGRAM_BOT_TOKEN":"xxx","OPENAI_API_KEY":"xxx"}'

# 在启动脚本中获取
aws secretsmanager get-secret-value \
  --secret-id telebot/production \
  --query SecretString \
  --output text > /etc/telebot/production.env
```

### 2.4 防火墙配置

```bash
# 只开放必要端口
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 443/tcp  # HTTPS for webhook
sudo ufw enable
```

---

## 3. Git 仓库安全

### 3.1 GitHub Secrets 设置（CI/CD）

**GitHub → Settings → Secrets and variables → Actions:**

#### 部署所需 Secrets

| Secret 名称 | 描述 | 示例值 |
|------------|------|--------|
| `EC2_HOST` | EC2 服务器 IP 或域名 | `ec2-xxx.compute.amazonaws.com` |
| `EC2_USER` | SSH 登录用户 | `admin` |
| `EC2_SSH_PRIVATE_KEY` | SSH 私钥（完整内容） | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

⚠️ **重要**: `EC2_SSH_PRIVATE_KEY` 应该包含完整的私钥文件内容，包括 BEGIN/END 标记和换行。

#### 应用密钥 Secrets（可选）

如需在 CI/CD 中传递 API 密钥：

| Secret 名称 | 描述 |
|------------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token |
| `OPENAI_API_KEY` | OpenAI API Key |
| `ANTHROPIC_API_KEY` | Anthropic API Key |

**建议**: 生产环境密钥直接在服务器上配置，不要通过 GitHub Actions 传递。

### 3.2 分支保护

**推荐配置（在 GitHub 设置中）：**

`Settings → Branches → Add rule`

- ✅ 保护 `main` 分支
- ✅ 要求 PR review（至少 1 人）
- ✅ 要求状态检查通过（CI/CD 测试）
- ✅ 禁止直接推送
- ✅ 要求线性历史记录

### 3.3 GitHub Actions 安全

**使用环境保护生产部署：**

1. 创建环境：`Settings → Environments → New environment`
   - 名称: `production`
   - 添加保护规则：要求等待期、受限制的环境

2. 更新 workflow 使用环境：
   ```yaml
   deploy:
     environment: production
     runs-on: ubuntu-latest
     # ...
   ```

**限制 GitHub Actions 权限：**

在 `Settings → Actions → General`：
- ✅ 读取和写入权限（根据需要）
- ✅ 允许 GitHub Actions 创建和批准 PR
- ❌ 禁用工作流重新运行（如需严格控制）

### 3.3 提交前检查

每次推送前运行：
```bash
# 本地安全检查
npm run security-check

# 或手动检查
git diff --cached | grep -i "api.*key\|secret\|password"
```

---

## 4. 密钥管理最佳实践

### 4.1 API Key 轮换

**定期更换密钥（建议每 90 天）：**
```bash
# OpenAI: https://platform.openai.com/api-keys
# 创建新 key → 删除旧 key → 更新 .env → pm2 restart tele-mind
```

### 4.2 使用不同环境的密钥

| 环境 | 密钥 | 用途 |
|-----|------|-----|
| Development | `sk-dev-...` | 本地开发 |
| Staging | `sk-stage-...` | 测试环境 |
| Production | `sk-prod-...` | 生产环境 |

### 4.3 密钥最小权限原则

- API Key 仅授予必需的权限
- 设置使用限额和过期时间
- 监控异常使用

---

## 5. 应急处理

### 5.1 密钥已泄露怎么办？

**立即行动：**
1. **撤销泄露的密钥**
   ```bash
   # OpenAI Dashboard → Revoked
   # 或 API: DELETE https://api.openai.com/v1/api-keys/{key_id}
   ```

2. **生成新密钥并更新配置**
   ```bash
   # 服务器上
   nano .env  # 更新密钥
   pm2 restart tele-mind
   ```

3. **检查 Git 历史是否包含密钥**
   ```bash
   git log --all --full-history --source -- "*env*"
   git log -p -S "sk-你的密钥"
   ```

4. **如果已提交到 Git**
   ```bash
   # 使用 BFG Repo-Cleaner 或 git-filter-repo 清除
   # 然后强制推送（谨慎！）
   git push origin --force --all
   ```

5. **通知相关服务**
   - OpenAI/Anthropic：标记密钥为已泄露
   - GitHub：联系支持删除敏感数据
   - 团队成员：轮换所有相关密钥

### 5.2 检测泄露

**定期扫描：**
```bash
# 使用 truffleHog
docker run --rm -v "$PWD:/pwd" trufflesecurity/trufflehog:latest git file:///pwd --json

# 或使用 gitleaks
docker run --rm -v "$PWD:/pwd" zricethezav/gitleaks:latest detect --source /pwd --verbose
```

---

## ✅ 安全检查清单

部署前确认：

- [ ] `.env` 文件在 `.gitignore` 中
- [ ] `.env` 文件未被 Git 跟踪
- [ ] 服务器上 `.env` 权限为 `600` 或 `400`
- [ ] 使用非 root 用户运行
- [ ] 日志中无敏感信息（已脱敏）
- [ ] 防火墙已配置
- [ ] 不同环境使用不同密钥
- [ ] 设置了密钥轮换计划
- [ ] 团队成员知晓安全规范
- [ ] 有应急处理预案

### CI/CD 额外检查

- [ ] GitHub Secrets 已正确配置
- [ ] SSH 密钥仅用于 GitHub Actions
- [ ] 服务器已运行安全加固脚本
- [ ] 分支保护规则已启用
- [ ] 生产环境需要手动批准
- [ ] Fail2Ban 已启用防止暴力破解
- [ ] 自动安全更新已配置

---

## 📚 相关资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security/getting-started/security-best-practices)
- [12-Factor App: Config](https://12factor.net/config)

---

**最后更新：** 2026-03-29
