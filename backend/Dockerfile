# Optional container deploy (Fly.io, Railway, ECS, etc.)
# Build: docker build -t vendornet-api ./backend
# Run:   docker run -e MONGO_URI -e JWT_SECRET -e CLIENT_ORIGINS -e PORT=8080 -p 8080:8080 vendornet-api

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 5000
CMD ["node", "dist/server.js"]
