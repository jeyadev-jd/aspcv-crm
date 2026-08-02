FROM node:20-slim AS build
WORKDIR /app
# Prisma's query/schema engine binaries are linked against OpenSSL and fail
# at runtime on node:*-slim images, which don't ship it - "Schema engine
# error" with no detail is the symptom.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 4000
# Migrations run before the API starts, so a fresh container never serves
# traffic against a schema it hasn't applied yet.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
