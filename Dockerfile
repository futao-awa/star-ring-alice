FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4174 \
    DATA_DIR=/app/data

COPY --chown=node:node . /app
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 4174

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4174/api/health >/dev/null || exit 1

CMD ["node", "server.js"]
