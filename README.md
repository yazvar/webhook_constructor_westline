# webhook_constructor_westline

Конструктор сообщений для Discord-вебхуков (стиль Nothing OS) с входом через Discord,
общей базой пользователей, live-пресетами, админ-панелью и авто-обновлениями.

## Структура

- **`westline-constructor/`** — клиент: React + Vite, упаковка в десктоп через Electron.
  Вход через Discord, проверка интернета, live-пресеты, админ-панель, авто-обновления.
  См. [`westline-constructor/README.md`](westline-constructor/README.md).
- **`server/`** — бэкенд: Node + Express + SQLite. Discord OAuth2, база пользователей,
  общие пресеты с рассылкой в реальном времени (SSE), админ-API.
  См. [`server/README.md`](server/README.md).

## Быстрый старт

```bash
# 1) Бэкенд
cd server
npm install
copy .env.example .env       # заполни DISCORD_CLIENT_ID/SECRET, JWT_SECRET, ADMIN_IDS
npm start

# 2) Клиент (в другом терминале)
cd westline-constructor
npm install
copy .env.example .env       # VITE_API_URL=http://localhost:3001
npm run app:dev              # десктоп-приложение (или npm run dev для веба)
```

Перед входом создай Discord-приложение и добавь redirect
`http://localhost:3001/auth/discord/callback` — подробности в `server/README.md`.

Админ-доступ по умолчанию: Discord ID `1202701219081224273` и `743400950646964264`.
