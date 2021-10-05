FROM alpine
RUN set -ex; \
  apk add --no-cache --no-progress tzdata socat \
  && \
  cp /usr/share/zoneinfo/Europe/London /etc/localtime \
  && \
  echo "Europe/London" > /etc/timezone \
  && \
  apk del tzdata \
  && \
  addgroup --gid 2000 port-forward \
  && \
  adduser --home /home/port-forward --shell /sbin/nologin --disabled-password --gecos 'Port forward' --uid 2000 --ingroup port-forward port-forward
WORKDIR /home/port-forward
USER 2000
EXPOSE 8000
ENTRYPOINT ["socat", "tcp-listen:8000,reuseaddr,fork"]
CMD ["tcp:localhost:80"]
