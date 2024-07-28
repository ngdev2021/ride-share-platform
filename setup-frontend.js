const { execSync } = require('child_process');
const fs = require('fs');

// Frontend Setup
const setupFrontend = () => {
  console.log('Setting up frontend...');

  try {
    process.chdir('ride-share-frontend');

    execSync(
      'npm install @angular/material @angular/cdk @angular/animations',
      { stdio: 'inherit' }
    );
    execSync('npm install apollo-angular graphql', {
      stdio: 'inherit',
    });
    execSync(
      'npm install ngrx/store ngrx/effects ngrx/entity ngrx/store-devtools',
      { stdio: 'inherit' }
    );

    console.log('Frontend setup completed.');
  } catch (error) {
    console.error('Error setting up frontend:', error);
  }
};

setupFrontend();
