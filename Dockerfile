FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 8084 8086 8087 8089 8090 9090 6969

CMD ["node", "public/assets/js/server.mjs"]
