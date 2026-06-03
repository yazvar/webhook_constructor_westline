# Westline · Discord Webhook Constructor

Конструктор сообщений для **Discord-вебхуков** — по принципу [discohook](https://discohook.org):
собираешь сообщение (текст + эмбеды) в редакторе, видишь живое превью как в Discord и
отправляешь одним нажатием на свой webhook URL.

Интерфейс оформлен в эстетике **Nothing OS**: монохромная точечная сетка, dot-matrix
шрифт (`Doto`), единственный сигнальный акцент — красный.

## Стек

- **React 19** + **Vite** (JavaScript / JSX)
- Без внешних UI-библиотек — собственные компоненты и CSS
- Состояние: `useReducer` + Context, автосохранение в `localStorage`

## Возможности

- Переопределение имени и аватара отправителя
- Текст сообщения с поддержкой Discord-markdown
- До 10 эмбедов: автор, заголовок, описание, цвет, поля (до 25, inline), картинка,
  thumbnail, подвал, метка времени
- Перемещение / дублирование / удаление эмбедов и полей
- Живое превью с рендером markdown (жирный, курсив, код, ссылки, спойлеры, цитаты и т.д.)
- Валидация и отправка на вебхук, экспорт payload в JSON
- Адаптивная вёрстка

## Запуск (веб)

```bash
npm install
npm run dev      # дев-сервер
npm run build    # прод-сборка в dist/
npm run lint     # ESLint
```

## Десктоп-приложение (Electron)

Приложение можно собрать как нативное приложение для Windows/macOS/Linux.

```bash
npm run app:dev          # запустить как десктоп-приложение (dev, с HMR)
npm run app:build        # собрать установщик в release/
npm run app:build:dir    # собрать распакованную версию (без установщика)
```

- **Установщик Windows:** `release/Westline Constructor Setup <версия>.exe` (NSIS,
  можно выбрать папку установки, создаются ярлыки).
- **Портативная версия:** `release/win-unpacked/Westline Constructor.exe` — запускается
  без установки.

Код-подпись отключена (`signAndEditExecutable: false`), поэтому сборка не требует
сертификата и прав администратора. Внешние ссылки из эмбедов открываются в браузере по
умолчанию, данные (пресеты в IndexedDB, настройки) хранятся в профиле приложения и
переживают перезапуск.

Чтобы задать свою иконку приложения — положите `build/icon.ico` (Win) / `build/icon.icns`
(mac) / `build/icon.png` 512×512 (Linux), electron-builder подхватит их автоматически.

Где взять webhook: настройки канала Discord → **Integrations → Webhooks → New Webhook → Copy URL**.

## Структура проекта

```
electron/
├─ main.cjs                  # главный процесс Electron (окно, загрузка dev/prod)
└─ preload.cjs              # изолированный preload-мост

src/
├─ main.jsx                  # точка входа
├─ App.jsx                   # каркас приложения (провайдер + layout)
├─ App.css                   # layout-стили оболочки
├─ index.css                 # тема Nothing OS (токены, шрифты, фон-сетка)
│
├─ context/
│  ├─ messageStore.js        # объект Context + хук useMessage
│  ├─ MessageContext.jsx     # провайдер + persistence (localStorage)
│  └─ messageReducer.js      # reducer всего черновика сообщения
│
├─ hooks/
│  ├─ useLocalStorage.js     # переиспользуемый persisted-state
│  └─ useSender.js           # статус отправки на вебхук
│
├─ utils/
│  ├─ discord.js             # фабрики, лимиты, валидация, buildPayload, sendToWebhook
│  └─ markdown.js            # Discord-markdown → HTML для превью
│
└─ components/
   ├─ ui/                    # примитивы: Button, Field, Collapsible (+ ui.css)
   ├─ layout/                # Header, WebhookBar (панель отправки)
   ├─ editor/                # MessageEditor, EmbedEditor, FieldsEditor (+ editor.css)
   └─ preview/               # DiscordPreview, EmbedPreview (+ preview.css)
```

## Важно про CORS

Discord-вебхуки разрешают запросы из браузера (`Access-Control-Allow-Origin`),
поэтому отправка работает напрямую с фронтенда без прокси.
URL вебхука хранится только локально в браузере и никуда не передаётся, кроме Discord.
