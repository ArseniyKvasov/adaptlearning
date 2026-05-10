FROM nginx:1.27-alpine

RUN printf '%s\n' \
  '<!doctype html>' \
  '<html lang="ru">' \
  '<head>' \
  '  <meta charset="utf-8" />' \
  '  <meta name="viewport" content="width=device-width, initial-scale=1" />' \
  '  <title>Adaptive Learning Prototype</title>' \
  '  <style>body{font-family:system-ui,sans-serif;margin:40px;line-height:1.5}h1{margin:0 0 12px}</style>' \
  '</head>' \
  '<body>' \
  '  <h1>Adaptive Learning Prototype</h1>' \
  '  <p>Старый prototype-фронтенд удалён. Образ nginx оставлен как минимальная заглушка.</p>' \
  '</body>' \
  '</html>' \
  > /usr/share/nginx/html/index.html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/index.html || exit 1
