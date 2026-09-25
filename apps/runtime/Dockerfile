# ZetaPanel Runtime Bridge image.
#
# One image, reused by every ZIP-deployed server on Render — what differs
# per server is only the env vars ZetaPanel sets when it calls Render's
# create-service API (R2_PREFIX, APP_BUILD_COMMAND, APP_START_COMMAND, plus
# the user's own env vars like DISCORD_TOKEN).
#
# Currently supports Node.js and Python projects out of the box (the two
# runtimes covered by this base image). Go/Rust/Ruby/Elixir ZIP-deploys are
# an explicit extension point: add the matching toolchain to this image and
# they'll work the same way — not implemented here rather than faked.
FROM node:20-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /runtime
COPY package.json .
RUN npm install --omit=dev

COPY sync-and-run.js .

ENTRYPOINT ["node", "/runtime/sync-and-run.js"]
