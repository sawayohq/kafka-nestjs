import { spawn } from 'child_process';
import { request } from 'http';

const MAX_WAIT_TIME = 10000; // 10 seconds
const BOOTSTRAP_MESSAGE = 'Test application is running on http://localhost:3001';
const ERROR_PATTERNS = [
  'No modules found in container',
  'Failed to start application',
  'Error:',
  'Exception:',
  'ERROR'
];

function checkHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = request({
      hostname: 'localhost',
      port: 3001,
      path: '/test/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 201);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.write(JSON.stringify({ test: 'health-check' }));
    req.end();
  });
}

async function runTest() {
  return new Promise<void>((resolve, reject) => {
    const app = spawn('npm', ['start'], {
      cwd: process.cwd(),
      shell: true
    });

    let output = '';
    let bootstrapFound = false;
    let hasErrors = false;
    let providersFound = false;

    app.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      console.log(chunk);

      if (chunk.includes(BOOTSTRAP_MESSAGE)) {
        bootstrapFound = true;
      }

      // Check for providers count in the output
      if (chunk.includes('modulesContainer.size')) {
        console.log('Found modulesContainer.size in output:', chunk);
        const match = chunk.match(/modulesContainer\.size\s*=\s*(\d+)/);
        if (match) {
          console.log('Match found:', match[1]);
          if (parseInt(match[1]) > 0) {
            providersFound = true;
          }
        }
      }

      if (ERROR_PATTERNS.some(pattern => chunk.includes(pattern))) {
        hasErrors = true;
      }
    });

    app.stderr.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      console.error(chunk);
      hasErrors = true;
    });

    // Set a timeout to check the application status
    setTimeout(async () => {
      if (!bootstrapFound) {
        app.kill();
        reject(new Error('Application failed to start: Bootstrap message not found'));
        return;
      }

      if (hasErrors) {
        app.kill();
        reject(new Error('Application started but contains errors in logs'));
        return;
      }

      if (!providersFound) {
        app.kill();
        reject(new Error('Application started but no providers were found in the container'));
        return;
      }

      // Check if the application is responding
      const isHealthy = await checkHealth();
      if (!isHealthy) {
        app.kill();
        reject(new Error('Application started but health check failed'));
        return;
      }

      app.kill();
      resolve();
    }, MAX_WAIT_TIME);
  });
}

// Run the test
runTest()
  .then(() => {
    console.log('✅ Application started successfully with no errors and providers found');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }); 