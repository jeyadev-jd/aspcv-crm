FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# This runtime stage needs BOTH fixes verified by DEBUG=* output, which were
# incorrectly conflated as one problem across earlier attempts:
#  1. The `prisma` CLI is a devDependency; `npm ci --omit=dev` here used to
#     strip it, so `npx prisma migrate deploy` had no local CLI to run.
#     Fixed by copying the build stage's full node_modules instead.
#  2. Separately, this image has no libssl at all ("Couldn't find any
#     version of libssl or OpenSSL in the system" - confirmed via DEBUG=*,
#     not inferred). That apt-get install line existed in an earlier
#     revision but was accidentally dropped when reverting an unrelated
#     base-image experiment, which is why the identical error kept
#     recurring despite fixing (1).
FROM node:20-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 4000
# Migrations run before the API starts, so a fresh container never serves
# traffic against a schema it hasn't applied yet.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
