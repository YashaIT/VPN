# VPN Invite Service

Минимальный VPN-сервис для сервера:

- администратор входит в панель управления;
- создает invite-ссылки для пользователей;
- пользователь открывает ссылку и регистрируется;
- сервис генерирует WireGuard-конфигурацию, показывает QR-код и отдает готовый `.conf` файл;
- при включенной опции сервис может сам дописывать peer в `wg0.conf`.

## Что уже реализовано

- админ-логин через переменные окружения;
- панель управления invite-ссылками;
- одноразовые и многоразовые invite-ссылки;
- регистрация пользователя по invite;
- генерация WireGuard-конфига через утилиту `wg`;
- скачивание конфигурации в формате `.conf`;
- QR-код для мобильного импорта;
- ручной или автоматический режим добавления peer в WireGuard;
- хранение данных в `data/db.json`;
- базовые защитные механизмы: CSRF, rate limit, security headers, валидация ввода.

## Быстрый старт локально

```bash
npm install
cp .env.example .env
npm start
```

Откройте:

- `http://localhost:3000/admin/login`

## Переменные окружения

- `APP_ORIGIN` - публичный адрес сайта, который будет вставляться в invite-ссылки
- `TRUST_PROXY` - ставьте `true`, если сервис работает за Nginx или другим reverse proxy
- `COOKIE_SECURE` - ставьте `true`, если сервис доступен только по HTTPS
- `ADMIN_USERNAME` - логин администратора
- `ADMIN_PASSWORD` - пароль администратора
- `SESSION_SECRET` - секрет для cookie-сессии
- `VPN_SERVER_ENDPOINT` - внешний адрес WireGuard сервера, например `vpn.mydomain.com:51820`
- `VPN_SERVER_PUBLIC_KEY` - публичный ключ сервера WireGuard
- `VPN_CLIENT_SUBNET_BASE` - база адресов клиентов, например `10.20.0.`
- `VPN_CLIENT_SUBNET_START` - с какого последнего октета начинать выдачу IP, например `10`
- `VPN_INTERFACE_NAME` - имя интерфейса WireGuard, обычно `wg0`
- `VPN_SERVER_CONFIG_PATH` - путь к серверному конфигу WireGuard, например `/etc/wireguard/wg0.conf`
- `VPN_AUTO_APPLY_PEERS` - `true`, если сервис должен автоматически добавлять peer
- `VPN_RELOAD_MODE` - `manual`, `syncconf` или `systemctl`

## Как протестировать сейчас

### Автоматический smoke-тест

```bash
npm test
```

Этот тест поднимает приложение временно, логинится админом, создает invite, регистрирует пользователя и скачивает конфиг.

### Ручная проверка локально

1. Скопируйте `.env.example` в `.env`.
2. Задайте реальные значения `ADMIN_PASSWORD`, `SESSION_SECRET`, `VPN_SERVER_ENDPOINT`, `VPN_SERVER_PUBLIC_KEY`.
3. Для первого прогона оставьте `VPN_AUTO_APPLY_PEERS=false`.
4. Запустите `npm start`.
5. Откройте `http://localhost:3000/admin/login`.
6. Войдите под админом.
7. Создайте invite-ссылку.
8. Откройте invite в новой вкладке.
9. Зарегистрируйте пользователя.
10. Проверьте:

- скачивается `.conf`;
- отображается QR-код;
- в админке появился пользователь;
- ссылка `peer` открывает корректный блок `[Peer]`.

### Проверка авто-добавления peer на Linux-сервере

1. Установите `wireguard-tools`.
2. Укажите:

```env
VPN_AUTO_APPLY_PEERS=true
VPN_SERVER_CONFIG_PATH=/etc/wireguard/wg0.conf
VPN_INTERFACE_NAME=wg0
VPN_RELOAD_MODE=syncconf
```

3. Запустите сервис с правами, позволяющими читать и писать `wg0.conf`.
4. Зарегистрируйте тестового пользователя.
5. Убедитесь, что в `/etc/wireguard/wg0.conf` появился новый `[Peer]`.

## Docker

Сборка и запуск:

```bash
docker compose up --build
```

По умолчанию compose:

- пробрасывает `3000:3000`;
- монтирует `./data` в контейнер;
- монтирует `/etc/wireguard:/etc/wireguard`;
- добавляет `NET_ADMIN`.

Если авто-добавление peer не нужно, оставьте:

```env
VPN_AUTO_APPLY_PEERS=false
```

## Автодеплой из GitHub на сервер

Теперь в проекте есть:

- CI workflow: [`.github/workflows/ci.yml`](C:\Users\shala\Documents\New project\.github\workflows\ci.yml)
- deploy workflow: [`.github/workflows/deploy.yml`](C:\Users\shala\Documents\New project\.github\workflows\deploy.yml)
- серверный скрипт деплоя: [`scripts/deploy.sh`](C:\Users\shala\Documents\New project\scripts\deploy.sh)
- серверный bootstrap: [`scripts/bootstrap-server.sh`](C:\Users\shala\Documents\New project\scripts\bootstrap-server.sh)

