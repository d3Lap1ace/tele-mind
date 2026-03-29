# CI/CD 部署指南

本指南只保留当前仓库可执行的最小流程。

## 1. 初始化 EC2

- AMI: Ubuntu Server 22.04/24.04 LTS
- Security Group: 至少开放 `22`
- 如果保持当前 `.github/workflows/deploy.yml` 不变，还需要让 GitHub Actions 能访问 `3000` 端口做健康检查

先用云主机默认用户登录并执行加固脚本：

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
wget https://raw.githubusercontent.com/d3Lap1ace/tele-mind/main/scripts/ec2-security-hardening.sh
sudo bash ec2-security-hardening.sh
```

如果你的镜像默认用户不是 `ubuntu`，替换成实际用户名即可。

该脚本会创建 `deploy` 用户，并关闭 SSH 密码登录。

## 2. 配置部署 SSH 密钥

在本地生成部署密钥：

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/gh_deploy_key -N ""
```

用云主机默认用户把公钥写入 `deploy`：

```bash
cat ~/.ssh/gh_deploy_key.pub | ssh -i your-key.pem ubuntu@your-ec2-ip \
  'sudo mkdir -p /home/deploy/.ssh && \
   sudo tee -a /home/deploy/.ssh/authorized_keys >/dev/null && \
   sudo chown -R deploy:deploy /home/deploy/.ssh && \
   sudo chmod 700 /home/deploy/.ssh && \
   sudo chmod 600 /home/deploy/.ssh/authorized_keys'
```

验证：

```bash
ssh -i ~/.ssh/gh_deploy_key deploy@your-ec2-ip
```

## 3. 服务器最小准备

继续用云主机默认用户完成一次性初始化：

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

安装运行时并准备目录：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
sudo npm install -g pm2

sudo mkdir -p /opt/tele-mind /opt/tele-mind/logs /opt/tele-mind/backups
sudo chown -R deploy:deploy /opt/tele-mind
```

然后切到 `deploy` 用户准备环境文件：

```bash
ssh -i ~/.ssh/gh_deploy_key deploy@your-ec2-ip
cd /opt/tele-mind
nano .env
chmod 600 .env
```

至少填这些配置：

```bash
TELEGRAM_BOT_TOKEN=...
LLM_PROVIDER=openai
OPENAI_API_KEY=...
ALLOWED_USER_IDS=123456789
ADMIN_USER_IDS=123456789
HEALTH_CHECK_PORT=3000
NODE_ENV=production
```

如果你走的是 `scripts/secure-deploy.sh` 这条链路，环境文件路径改为 `/etc/tele-mind/production.env`。

## 4. 配置 GitHub Secrets

仓库里需要这 3 个 Secrets：

| Secret | 值 |
| --- | --- |
| `EC2_HOST` | EC2 IP 或域名 |
| `EC2_USER` | `deploy` |
| `EC2_SSH_PRIVATE_KEY` | `~/.ssh/gh_deploy_key` 私钥内容 |

用 GitHub CLI 配置：

```bash
gh auth login
gh secret set EC2_HOST --body "your-ec2-ip"
gh secret set EC2_USER --body "deploy"
gh secret set EC2_SSH_PRIVATE_KEY < ~/.ssh/gh_deploy_key
```

## 5. 部署

推送到 `main` 会触发自动部署：

```bash
git push origin main
```

查看状态：

```bash
gh run list
gh run view [run-id]
```

## 6. 添加新的 Telegram 管理员

这里的“管理员”是 Telegram 机器人管理员，不是服务器上的 `deploy` 用户。

先从 Telegram 的 `@userinfobot` 获取对方的数字 user ID，然后编辑运行时环境文件：

```bash
ssh -i ~/.ssh/gh_deploy_key deploy@your-ec2-ip
cd /opt/tele-mind
nano .env
```

如果启用了白名单，新管理员必须同时出现在这两个变量里：

```bash
ALLOWED_USER_IDS=123456789,987654321
ADMIN_USER_IDS=123456789
```

修改后重启：

```bash
pm2 restart tele-mind
# 或
sudo systemctl restart tele-mind
```

如果你使用的是 `scripts/secure-deploy.sh`，请改 `/etc/tele-mind/production.env`。

## 7. 常见问题

### SSH 报错 `Permission denied (publickey)`

- 不要直接对 `deploy` 用 `ssh-copy-id`
- 先用云主机默认用户登录，再把公钥写到 `/home/deploy/.ssh/authorized_keys`
- 确认你连接的是 `deploy@your-ec2-ip`，不是 `admin@your-ec2-ip`

### 新管理员仍然不可用

- `ADMIN_USER_IDS` 写的是 Telegram user ID，不是用户名
- 如果 `ALLOWED_USER_IDS` 非空，新管理员也必须加入 `ALLOWED_USER_IDS`
- 改完 `.env` 后必须重启进程

### 健康检查失败

当前 workflow 会从 GitHub Actions 直接访问：

```bash
http://EC2_HOST:3000/health
```

如果 `3000` 没对 GitHub Actions 放行，部署最后一步会失败。

## 8. 当前流程里已知的问题

- `.github/workflows/deploy.yml` 的手动触发目前走的是 `rollback`，不是手动部署
- `.github/workflows/deploy.yml` 里备份路径变量写成了 `DEPATH_PATH`
