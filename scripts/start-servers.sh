#!/bin/bash
# Bash скрипт для запуска сервера и клиента в отдельных терминалах
# Использование: ./scripts/start-servers.sh

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

# Создаём директорию логов, если её нет
mkdir -p "$LOG_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 SLIME ARENA — Запуск серверов"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📂 Корневая директория: $PROJECT_ROOT"
echo "📝 Логи: $LOG_DIR"
echo ""

# Проверяем наличие node_modules
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    echo "⚠️  node_modules не найдены. Запускаю npm install..."
    cd "$PROJECT_ROOT"
    npm install
fi

# Функция для завершения всех процессов при выходе
cleanup() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🛑 Остановка серверов..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    kill $SERVER_PID $CLIENT_PID 2>/dev/null
    wait $SERVER_PID $CLIENT_PID 2>/dev/null
    echo "✓ Серверы остановлены"
}

trap cleanup EXIT INT TERM

# Определяем команду для открытия терминала в зависимости от ОС
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "▶️  Запуск сервера (ws://localhost:2567)"
    osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_ROOT' && npm run dev:server\""
    sleep 2
    
    echo "▶️  Запуск клиента (http://localhost:5173)"
    osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_ROOT' && npm run dev:client\""
else
    # Linux - используем gnome-terminal или xterm
    SERVER_LOG="$LOG_DIR/server.log"
    CLIENT_LOG="$LOG_DIR/client.log"
    
    echo "▶️  Запуск сервера (ws://localhost:2567)"
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd '$PROJECT_ROOT' && npm run dev:server 2>&1 | tee '$SERVER_LOG'" &
    elif command -v xterm &> /dev/null; then
        xterm -e "cd '$PROJECT_ROOT' && npm run dev:server 2>&1 | tee '$SERVER_LOG'" &
    else
        cd "$PROJECT_ROOT" && npm run dev:server > "$SERVER_LOG" 2>&1 &
    fi
    SERVER_PID=$!
    echo "   ✓ Сервер запущен (PID: $SERVER_PID)"
    echo ""
    
    sleep 2
    
    echo "▶️  Запуск клиента (http://localhost:5173)"
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd '$PROJECT_ROOT' && npm run dev:client 2>&1 | tee '$CLIENT_LOG'" &
    elif command -v xterm &> /dev/null; then
        xterm -e "cd '$PROJECT_ROOT' && npm run dev:client 2>&1 | tee '$CLIENT_LOG'" &
    else
        cd "$PROJECT_ROOT" && npm run dev:client > "$CLIENT_LOG" 2>&1 &
    fi
    CLIENT_PID=$!
    echo "   ✓ Клиент запущен (PID: $CLIENT_PID)"
    echo ""
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Оба сервера запущены!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🌐 Адреса:"
    echo "   Server:  ws://localhost:2567"
    echo "   Client:  http://localhost:5173"
    echo ""
    echo "📋 Команды:"
    echo "   • Закрыть сервер:  закройте окно сервера"
    echo "   • Закрыть клиент:  закройте окно клиента"
    echo "   • Остановить всё:  нажмите Ctrl+C в этом терминале"
    echo ""
    echo "📝 Логи: $LOG_DIR"
    echo ""
    
    wait $SERVER_PID $CLIENT_PID
fi
