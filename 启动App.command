#!/bin/zsh

APP_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$APP_DIR" || exit 1

if curl -sS http://localhost:3000/ >/dev/null 2>&1; then
  open http://localhost:3000/
  exit 0
fi

export WRANGLER_LOG_PATH=".wrangler/wrangler.log"

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js，请先安装 Node.js 22.13 或更高版本。"
  exit 1
fi

./node_modules/.bin/vinext dev &
SERVER_PID=$!

for attempt in {1..30}; do
  if curl -sS http://localhost:3000/ >/dev/null 2>&1; then
    open http://localhost:3000/
    wait "$SERVER_PID"
    exit $?
  fi
  sleep 1
done

echo "App 启动超时，请将本窗口中的报错发给 Codex。"
wait "$SERVER_PID"
