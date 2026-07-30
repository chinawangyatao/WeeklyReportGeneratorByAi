#!/usr/bin/env bash
# 一键安装:确保 Node 24 + 安装依赖 + 交互式配置 API key。
# 用法: clone 仓库后运行 ./install.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "==> 1/3 检查 Node(需要 24+)"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
  nvm use 24 2>/dev/null || nvm install 24
fi
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未找到 Node.js。请先安装 Node 24(推荐 nvm: https://nvm.sh )"
  exit 1
fi
node_major="$(node -v | sed 's/v\([0-9][0-9]*\).*/\1/')"
if [ "$node_major" -lt 24 ]; then
  echo "❌ 需要 Node 24+,当前 $(node -v)。可用 nvm install 24。"
  exit 1
fi
echo "    Node: $(node -v)"

echo "==> 2/3 安装依赖(用 npm,不要用 bun)"
npm install

echo "==> 3/3 配置 API key(交互式:DeepSeek + 腾讯文档,写入 .env)"
npm run setup

echo ""
echo "✅ 安装完成。启动:  npm run dev"
echo "   然后: 在 TUI 里输入「生成周报」或「查看需求/迭代」"
