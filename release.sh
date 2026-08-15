#!/usr/bin/env bash
# ── 发版一条龙: 构建 → tag → GitHub Release(挂部署包) ──────────────
# 用法: ./release.sh v20260901 "版本标题" [部署包说明]
# 前置: git 工作区干净、已 push、gh 已登录(Edisonzszs)

set -euo pipefail
cd "$(dirname "$0")"

TAG="${1:?用法: ./release.sh v20260901 \"版本标题\" [部署包说明]}"
TITLE="${2:?缺版本标题}"
NOTE="${3:-部署到服务器 /opt/chuhai-test/dist/ (nginx location /chuhai-test/)，解压覆盖后浏览器强刷}"

REPO="Edisonzszs/oversea-agent"
PKG_PREFIX="chuhai-deploy"   # 部署包文件名前缀(纯 ASCII，避免 GitHub 资产名乱码)

echo "══ 1/4 检查工作区 ══"
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ 有未提交改动，先 commit+push 再发版:"; git status -s; exit 1
fi
LOCAL=$(git rev-parse HEAD); REMOTE=$(git rev-parse "@{u}" 2>/dev/null || echo none)
[ "$LOCAL" = "$REMOTE" ] || { echo "✗ 本地未与远端同步，先 git push"; exit 1; }

echo "══ 2/4 构建(vite build → dist-prod) ══"
npm run build

STAMP="${TAG#v}"
PKG="/tmp/${PKG_PREFIX}-${STAMP}.zip"
rm -f "$PKG"
( cd dist-prod && powershell -Command "Compress-Archive -Path '*' -DestinationPath '$(cygpath -w "$PKG" 2>/dev/null || echo "$PKG")' -Force" )
echo "包: $PKG ($(du -h "$PKG" | cut -f1))"

echo "══ 3/4 创建 tag + Release ══"
gh release create "$TAG" --title "$TITLE" \
  --notes "## 部署包
- \`${PKG_PREFIX}-${STAMP}.zip\` — ${NOTE}

## 源码
Source code (zip/tar.gz) 见页面底部 Assets；或 \`git clone -b $TAG https://github.com/$REPO.git\`

## 对应提交
$(git log --oneline -1)" \
  "$PKG"

echo "══ 4/4 完成 ══"
gh release view "$TAG" --json url --jq .url
