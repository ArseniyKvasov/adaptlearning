FROM nginx:1.27-alpine

COPY prototype/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/teacher/template.html || exit 1
