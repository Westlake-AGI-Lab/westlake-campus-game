#!/bin/zsh
cd "${0:A:h}"
if ! command -v node >/dev/null; then
  echo '需要 Node.js 22.12 或更新版本。'; read 'REPLY?按回车关闭'; exit 1
fi
if [[ ! -d node_modules ]]; then
  npm ci --include=optional || exit 1
fi
npm run build && npm start
