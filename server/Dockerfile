FROM node:20-alpine

WORKDIR /app

# Native dependencies required by node-pty/node-gyp
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    docker-cli \
 && ln -sf /usr/bin/docker /usr/local/bin/docker

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "start"]

