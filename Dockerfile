FROM node:18-alpine

# Install Docker CLI
RUN apk add --no-cache docker-cli

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]