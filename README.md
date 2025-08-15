# Проект «Mriya»

Простое приложение «клиент-сервер»: фронтенд на React (Vite + TypeScript) и бэкенд на FastAPI.

---

## Требования

* Python 3.11+
* Node.js 18+

---

## Быстрый старт

### 1. Запуск бэкенда

```bash
# (рекомендуется) создать виртуальное окружение
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# установить зависимости
pip install -r requirements.txt

# запустить сервер (порт 8000)
uvicorn app.main:app --reload
```

Сервис будет доступен по адресу: <http://localhost:8000>

---

### 2. Запуск фронтенда

```bash
cd frontend
npm install      # установка зависимостей
npm run dev      # dev-режим (порт 5173)
```

Приложение откроется по адресу: <http://localhost:5173>

На странице есть кнопка «Получить сообщение». Нажмите её — под кнопкой отобразится ответ бэкенда «Привет от бэкенда!».

---

## Конфигурация API

Базовый URL API вынесен в файл `frontend/src/config.ts`:

```ts
export const API_URL = "http://localhost:8000";
```

При необходимости измените значение (например, для продакшена) — все сервисы автоматически подхватят новый адрес.

---

## Полезные скрипты

### Бэкенд

```bash
uvicorn backend.app.main:app --reload   # запуск в dev-режиме
```

### Фронтенд

```bash
npm run dev      # запуск режима разработки
npm run build    # production-сборка
npm run preview  # просмотр production-сборки локально
```
