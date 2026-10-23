# Imagem de produção: compila front e back e serve tudo pela mesma origem.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY . .
RUN npm run db:generate -w server && npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production WEB_DIST_DIR=/app/web/dist PORT=3001
COPY --from=build /app /app
RUN npm prune --omit=dev && npm cache clean --force
WORKDIR /app/server
USER node
EXPOSE 3001
# Aplica migrações pendentes e sobe o servidor.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
