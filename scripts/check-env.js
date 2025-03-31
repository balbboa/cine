#!/usr/bin/env node

// Import required modules
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Function to load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.error('\x1b[31m%s\x1b[0m', '❌ .env.local file not found!');
    console.log('Create a .env.local file in the project root with:');
    console.log(`
# Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Application settings
NEXT_PUBLIC_API_URL=http://localhost:3000
    `);
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.trim();
      }
    }
  });
  
  return envVars;
}

// Check if environment variables are properly set
function checkEnvironmentVariables() {
  console.log('\x1b[36m%s\x1b[0m', '🔍 Checking environment variables...');
  
  const envVars = loadEnvFile();
  if (!envVars) return false;
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  let allVarsPresent = true;
  
  requiredVars.forEach(varName => {
    if (!envVars[varName]) {
      console.error('\x1b[31m%s\x1b[0m', `❌ Missing ${varName} in .env.local`);
      allVarsPresent = false;
    } else {
      console.log('\x1b[32m%s\x1b[0m', `✅ ${varName} is set`);
      
      // Check URL format for SUPABASE_URL
      if (varName === 'NEXT_PUBLIC_SUPABASE_URL') {
        try {
          new URL(envVars[varName]);
          console.log('\x1b[32m%s\x1b[0m', `  ✓ Valid URL format: ${envVars[varName]}`);
        } catch (e) {
          console.error('\x1b[31m%s\x1b[0m', `  ✗ Invalid URL format: ${envVars[varName]}`);
          allVarsPresent = false;
        }
      }
      
      // Check ANON_KEY format
      if (varName === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
        if (envVars[varName].includes('your-') || envVars[varName].includes('YOUR-KEY-HERE')) {
          console.error('\x1b[31m%s\x1b[0m', `  ✗ Placeholder value detected: ${envVars[varName]}`);
          allVarsPresent = false;
        } else {
          console.log('\x1b[32m%s\x1b[0m', `  ✓ Anon key format looks good`);
        }
      }
    }
  });
  
  return allVarsPresent;
}

// Main function
function main() {
  console.log('\x1b[36m%s\x1b[0m', '🔄 Checking project setup...');
  
  const envCheck = checkEnvironmentVariables();
  
  if (envCheck) {
    console.log('\x1b[32m%s\x1b[0m', '✅ All environment variables are properly set');
  } else {
    console.error('\x1b[31m%s\x1b[0m', '❌ There are issues with environment variables');
    console.log('\nPlease fix the issues above and try again.\n');
    process.exit(1);
  }
  
  console.log('\x1b[36m%s\x1b[0m', '\n🚀 Your project is ready!');
}

// Run the main function
main(); 