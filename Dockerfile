# Single container: Fastify backend serves its own built API routes *and* the built frontend
# (demo mode by default — see frontend/src/api.ts DEMO_MODE). No WAHA/real WhatsApp connection
# is required to run this image; it's what backs the self-hosted demo deployment.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY backend/package.json backend/package.json
RUN npm install --workspace backend --omit=dev
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/frontend/dist frontend/dist

EXPOSE 8787
CMD ["node", "backend/dist/server.js"]
