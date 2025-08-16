FROM node:18-alpine

# Install OpenJDK 24
RUN apk add --no-cache openjdk21

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]