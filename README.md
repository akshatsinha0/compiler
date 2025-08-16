# Java Online Compiler

A modern web-based Java compiler with real-time code execution using Docker containers for secure sandboxing.

## Features

- Monaco Editor with Java syntax highlighting
- Secure Docker-based code execution
- Real-time compilation and output
- Modern responsive UI
- Resource limits and timeouts
- Network isolation for security

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure Docker is running in WSL2:
```bash
wsl sudo service docker start
```

3. Start the server:
```bash
npm start
```

4. Open http://localhost:3000 in your browser

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## Security Features

- Docker containers with memory limits (128MB)
- CPU limits (0.5 cores)
- 10-second execution timeout
- Network isolation (no internet access)
- Read-only container filesystem
- Temporary file execution only

## Tech Stack

- Backend: Node.js + Express
- Frontend: HTML5 + CSS3 + JavaScript
- Editor: Monaco Editor
- Containerization: Docker
- Java Runtime: Eclipse Temurin 11