# Adaptive Learning Prototype

Прототип интерфейсов методиста и ученика (статический фронтенд), упакованный в Docker.

## Что внутри
- `prototype/template.html` — интерфейс методиста
- `prototype/student/template.html` — интерфейс ученика
- `Dockerfile` + `docker-compose.yml` — быстрый запуск
- `nginx/default.conf` — nginx внутри контейнера
- `deploy/nginx/prototype.fastclass.ru.conf` — конфиг nginx на сервере (reverse proxy)

## Быстрый запуск локально
```bash
docker compose up -d --build
```

После запуска:
- `http://localhost:8090/` — методист
- `http://localhost:8090/student/template.html` — ученик

## Развертывание на сервере в `/home/projects/`

### 1) Подготовка директории и клонирование
```bash
sudo mkdir -p /home/projects
sudo chown -R $USER:$USER /home/projects
cd /home/projects
git clone https://github.com/ArseniyKvasov/adaptivelearningprototype.git
cd adaptivelearningprototype
```

### 2) Сборка и запуск контейнера
```bash
docker compose up -d --build
docker compose ps
```

Приложение будет слушать `127.0.0.1:8090` (через mapping `8090:80`).

### 3) Подключение домена через nginx на сервере
Скопируйте конфиг:
```bash
sudo cp /home/projects/adaptivelearningprototype/deploy/nginx/prototype.fastclass.ru.conf /etc/nginx/sites-available/prototype.fastclass.ru
sudo ln -s /etc/nginx/sites-available/prototype.fastclass.ru /etc/nginx/sites-enabled/prototype.fastclass.ru
```

Проверьте и перезапустите nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 4) SSL-сертификат (Let's Encrypt)
Если сертификат еще не выпускали:
```bash
sudo certbot --nginx -d prototype.fastclass.ru
```

## Обновление на сервере
```bash
cd /home/projects/adaptivelearningprototype
git pull
docker compose up -d --build
```
