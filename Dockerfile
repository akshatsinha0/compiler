FROM node:18-alpine

# Install OpenJDK 21, JDK, and curl for healthcheck
RUN apk add --no-cache openjdk21 openjdk21-jdk curl

# Set JAVA_HOME
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk
ENV PATH="$JAVA_HOME/bin:${PATH}"

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Create temp directory
RUN mkdir -p temp

EXPOSE 3000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:$PORT/test || exit 1

CMD ["node", "server.js"]