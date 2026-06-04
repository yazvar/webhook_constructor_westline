# Westline · Backend

Серверная часть для приложения Westline Constructor: вход через Discord (OAuth2),
общая база пользователей, общие **live-пресеты** (рассылка в реальном времени через SSE)
и админ-функции.

Стек: **Node.js + Express + SQLite** (`better-sqlite3`), JWT-сессии.

## 1. Создание Discord-приложения

1. Открой [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**, дай имя (например, `Westline`).
2. Вкладка **OAuth2** → скопируй **Client ID** и **Client Secret** (Reset Secret, если нужно).
3. Там же в **Redirects** добавь URL коллбэка ровно как он будет у бэкенда:
   - локально: `http://localhost:3001/auth/discord/callback`
   - на проде: `https://api.твойдомен.com/auth/discord/callback`
4. Сохрани.

Узнать свой Discord ID (для админов): включи в Discord *Настройки → Расширенные →
Режим разработчика*, затем ПКМ по своему профилю → **Скопировать ID**.

## 2. Настройка и запуск

```bash
cd server
npm install
cp .env.example .env          # Windows: copy .env.example .env
# заполни .env: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, JWT_SECRET, ADMIN_IDS
npm start                     # или npm run dev (авто-перезапуск)
```

Сгенерировать `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Админы по умолчанию (в `.env` → `ADMIN_IDS`):
`1202701219081224273`, `743400950646964264`.

## 3. Что отдаёт API

| Метод | Путь | Доступ | Назначение |
|-------|------|--------|------------|
| GET | `/api/health` | все | проверка соединения (для клиента) |
| GET | `/auth/discord` | все | начать вход (редирект на Discord) |
| GET | `/auth/discord/callback` | Discord | обмен кода, выдача JWT |
| GET | `/api/me` | сессия | текущий пользователь + `isAdmin` |
| GET | `/api/presets` | сессия | общие пресеты |
| POST | `/api/presets` | админ | создать пресет (live для всех) |
| PUT | `/api/presets/:id` | админ | изменить пресет |
| DELETE | `/api/presets/:id` | админ | удалить пресет |
| GET | `/api/users` | админ | все зарегистрированные |
| GET | `/api/stats` | админ | сводка (онлайн, активные, всего) |
| POST | `/api/users/:id/ban` | админ | бан/разбан пользователя |
| POST | `/api/announce` | админ | объявление всем (live) |
| GET | `/api/events` | сессия | поток событий (SSE) |

## 4. База данных

SQLite-файл по пути из `DB_PATH` (по умолчанию `server/data/westline.db`).
Папка `data/` и `.env` в `.gitignore` — секреты и БД не попадают в репозиторий.

## 5. Деплой

Подойдёт любой хостинг Node (VPS, Railway, Render, Fly.io). Важно:

- В `.env` укажи реальный `PUBLIC_URL` (https) — от него строится redirect URI.
- Тот же redirect URI добавь в Discord Portal.
- В приложении (frontend) пропиши адрес бэкенда: переменная сборки `VITE_API_URL`
  (см. `westline-constructor/.env.example`).
