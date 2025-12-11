# Build frontend
FROM node:18-alpine AS client
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client ./client
# Pass VITE_API_URL as build arg (default to empty, will be set by Railway)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN cd client && npm run build

# Install backend dependencies
FROM node:18-alpine AS server_deps
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci

# Final image
FROM node:18-alpine AS server
WORKDIR /app

# Copy server source
COPY server ./server

# Copy installed node_modules for server
COPY --from=server_deps /app/server/node_modules /app/server/node_modules

# Copy built frontend into server/public (so backend can serve static files)
COPY --from=client /app/client/dist /app/server/public

WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]

