FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS build
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/app/dist /app/app/dist
EXPOSE 3000
CMD ["node", "/app/app/dist/src/server.js"]
