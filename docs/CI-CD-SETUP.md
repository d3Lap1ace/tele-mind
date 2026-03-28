# 🚀 CI/CD 部署指南

本指南说明如何配置 GitHub Actions 自动部署到 AWS EC2。

---

## 📋 目录

1. [EC2 服务器安全加固](#1-ec2-服务器安全加固)
2. [SSH 密钥配置](#2-ssh-密钥配置)
3. [GitHub Secrets 配置](#3-github-secrets-配置)
4. [GitHub Actions 工作流](#4-github-actions-工作流)
5. [部署流程](#5-部署流程)
6. [故障排查](#6-故障排查)

---

## 1. EC2 服务器安全加固

### 1.1 启动新的 EC2 实例

在 AWS Console 创建 EC2 时：
- **AMI**: Ubuntu Server 22.04/24.04 LTS
- **Instance Type**: t3.micro 或更高
- **Security Group**: 仅开放 22 (SSH), 443 (HTTPS)
- **Key Pair**: 创建并下载 `.pem` 文件

### 1.2 连接并运行安全加固脚本

```bash
# 连接到服务器
ssh -i your-key.pem ubuntu@your-ec2-ip

# 下载并运行安全加固脚本
wget https://raw.githubusercontent.com/d3Lap1ace/tele-mind/main/scripts/ec2-security-hardening.sh
sudo bash ec2-security-hardening.sh
```

**脚本会自动完成：**
- ✅ 系统更新
- ✅ 创建非 root 用户 (`admin`)
- ✅ SSH 硬化配置
- ✅ 防火墙 (UFW) 配置
- ✅ Fail2Ban 入侵防护
- ✅ 自动安全更新
- ✅ 系统安全加固

### 1.3 添加 SSH 公钥

```bash
# 在本地生成 SSH 密钥对（如果还没有）
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_deploy

# 复制公钥到服务器
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub admin@your-ec2-ip

# 或者手动添加
cat ~/.ssh/github_actions_deploy.pub | ssh -i your-key.pem ubuntu@your-ec2-ip \
  'sudo mkdir -p /home/admin/.ssh && sudo tee -a /home/admin/.ssh/authorized_keys && sudo chown -R admin:admin /home/admin/.ssh && sudo chmod 700 /home/admin/.ssh && sudo chmod 600 /home/admin/.ssh/authorized_keys'

# 测试登录
ssh -i ~/.ssh/github_actions_deploy admin@your-ec2-ip
```

---

## 2. SSH 密钥配置

### 2.1 为 GitHub Actions 创建专用密钥

```bash
# 在本地创建部署专用密钥
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/gh_deploy_key -N ""

# 添加公钥到服务器
cat ~/.ssh/gh_deploy_key.pub | ssh -i your-key.pem ubuntu@your-ec2-ip \
  'sudo mkdir -p /home/admin/.ssh && sudo cat >> /home/admin/.ssh/authorized_keys'

# 测试登录
ssh -i ~/.ssh/gh_deploy_key admin@your-ec2-ip

# 如果成功，删除公钥（私钥保密）
rm ~/.ssh/gh_deploy_key.pub
```

### 2.2 配置服务器 sudo 权限

```bash
# 在服务器上配置 admin 用户无需密码执行特定命令
ssh -i your-key.pem ubuntu@your-ec2-ip

sudo tee /etc/sudoers.d/github-deploy << 'EOF'
admin ALL=(ALL) NOPASSWD:/bin/systemctl start tele-mind,/bin/systemctl stop tele-mind,/bin/systemctl restart tele-mind,/bin/systemctl status tele-mind,/bin/chown,/bin/mkdir
EOF

sudo chmod 440 /etc/sudoers.d/github-deploy
```

---

## 3. GitHub Secrets 配置

### 3.1 所需的 Secrets

在 GitHub 仓库中配置以下 Secrets：

**路径：** `Settings → Secrets and variables → Actions`

| Secret 名称 | 描述 | 示例值 |
|------------|------|--------|
| `EC2_HOST` | EC2 服务器 IP 或域名 | `ec2-xxx.compute.amazonaws.com` 或 `1.2.3.4` |
| `EC2_USER` | SSH 用户名 | `admin` |
| `EC2_SSH_PRIVATE_KEY` | SSH 私钥内容 | 整个私钥文件内容 |

### 3.2 添加 Secrets

**方式 A：通过 GitHub UI**

1. 进入仓库 Settings
2. 左侧菜单: Secrets and variables → Actions
3. 点击 "New repository secret"
4. 添加每个 secret

**方式 B：通过 GitHub CLI**

```bash
# 安装 GitHub CLI
brew install gh  # macOS
# 或 sudo apt install gh  # Ubuntu

# 登录
gh auth login

# 添加 secrets
gh secret set EC2_HOST --body "your-ec2-ip"
gh secret set EC2_USER --body "admin"

# 添加私钥（从文件读取）
gh secret set EC2_SSH_PRIVATE_KEY < ~/.ssh/gh_deploy_key
```

---

## 4. GitHub Actions 工作流

### 4.1 工作流文件

已创建的工作流：`.github/workflows/deploy.yml`

**触发条件：**
- 推送到 `main` 分支时自动部署
- 手动触发 (workflow_dispatch)
- 支持回滚操作

**工作流程：**
```
┌─────────────────────┐
│  Push to main       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Security Checks    │
│  - Secret scanning  │
│  - Build validation │
│  - Linting          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Deploy to EC2      │
│  - Build project    │
│  - Upload package   │
│  - Extract & start  │
│  - Health check     │
└─────────────────────┘
```

### 4.2 自定义工作流

如果需要修改部署行为，编辑 `.github/workflows/deploy.yml`:

```yaml
env:
  NODE_VERSION: '20'          # Node.js 版本
  APP_NAME: tele-mind         # 应用名称
  DEPLOY_PATH: /opt/tele-mind # 部署路径
```

---

## 5. 部署流程

### 5.1 首次手动部署

在服务器上准备环境：

```bash
# SSH 连接
ssh -i ~/.ssh/gh_deploy_key admin@your-ec2-ip

# 创建应用目录
sudo mkdir -p /opt/tele-mind
sudo chown admin:admin /opt/tele-mind

# 克隆仓库
cd /opt/tele-mind
git clone git@github.com:d3Lap1ace/tele-mind.git .

# 配置环境
cp .env.example .env
sudo nano .env  # 填入配置

# 安装依赖
npm install
npm run build

# 启动服务
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 按提示执行
```

### 5.2 自动部署

配置完成后，每次推送到 `main` 分支会自动触发部署：

```bash
git add .
git commit -m "feat: new feature"
git push origin main
```

**在 GitHub Actions 标签页查看部署进度：**
- 仓库 → Actions 标签
- 选择最新的 workflow run
- 查看实时日志

### 5.3 手动触发部署

在 GitHub 上：
1. 进入 Actions 标签
2. 选择 "Deploy to EC2" workflow
3. 点击 "Run workflow"
4. 选择分支并确认

### 5.4 回滚部署

如果部署出现问题：

1. 在 GitHub Actions 页面
2. 选择 "Rollback Deployment" workflow
3. 点击 "Run workflow"

---

## 6. 故障排查

### 6.1 SSH 连接失败

**问题：** `Permission denied (publickey)`

**解决方案：**
```bash
# 1. 确认公钥已添加到服务器
ssh -i ~/.ssh/gh_deploy_key admin@your-ec2-ip "cat ~/.ssh/authorized_keys"

# 2. 检查私钥格式（应该是一整行）
cat ~/.ssh/gh_deploy_key

# 3. 确认 GitHub Secret 中的私钥格式正确
# （包含 BEGIN/END 标记，中间的换行保留）

# 4. 测试 SSH 连接
ssh -i ~/.ssh/gh_deploy_key -v admin@your-ec2-ip
```

### 6.2 部署后服务未启动

**问题：** 健康检查失败

**解决方案：**
```bash
# 在服务器上检查日志
ssh admin@your-ec2-ip
pm2 logs tele-mind --lines 100

# 或查看 systemd 日志
sudo journalctl -u tele-mind -n 100

# 检查环境配置
cat /opt/tele-mind/.env

# 手动重启
pm2 restart tele-mind
# 或
sudo systemctl restart tele-mind
```

### 6.3 权限问题

**问题：** `Permission denied` when writing files

**解决方案：**
```bash
# 确保目录权限正确
sudo chown -R admin:admin /opt/tele-mind
sudo chmod -R 755 /opt/tele-mind

# 确保 .env 文件权限正确
chmod 600 /opt/tele-mind/.env

# 确保 sudo 配置正确
sudo cat /etc/sudoers.d/github-deploy
```

### 6.4 网络问题

**问题：** 无法访问 EC2

**检查清单：**
```bash
# 1. Security Group 确认
# AWS Console → EC2 → Security Groups
# 确认入站规则：
#   - SSH (22) 从你的 IP
#   - HTTP (80) / HTTPS (443) 从任何位置
#   - 自定义 TCP (3000) 用于健康检查（可选）

# 2. 防火墙状态
ssh admin@your-ec2-ip "sudo ufw status"

# 3. 服务是否在监听
ssh admin@your-ec2-ip "sudo ss -tuln | grep 3000"
```

---

## 📊 监控和日志

### 查看部署历史

```bash
# GitHub Actions UI
# 仓库 → Actions → 查看所有 workflow runs

# 或使用 GitHub CLI
gh run list
gh run view [run-id]
```

### 实时日志

```bash
# GitHub Actions 日志
gh run watch

# 服务器日志
ssh admin@your-ec2-ip "pm2 logs tele-mind"
ssh admin@your-ec2-ip "sudo journalctl -u tele-mind -f"
```

---

## 🔐 安全最佳实践

### 1. 密钥管理
- ✅ 使用专用的部署密钥对
- ✅ 定期轮换 SSH 密钥
- ✅ 私钥仅存储在 GitHub Secrets 中
- ✅ 限制 GitHub Actions 权限（最小权限原则）

### 2. 网络安全
- ✅ 使用 Security Group 限制访问
- ✅ 仅开放必要的端口
- ✅ 使用 VPN 或堡垒机访问 SSH
- ✅ 启用 Fail2Ban 防暴力破解

### 3. 应用安全
- ✅ 使用 systemd 而非 root 运行
- ✅ 配置日志轮转
- ✅ 定期备份部署
- ✅ 监控异常行为

### 4. GitHub 安全
- ✅ 启用分支保护
- ✅ 要求 PR review
- ✅ 使用环境（environment）进行生产部署
- ✅ 定期审计 GitHub Actions 日志

---

## 🎯 快速参考

```bash
# 常用命令
ssh -i ~/.ssh/gh_deploy_key admin@your-ec2-ip          # 连接服务器
gh secret list                                         # 查看 GitHub secrets
gh run list                                            # 查看部署历史
pm2 logs tele-mind                                     # 查看应用日志
sudo journalctl -u tele-mind -f                       # 查看 systemd 日志

# 部署流程
git push origin main                                   # 触发自动部署
gh workflow run deploy.yml                             # 手动触发部署

# 故障排查
gh run view [run-id] --log                             # 查看失败日志
ssh admin@ec2 "pm2 status"                             # 检查服务状态
curl http://ec2-ip:3000/health                         # 健康检查
```

---

**文档版本：** 1.0
**最后更新：** 2026-03-29
