const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const checkAndCreateDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const checkAndDeleteDir = (dir) => {
  if (fs.existsSync(dir)) {
    fs.rmdirSync(dir, { recursive: true });
  }
};

// Setup backend
const setupBackend = () => {
  console.log('Setting up backend...');
  const backendDir = path.join(__dirname, 'ride-share-backend');

  checkAndDeleteDir(backendDir);

  try {
    execSync(
      'npx @nestjs/cli new ride-share-backend --skip-install',
      { stdio: 'inherit' }
    );
    execSync('node setup-backend.js', { stdio: 'inherit' });
    console.log('Backend setup completed.');
  } catch (error) {
    console.error('Error setting up backend:', error);
  }
};

// Setup frontend
const setupFrontend = () => {
  console.log('Setting up frontend...');
  const frontendDir = path.join(__dirname, 'ride-share-frontend');

  checkAndDeleteDir(frontendDir);

  try {
    execSync('npm install -g @angular/cli', { stdio: 'inherit' });
    execSync('ng new ride-share-frontend --skip-install', {
      stdio: 'inherit',
    });
    execSync('node setup-frontend.js', { stdio: 'inherit' });
    console.log('Frontend setup completed.');
  } catch (error) {
    console.error('Error setting up frontend:', error);
  }
};

// Main setup function
const setupProject = () => {
  console.log('Starting project setup...');

  setupBackend();
  setupFrontend();

  console.log('Project setup completed.');
};

setupProject();
