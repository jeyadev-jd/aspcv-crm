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
# Confirmed via ldd against the actual engine binary (not inferred): Prisma
# downloaded schema-engine-debian-openssl-1.1.x regardless of binaryTargets
# in schema.prisma, and it needs libssl.so.1.1 / libcrypto.so.1.1
# specifically - packages bookworm's own repos no longer carry (they only
# ship OpenSSL 3.x, which is a different SONAME, not a superset). Pulling
# the actual bullseye-security libssl1.1 package directly is the fix that
# matches what the binary really needs, rather than installing "some"
# OpenSSL and hoping Prisma's detection cooperates.
RUN apt-get update -y && apt-get install -y wget file && \
    wget -q http://security.debian.org/debian-security/pool/updates/main/o/openssl/libssl1.1_1.1.1w-0+deb11u8_amd64.deb && \
    dpkg -i libssl1.1_1.1.1w-0+deb11u8_amd64.deb && \
    rm libssl1.1_1.1.1w-0+deb11u8_amd64.deb && \
    rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 4000
# Migrations run before the API starts, so a fresh container never serves
# traffic against a schema it hasn't applied yet. On failure, dump the
# resolved schema-engine binary's own file info and a direct --version
# invocation - Prisma's own error message has proven unreliable (parses
# engine stderr as structured JSON and silently produces an empty message
# when the engine doesn't emit that format), so this bypasses it entirely.
CMD ["sh", "-c", "npx prisma migrate deploy || (echo '--- DIAGNOSTIC ---'; ENGINE=$(find node_modules -iname 'schema-engine*' -type f | head -1); echo \"engine path: $ENGINE\"; ls -la \"$ENGINE\"; file \"$ENGINE\"; ldd \"$ENGINE\" 2>&1 || true; \"$ENGINE\" --version 2>&1 || true; exit 1) && node dist/index.js"]
