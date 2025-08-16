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
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const className = extractClassName(code);
    const fileName = `${className}.java`;
    const filePath = path.join(tempDir, fileName);

    try {
      // Write Java code to file
      fs.writeFileSync(filePath, code);

      // Compile Java code
      const javac = spawn('javac', [filePath], {
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
          // Compilation failed
          cleanup(tempDir, jobId);
          resolve({
            success: false,
            output: '',
            error: compileError || 'Compilation failed',
            exitCode: compileCode
          });
          return;
        }

        // Run Java code
        const java = spawn('java', ['-cp', tempDir, className], {
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
          cleanup(tempDir, jobId);
          resolve({
            success: runCode === 0,
            output: runOutput.trim(),
            error: runError.trim(),
            exitCode: runCode
          });
        });

        java.on('error', (err) => {
          cleanup(tempDir, jobId);
          resolve({
            success: false,
            output: '',
            error: `Runtime error: ${err.message}`,
            exitCode: -1
          });
        });
      });

      javac.on('error', (err) => {
        cleanup(tempDir, jobId);
        resolve({
          success: false,
          output: '',
          error: `Compilation error: ${err.message}`,
          exitCode: -1
        });
      });

    } catch (err) {
      cleanup(tempDir, jobId);
      resolve({
        success: false,
        output: '',
        error: `File system error: ${err.message}`,
        exitCode: -1
      });
    }
  });
};

const cleanup = (tempDir, jobId) => {
  try {
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (err) {
    console.error('Cleanup error:', err);
  }
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
      res.json({
        success: code === 0,
        version: output.trim() || error.trim(),
        error: code !== 0 ? error.trim() : ''
      });
    });

    java.on('error', (err) => {
      res.json({
        success: false,
        error: 'Java not found: ' + err.message
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