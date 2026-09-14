FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Accept the build argument from docker-compose
ARG VITE_API_PROXY_TARGET
ENV VITE_API_PROXY_TARGET=$VITE_API_PROXY_TARGET

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html