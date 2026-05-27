FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV WEB_PORT=4000

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --prod; else pnpm install --prod; fi

COPY auth.js db.js env.js server.js ./
COPY db ./db
COPY server ./server

EXPOSE 4000

CMD ["pnpm", "start"]
