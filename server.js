const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const extractClassName = (code) => {
  const publicClassMatch = code.match(/public\s+class\s+(\w+)/);
  if (publicClassMatch) {
    return publicClassMatch[1];
  }
  
  const classMatch = code.match(/class\s+(\w+)/);
  if (classMatch) {
    return classMatch[1];
  }
  
  return 'Main';
};

const executeJava = (code) => {
  return new Promise((resolve) => {
    const jobId = uuidv4();
    const tempDir = path.join(__dirname, 'temp');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const className = extractClassName(code);
    const fileName = `${className}.java`;

    const dockerCommand = [
      'run', '--rm', '-i',
      '--memory=128m',
      '--cpus=0.5',
      '--network=none',
      '--read-only',
      '--tmpfs=/tmp:exec',
      'eclipse-temurin:24-alpine',
      'sh', '-c',
      `cat > /tmp/${fileName} && cd /tmp && timeout 10s javac ${fileName} && timeout 10s java ${className}`
    ];

    const docker = spawn('docker', dockerCommand);
    
    let output = '';
    let error = '';

    docker.stdout.on('data', (data) => {
      output += data.toString();
    });

    docker.stderr.on('data', (data) => {
      error += data.toString();
    });

    docker.on('close', (code) => {
      console.log(`Docker process exited with code: ${code}`);
      console.log(`Docker stdout: ${output}`);
      console.log(`Docker stderr: ${error}`);
      resolve({
        success: code === 0,
        output: output.trim(),
        error: error.trim() || `Docker process exited with code ${code}`,
        exitCode: code
      });
    });

    docker.on('error', (err) => {
      console.error('Docker spawn error:', err);
      resolve({
        success: false,
        output: '',
        error: `Docker error: ${err.message}`,
        exitCode: -1
      });
    });

    docker.stdin.write(code);
    docker.stdin.end();
  });
};

app.post('/api/compile', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code || code.trim() === '') {
      return res.json({
        success: false,
        error: 'No code provided'
      });
    }

    const result = await executeJava(code);
    res.json(result);
  } catch (error) {
    res.json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/java-version', async (req, res) => {
  try {
    const dockerCommand = [
      'run', '--rm',
      'eclipse-temurin:24-alpine',
      'java', '--version'
    ];

    const { spawn } = require('child_process');
    const docker = spawn('docker', dockerCommand);
    
    let output = '';
    let error = '';

    docker.stdout.on('data', (data) => {
      output += data.toString();
    });

    docker.stderr.on('data', (data) => {
      error += data.toString();
    });

    docker.on('close', (code) => {
      res.json({
        success: code === 0,
        version: output.trim(),
        error: error.trim()
      });
    });
  } catch (error) {
    res.json({
      success: false,
      error: 'Failed to check Java version: ' + error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Java Compiler Server running on http://localhost:${PORT}`);
});