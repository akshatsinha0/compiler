const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Starting server...');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Working directory:', process.cwd());

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

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

const executeJava = (code, files = null, debug = false) => {
  return new Promise((resolve) => {
    const jobId = uuidv4();
    const tempDir = path.join(__dirname, 'temp', jobId);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const startTime = process.hrtime();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      let filesToCompile = [];
      
      if (files && files.length > 0) {
        files.forEach(file => {
          const filePath = path.join(tempDir, file.name);
          fs.writeFileSync(filePath, file.content);
          filesToCompile.push(filePath);
        });
      } else {
        const className = extractClassName(code);
        const fileName = `${className}.java`;
        const filePath = path.join(tempDir, fileName);
        fs.writeFileSync(filePath, code);
        filesToCompile.push(filePath);
      }

      const mainClass = files && files.length > 0 ? 
        extractClassName(files[0].content) : 
        extractClassName(code);

      const javac = spawn('javac', filesToCompile, {
        cwd: tempDir,
        timeout: 10000
      });

      let compileOutput = '';
      let compileError = '';

      javac.stdout.on('data', (data) => {
        compileOutput += data.toString();
      });

      javac.stderr.on('data', (data) => {
        compileError += data.toString();
      });

      javac.on('close', (compileCode) => {
        if (compileCode !== 0) {
          const [executionTime] = process.hrtime(startTime);
          const memoryUsed = process.memoryUsage().heapUsed - startMemory;
          cleanup(tempDir, jobId);
          resolve({
            success: false,
            output: '',
            error: formatError(compileError || 'Compilation failed'),
            exitCode: compileCode,
            executionTime: executionTime * 1000,
            memoryUsed: memoryUsed
          });
          return;
        }

        const javaArgs = debug ? 
          ['-Xdebug', '-Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005', '-cp', tempDir, mainClass] :
          ['-cp', tempDir, mainClass];

        const java = spawn('java', javaArgs, {
          cwd: tempDir,
          timeout: 10000
        });

        let runOutput = '';
        let runError = '';

        java.stdout.on('data', (data) => {
          runOutput += data.toString();
        });

        java.stderr.on('data', (data) => {
          runError += data.toString();
        });

        java.on('close', (runCode) => {
          const [executionTime] = process.hrtime(startTime);
          const memoryUsed = process.memoryUsage().heapUsed - startMemory;
          cleanup(tempDir, jobId);
          resolve({
            success: runCode === 0,
            output: runOutput.trim(),
            error: formatError(runError.trim()),
            exitCode: runCode,
            executionTime: executionTime * 1000,
            memoryUsed: memoryUsed
          });
        });

        java.on('error', (err) => {
          const [executionTime] = process.hrtime(startTime);
          const memoryUsed = process.memoryUsage().heapUsed - startMemory;
          cleanup(tempDir, jobId);
          resolve({
            success: false,
            output: '',
            error: formatError(`Runtime error: ${err.message}`),
            exitCode: -1,
            executionTime: executionTime * 1000,
            memoryUsed: memoryUsed
          });
        });
      });

      javac.on('error', (err) => {
        const [executionTime] = process.hrtime(startTime);
        const memoryUsed = process.memoryUsage().heapUsed - startMemory;
        cleanup(tempDir, jobId);
        resolve({
          success: false,
          output: '',
          error: formatError(`Compilation error: ${err.message}`),
          exitCode: -1,
          executionTime: executionTime * 1000,
          memoryUsed: memoryUsed
        });
      });

    } catch (err) {
      const [executionTime] = process.hrtime(startTime);
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;
      cleanup(tempDir, jobId);
      resolve({
        success: false,
        output: '',
        error: formatError(`File system error: ${err.message}`),
        exitCode: -1,
        executionTime: executionTime * 1000,
        memoryUsed: memoryUsed
      });
    }
  });
};

const formatError = (error) => {
  return error.replace(/([^\s]+\.java):(\d+)/g, '$1:$2');
};

const cleanup = (tempDir, jobId) => {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('Cleanup error:', err);
  }
};

app.post('/api/compile', async (req, res) => {
  console.log('Compile request received');
  try {
    const { code, files, debug } = req.body;
    
    if (!code || code.trim() === '') {
      return res.json({
        success: false,
        error: 'No code provided'
      });
    }

    console.log('Executing Java code...');
    const result = await executeJava(code, files, debug);
    console.log('Java execution completed:', result.success);
    res.json(result);
  } catch (error) {
    console.error('Compile error:', error);
    res.json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
});

app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    javaHome: process.env.JAVA_HOME,
    workingDir: process.cwd()
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/test', (req, res) => {
  console.log('Test endpoint hit');
  res.send('<h1>Server is running!</h1><p>Java Compiler is working</p><p>Time: ' + new Date().toISOString() + '</p>');
});

app.get('/api/java-version', async (req, res) => {
  console.log('Java version check requested');
  try {
    const java = spawn('java', ['--version']);
    
    let output = '';
    let error = '';

    java.stdout.on('data', (data) => {
      output += data.toString();
    });

    java.stderr.on('data', (data) => {
      error += data.toString();
    });

    java.on('close', (code) => {
      console.log(`Java version check completed with code: ${code}`);
      res.json({
        success: code === 0,
        version: output.trim() || error.trim(),
        error: code !== 0 ? error.trim() : '',
        javaHome: process.env.JAVA_HOME,
        path: process.env.PATH
      });
    });

    java.on('error', (err) => {
      console.error('Java version check error:', err);
      res.json({
        success: false,
        error: 'Java not found: ' + err.message,
        javaHome: process.env.JAVA_HOME,
        path: process.env.PATH
      });
    });
  } catch (error) {
    console.error('Java version check exception:', error);
    res.json({
      success: false,
      error: 'Failed to check Java version: ' + error.message
    });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  const isLocal = PORT === 3000;
  const baseUrl = isLocal ? `http://localhost:${PORT}` : `https://compiler-production-08b5.up.railway.app`;
  
  console.log(`✅ Java Compiler Server running on port ${PORT}`);
  console.log(`🌍 Access your app at: ${baseUrl}`);
  console.log(`🔍 Test endpoint: ${baseUrl}/test`);
  console.log(`💚 Health check: ${baseUrl}/api/health`);
  
  // Test Java availability after server starts
  setTimeout(() => {
    try {
      const { spawn } = require('child_process');
      
      const javaTest = spawn('java', ['--version']);
      javaTest.on('close', (code) => {
        console.log(`☕ Java test exit code: ${code}`);
      });
      javaTest.on('error', (err) => {
        console.error('❌ Java test error:', err.message);
      });
      
      const javacTest = spawn('javac', ['--version']);
      javacTest.on('close', (code) => {
        console.log(`🔨 Javac test exit code: ${code}`);
      });
      javacTest.on('error', (err) => {
        console.error('❌ Javac test error:', err.message);
      });
    } catch (error) {
      console.error('❌ Java test exception:', error.message);
    }
  }, 1000);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});