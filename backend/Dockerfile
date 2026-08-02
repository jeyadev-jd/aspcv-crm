FROM node:20-bookworm AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# node:20-slim's OpenSSL detection was unreliable even after `apt-get install
# openssl` and pinning binaryTargets - the -slim variant kept failing the
# CLI's own `openssl version` probe at container start ("Prisma failed to
# detect the libssl/openssl version"), which is separate from which engine
# binary got bundled. The full (non-slim) bookworm image ships OpenSSL and
# its dev tooling already wired up correctly, which -slim's minimal install
# apparently does not replicate.
FROM node:20-bookworm
WORKDIR /app
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
