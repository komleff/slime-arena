#!/bin/bash
# Создание non-root пользователя slime-ro для read-only диагностики prod-сервера.
# Запускать через web-console VPS Timeweb (под root).
#
# ВАЖНО: НЕ давать slime-ro группу docker — это equivalent root через container escape:
#   docker run --rm -v /:/host alpine chroot /host /bin/sh
# Доступ к docker-командам — только через sudoers-allowlist на конкретные read-only вызовы.
#
# После успешного завершения агент сможет ходить как:
#   ssh -i ~/.ssh/deploy_key slime-ro@147.45.147.175

set -euo pipefail

USER_NAME="slime-ro"
PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINo5gMl1o1FBzLNrYizyBULaAVqgZRhQ2l/KR0jy+zbZ ai@fractal-xl"

echo "[1/4] Создание пользователя $USER_NAME (без пароля)..."
if ! id -u "$USER_NAME" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$USER_NAME"
fi
passwd -l "$USER_NAME"

echo "[2/4] Установка ключа..."
install -d -m 700 -o "$USER_NAME" -g "$USER_NAME" "/home/$USER_NAME/.ssh"
echo "$PUBKEY" > "/home/$USER_NAME/.ssh/authorized_keys"
chmod 600 "/home/$USER_NAME/.ssh/authorized_keys"
chown "$USER_NAME:$USER_NAME" "/home/$USER_NAME/.ssh/authorized_keys"

echo "[3/4] Sudoers-allowlist (только read-only)..."
cat > /etc/sudoers.d/slime-ro <<'SUDOERS'
slime-ro ALL=(root) NOPASSWD: /usr/bin/docker ps, /usr/bin/docker ps -a, /usr/bin/docker stats --no-stream, /usr/bin/docker logs *, /usr/bin/docker inspect *, /usr/bin/docker compose ps, /usr/bin/journalctl *, /usr/bin/df *, /usr/bin/free *, /usr/bin/uptime, /usr/bin/cat /proc/[0-9]*/limits, /usr/bin/cat /proc/[0-9]*/status
SUDOERS
chmod 440 /etc/sudoers.d/slime-ro
visudo -c

echo "[4/4] Проверки..."
id "$USER_NAME"
echo "--- sudo -l для $USER_NAME: ---"
su - "$USER_NAME" -c 'sudo -n -l' | head -30 || true
echo "--- проверка что docker group НЕ выдан: ---"
groups "$USER_NAME"

echo
echo "Готово. Агент подключается:"
echo "  ssh -i ~/.ssh/deploy_key slime-ro@147.45.147.175"