Как это работает:

1. Вы пушите код в GitHub в ветку `main`
2. GitHub Actions запускает тесты
3. Если тесты прошли, GitHub подключается по SSH к серверу
4. На сервере выполняется `scripts/deploy.sh`
5. Скрипт делает `git pull` и `docker compose up -d --build`

### Что нужно на сервере

Установите:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin wireguard-tools
```

И добавьте пользователя в группу docker:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Первая настройка сервера

На сервере выполните:

```bash
git clone <YOUR_GITHUB_REPO_URL> /opt/vpn-invite-service
cd /opt/vpn-invite-service
cp .env.example .env
chmod +x scripts/deploy.sh
```

Потом отредактируйте `/opt/vpn-invite-service/.env`.

Первый ручной деплой:

```bash
cd /opt/vpn-invite-service
./scripts/deploy.sh
```

### Что нужно добавить в GitHub Secrets

В репозитории GitHub откройте:

`Settings -> Secrets and variables -> Actions`

Добавьте секреты:

- `DEPLOY_HOST` - IP или домен сервера
- `DEPLOY_PORT` - SSH порт, обычно `22`
- `DEPLOY_USER` - пользователь на сервере
- `DEPLOY_SSH_KEY` - приватный SSH ключ, которым GitHub войдет на сервер
- `DEPLOY_APP_DIR` - путь на сервере, например `/opt/vpn-invite-service`

### Как создать SSH-ключ для деплоя

На локальной машине:

```bash
ssh-keygen -t ed25519 -C "github-deploy"
```

Потом:

- содержимое приватного ключа добавьте в GitHub Secret `DEPLOY_SSH_KEY`
- содержимое публичного ключа добавьте на сервер в `~/.ssh/authorized_keys`

Пример просмотра ключей:

```bash
cat ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

### Что произойдет после push

После команды:

```bash
git add .
git commit -m "update service"
git push origin main
```

GitHub сам:

- прогонит `npm test`
- подключится к серверу
- обновит код
- пересоберет контейнер
- перезапустит сервис

### Важное замечание

Файл `.env` не храните в GitHub. Он должен лежать только на сервере.

## Что нужно на Linux-сервере без Docker

Нужно установить:

- `nodejs`
- `npm`
- `wireguard-tools`

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y nodejs npm wireguard-tools
```

## Пример запуска через systemd

Файл `/etc/systemd/system/vpn-invite.service`:

```ini
[Unit]
Description=VPN Invite Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/vpn-invite-service
Environment=PORT=3000
Environment=APP_ORIGIN=https://vpn.example.com
Environment=TRUST_PROXY=true
Environment=COOKIE_SECURE=true
Environment=SESSION_SECRET=super-secret-session-key
Environment=ADMIN_USERNAME=admin
Environment=ADMIN_PASSWORD=strong-password
Environment=VPN_SERVER_ENDPOINT=vpn.example.com:51820
Environment=VPN_SERVER_PUBLIC_KEY=SERVER_PUBLIC_KEY_HERE
Environment=VPN_INTERFACE_NAME=wg0
Environment=VPN_SERVER_CONFIG_PATH=/etc/wireguard/wg0.conf
Environment=VPN_AUTO_APPLY_PEERS=true
Environment=VPN_RELOAD_MODE=syncconf
ExecStart=/usr/bin/node /opt/vpn-invite-service/src/server.js
Restart=always
User=root
Group=root

[Install]
WantedBy=multi-user.target
```

Потом:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vpn-invite.service
sudo systemctl status vpn-invite.service
```

## Безопасность

Что уже закрыто:

- SQL injection здесь неприменим в прямом смысле, потому что в проекте нет SQL-базы: данные хранятся в JSON-файле [data/db.json](C:\Users\shala\Documents\New project\data\db.json) на рабочем сервере;
- пользовательский ввод не вставляется в SQL-запросы;
- HTML-вывод экранируется, что снижает риск XSS;
- формы защищены CSRF-токеном;
- вход и регистрация ограничены rate limit;
- cookie админа выставляется как `HttpOnly`, а при `COOKIE_SECURE=true` еще и `Secure`;
- выставляются `CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `HSTS` при HTTPS.

Что важно учитывать:

- если включать `VPN_AUTO_APPLY_PEERS=true`, сервису нужны повышенные права на чтение и запись WireGuard-конфига;
- хранение в JSON подходит для MVP, но для продакшна с несколькими администраторами лучше перейти на PostgreSQL;
- сейчас нет 2FA для админа;
- сейчас нет отдельного журнала аудита действий.

## Что можно добавить следующим этапом

- PostgreSQL вместо JSON
- Nginx + HTTPS конфиг
- email или Telegram отправку invite-ссылки
- удаление или блокировку пользователей
- аудит действий администратора
- отдельное API для клиентского приложения
