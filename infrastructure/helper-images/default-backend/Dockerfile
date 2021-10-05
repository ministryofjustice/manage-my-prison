FROM nginx:1.21-alpine

RUN set -ex; \
  test $(id -u nginx) = 101 \
  && \
  apk add --no-cache --no-progress tzdata \
  && \
  cp /usr/share/zoneinfo/Europe/London /etc/localtime \
  && \
  echo "Europe/London" > /etc/timezone \
  && \
  apk del tzdata \
  && \
  rm /usr/share/nginx/html/50x.html /usr/share/nginx/html/index.html \
  && \
  chown -cR nginx:nginx /run /var/run /var/cache/nginx/

COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf
COPY maintenance.conf /etc/nginx/conf.d/maintenance.conf
COPY html /usr/share/nginx

USER 101
# error pages are served from:
EXPOSE 3000
# maintenance page is served from:
EXPOSE 3001
