# Single container: Fastify backend serves its own built API routes *and* the built frontend
# (demo mode by default — see frontend/src/api.ts DEMO_MODE). No WAHA/real WhatsApp connection
# is required to run this image; it's what backs the self-hosted demo deployment.

FROM node:22-alpine AS build
WORKDIR /app
# Vite inlines VITE_-prefixed env vars into the built bundle at build time (see
# frontend/src/api.ts DEMO_MODE) — pass VITE_DEMO_MODE=false as a build-arg for a real,
# non-demo deployment. Defaults to true so the plain `docker build` still produces the demo.
ARG VITE_DEMO_MODE=true
ENV VITE_DEMO_MODE=${VITE_DEMO_MODE}
COPY package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# The container's own loopback isn't reachable from outside its network namespace, so Docker's
# `-p` port publishing needs the process listening on 0.0.0.0 internally — that's a container
# implementation detail, not a public exposure decision. The actual exposure boundary is the
# HOST side of the port mapping (deploy/docker-compose.yml publishes 127.0.0.1 only) plus
# ACCESS_PIN, which backend/src/bind-guard.ts now requires whenever HOST isn't loopback.
ENV HOST=0.0.0.0
COPY package.json ./
COPY backend/package.json backend/package.json
RUN npm install --workspace backend --omit=dev
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/frontend/dist frontend/dist

EXPOSE 8787
CMD ["node", "backend/dist/bootstrap.js"]
