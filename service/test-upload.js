const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api';
let authCookie = null;
let analysisId = null;

async function testUpload() {
    console.log('Registering test user...');
    try {
        const response = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: `test${Date.now()}@example.com`,
                password: 'testpassword123'
            })
        });
        
        if (!response.ok) {
            throw new Error(`Registration failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Registration successful:', data);
        
        // Get the cookie from the response headers
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            authCookie = setCookie.split(';')[0];
            console.log('Got auth cookie:', authCookie);
        } else {
            throw new Error('No auth cookie received');
        }
        
        // Upload the test project
        console.log('\nUploading test project...');
        const formData = new FormData();
        formData.append('file', fs.createReadStream('/Users/matiasgomezpaz/Downloads/test-project.zip'));
        
        const uploadResponse = await fetch(`${BASE_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Cookie': authCookie
            },
            body: formData
        });
        
        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }
        
        const uploadData = await uploadResponse.json();
        analysisId = uploadData.id;
        console.log('Upload successful. Analysis ID:', analysisId);
        
        // Poll for analysis completion
        console.log('\nWaiting for analysis to complete...');
        let attempts = 0;
        const maxAttempts = 30; // 5 minutes total (30 * 10 seconds)
        
        while (attempts < maxAttempts) {
            const statusResponse = await fetch(`${BASE_URL}/analysis/${analysisId}`, {
                headers: {
                    'Cookie': authCookie
                }
            });
            
            if (!statusResponse.ok) {
                throw new Error(`Status check failed: ${statusResponse.statusText}`);
            }
            
            const statusData = await statusResponse.json();
            console.log(`Analysis status: ${statusData.status}`);
            
            if (statusData.status === 'completed') {
                console.log('\nAnalysis completed successfully!');
                console.log('Results:', JSON.stringify(statusData.results, null, 2));
                return;
            } else if (statusData.status === 'failed') {
                throw new Error(`Analysis failed: ${statusData.error}`);
            }
            
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        }
        
        throw new Error('Analysis timed out after 5 minutes');
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testUpload(); 