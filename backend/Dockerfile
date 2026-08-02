FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Root cause of the persistent "Schema engine error" (misdiagnosed twice as
# an OpenSSL/base-image issue): `prisma` the CLI is a devDependency, and this
# stage used to run `npm ci --omit=dev`, which strips it. `npx prisma migrate
# deploy` then had no locally-installed CLI to run and fell back to fetching
# one ad hoc at container start - an unpinned, uncontrolled resolution with
# no guarantee it matched the schema-engine binary actually generated in the
# build stage. Copying the build stage's full node_modules (CLI included)
# instead of a fresh --omit=dev install fixes this at the actual source.
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 4000
# Migrations run before the API starts, so a fresh container never serves
# traffic against a schema it hasn't applied yet.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
