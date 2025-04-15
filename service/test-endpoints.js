const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api';
let authCookie = null;
let analysisId = null;

async function testEndpoints() {
  console.log('Testing endpoints...\n');

  // Test 1: Health Check
  console.log('1. Testing health check endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/test`);
    const data = await response.json();
    console.log('Health check response:', data);
  } catch (error) {
    console.error('Health check failed:', error);
  }

  // Test 2: User Registration
  console.log('\n2. Testing user registration...');
  const testEmail = `test${Date.now()}@example.com`;
  try {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'testpassword123'
      })
    });
    const data = await response.json();
    console.log('Registration response:', data);
    
    // Get the cookie from the response headers
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      authCookie = setCookie.split(';')[0];
      console.log('Got auth cookie:', authCookie);
    }
  } catch (error) {
    console.error('Registration failed:', error);
  }

  // Test 3: User Login
  console.log('\n3. Testing user login...');
  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'testpassword123'
      })
    });
    const data = await response.json();
    console.log('Login response:', data);
    
    // Get the cookie from the response headers
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      authCookie = setCookie.split(';')[0];
      console.log('Got auth cookie:', authCookie);
    }
  } catch (error) {
    console.error('Login failed:', error);
  }

  // Test 4: Analysis History
  console.log('\n4. Testing analysis history...');
  try {
    const response = await fetch(`${BASE_URL}/analysis/history`, {
      headers: authCookie ? { 'Cookie': authCookie } : {}
    });
    const data = await response.json();
    console.log('Analysis history response:', data);
  } catch (error) {
    console.error('Analysis history failed:', error);
  }

  // Test 5: File Upload and Analysis
  console.log('\n5. Testing file upload and analysis...');
  try {
    // Create a test ZIP file
    const testDir = path.join(__dirname, 'test-files');
    const testFile = path.join(testDir, 'test.js');
    const testZip = path.join(testDir, 'test.zip');
    
    // Ensure test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    
    // Create test JavaScript file
    fs.writeFileSync(testFile, 'console.log("test");');
    
    // Create ZIP file containing the test file
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addLocalFile(testFile);
    zip.writeZip(testZip);
    
    // Create form data with the ZIP file
    const form = new FormData();
    form.append('file', fs.createReadStream(testZip));

    const response = await fetch(`${BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Cookie': authCookie
      },
      body: form
    });
    const data = await response.json();
    console.log('Analysis upload response:', data);
    
    // Store the analysis ID for the next test
    if (data.id) {
      analysisId = data.id;
    }
    
    // Clean up test files
    fs.unlinkSync(testFile);
    fs.unlinkSync(testZip);
    fs.rmdirSync(testDir);
  } catch (error) {
    console.error('Analysis upload failed:', error);
  }

  // Test 6: Analysis Details (with valid ID)
  if (analysisId) {
    console.log('\n6. Testing analysis details with valid ID...');
    try {
      const response = await fetch(`${BASE_URL}/analysis/${analysisId}`, {
        headers: authCookie ? { 'Cookie': authCookie } : {}
      });
      const data = await response.json();
      console.log('Analysis details response:', data);
    } catch (error) {
      console.error('Analysis details failed:', error);
    }
  }
}

testEndpoints().catch(console.error); 