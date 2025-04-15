require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const uuid = require('uuid');
const fetch = require('node-fetch');
const { OpenAI } = require('openai');
const DB = require('./database.js');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const { extract, scanDirectory } = require('./utils');
const axios = require('axios');
const { Octokit } = require('@octokit/rest');
const { peerProxy } = require('./peerProxy.js');

// Custom error class for API errors
class APIError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
  }
}

const app = express();

// Set up our Express app and middleware
app.use(express.json());
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Middleware to check if a user is logged in
const verifyAuth = async (req, res, next) => {
  try {
    const token = req.cookies[authCookieName];
    if (!token) {
      throw new APIError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const user = await DB.getUserByToken(token);
    if (!user) {
      throw new APIError('Invalid or expired session', 401, 'INVALID_SESSION');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// JSON parsing error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    res.status(400).json({
      code: 'INVALID_JSON',
      message: 'Invalid JSON payload'
    });
    return;
  }
  next(err);
});

// Set up the port - use command line arg if provided, otherwise default to 3000
const port = process.argv.length > 2 ? process.argv[2] : 3000;
const authCookieName = 'securecode_token';

// We'll store users and analyses in memory for now
// TODO: Move this to MongoDB in the database phase
let users = [];
let analyses = [];

// Create our API router and attach it to the /api path
const apiRouter = express.Router();

// Quick health check endpoint to make sure our service is running
apiRouter.get('/test', (_req, res) => {
  res.send({ msg: 'SecureCode service is running' });
});

// Set up rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  handler: (req, res) => {
    res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts, please try again later'
    });
  }
});

// Apply rate limiter only to login endpoint
apiRouter.use('/auth/login', authLimiter);

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.zip', '.tar.gz', '.rar'];
    const fileExtension = file.originalname.toLowerCase().match(/\.[^.]*$/)?.[0];
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only ZIP, TAR.GZ, and RAR files are allowed.'));
    }
  }
});

// Helper function to create a new user with a hashed password
async function createUser(email, password, role = 'user') {
  if (!email || !password) {
    throw new APIError('Email and password are required', 400, 'MISSING_CREDENTIALS');
  }
  
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new APIError('Invalid credential format', 400, 'INVALID_CREDENTIALS');
  }

  // Add email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new APIError('Invalid email format', 400, 'INVALID_EMAIL');
  }

  if (password.length < 8) {
    throw new APIError('Password must be at least 8 characters', 400, 'WEAK_PASSWORD');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    email: email.toLowerCase(),
    password: passwordHash,
    token: uuid.v4(),
    role: role,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await DB.addUser(user);
  return user;
}

// Middleware to check if a user has required role
const checkRole = (requiredRole) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new APIError('Authentication required', 401, 'AUTH_REQUIRED');
      }

      if (req.user.role !== requiredRole && req.user.role !== 'admin') {
        throw new APIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Helper function to find a user by any field (email, token, etc)
async function findUser(field, value) {
  if (!value) return null;
  
  if (field === 'email') {
    return DB.getUser(value);
  } else if (field === 'token') {
    return DB.getUserByToken(value);
  }
  return null;
}

// Set up our authentication cookie with secure settings
function setAuthCookie(res, authToken) {
  res.cookie(authCookieName, authToken, {
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });
}

// CreateAuth - Register a new user
apiRouter.post('/auth/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await createUser(email, password);
    setAuthCookie(res, user.token);
    res.json({ email: user.email, role: user.role });
  } catch (error) {
    next(error);
  }
});

// GetAuth - Login an existing user
apiRouter.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await findUser('email', email);
    
    if (!user) {
      throw new APIError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new APIError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Update user's token
    user.token = uuid.v4();
    await DB.updateUser(user);

    setAuthCookie(res, user.token);
    res.json({ email: user.email, role: user.role });
  } catch (error) {
    next(error);
  }
});

// DeleteAuth - Logout a user
apiRouter.delete('/auth/logout', async (req, res, next) => {
  try {
    const user = await findUser('token', req.cookies[authCookieName]);
    if (user) {
      delete user.token;
      await DB.updateUser(user);
    }
    res.clearCookie(authCookieName);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// For testing purposes - generates fake analysis results while we develop
function generateMockAnalysisResult(files) {
  const vulnerabilityTypes = [
    'SQL Injection', 
    'Cross-Site Scripting (XSS)', 
    'Insecure Authentication',
    'Sensitive Data Exposure',
    'Broken Access Control'
  ];
  
  const severityLevels = ['Low', 'Medium', 'High', 'Critical'];
  
  return files.map(file => {
    // Add 0-3 random vulnerabilities to make it look realistic
    const vulnCount = Math.floor(Math.random() * 4);
    const vulnerabilities = [];
    
    for (let i = 0; i < vulnCount; i++) {
      const vulnType = vulnerabilityTypes[Math.floor(Math.random() * vulnerabilityTypes.length)];
      const severity = severityLevels[Math.floor(Math.random() * severityLevels.length)];
      const lineNumber = Math.floor(Math.random() * 100) + 1;
      
      vulnerabilities.push({
        type: vulnType,
        severity: severity,
        line: lineNumber,
        description: `Potential ${vulnType} vulnerability detected`,
        suggestion: `Consider implementing secure coding practices for ${vulnType} prevention`
      });
    }
    
    return {
      path: file.path,
      vulnerabilities: vulnerabilities
    };
  });
}

// Set up OpenAI for our code analysis
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Validate OpenAI configuration
if (!process.env.OPENAI_API_KEY) {
  console.warn('WARNING: OPENAI_API_KEY environment variable not set. Code analysis features will not work.');
}

// Main function to analyze code using OpenAI's API
async function analyzeCodeWithAI(code) {
  try {
    console.log('Sending code to OpenAI for analysis...');
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a cybersecurity expert. Analyze the provided code for security vulnerabilities.
            Focus on:
            1. SQL Injection
            2. XSS (Cross-Site Scripting)
            3. CSRF (Cross-Site Request Forgery)
            4. Authentication/Authorization issues
            5. Data validation issues
            6. Insecure dependencies
            7. Hardcoded secrets
            8. Insecure file operations
            9. Insecure API endpoints
            10. Missing security headers
            
            Format your response as JSON with the following structure:
            {
              "vulnerabilities": [
                {
                  "type": "vulnerability type",
                  "severity": "high/medium/low",
                  "line": "line number or range",
                  "description": "description of the issue",
                  "suggestion": "how to fix it"
                }
              ]
            }`
        },
        {
          role: "user",
          content: `Analyze this code for security vulnerabilities:\n\n${code}`
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent results
      max_tokens: 1000
    });

    console.log('Received response from OpenAI');
    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      return {
        vulnerabilities: [{
          type: "Analysis Error",
          severity: "info",
          line: "N/A",
          description: "Failed to parse analysis results",
          suggestion: "Try analyzing again"
        }]
      };
    }
  } catch (error) {
    console.error('Error in OpenAI analysis:', error);
    throw error;
  }
}

// Helper function to analyze code
async function analyzeCode(files) {
  console.log('Starting code analysis...');
  console.log(`Number of files to analyze: ${files.length}`);
  
  const results = {
    files: [],
    summary: {
      highSeverity: 0,
      mediumSeverity: 0,
      lowSeverity: 0
    }
  };

  // Process files in batches for OpenAI analysis
  console.log('\nStarting OpenAI analysis...');
  try {
    // Batch files for OpenAI analysis
    const batchSize = 3; // Process 3 files at a time
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      console.log(`\nProcessing batch ${i/batchSize + 1} of ${Math.ceil(files.length/batchSize)}`);
      
      const batchPromises = batch.map(file => {
        console.log(`Analyzing ${file.path} with OpenAI...`);
        return analyzeCodeWithAI(file.content);
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Process results
      batch.forEach((file, index) => {
        const aiAnalysis = batchResults[index];
        console.log(`OpenAI found ${aiAnalysis.vulnerabilities?.length || 0} issues in ${file.path}`);

        const fileResult = {
          path: file.path,
          vulnerabilities: []
        };

        if (aiAnalysis.vulnerabilities) {
          fileResult.vulnerabilities.push(...aiAnalysis.vulnerabilities.map(vuln => ({
            line: vuln.line,
            column: 0, // OpenAI doesn't provide column numbers
            description: vuln.description,
            severity: vuln.severity.toLowerCase(),
            suggestion: vuln.suggestion
          })));

          // Update summary counts
          aiAnalysis.vulnerabilities.forEach(vuln => {
            const severity = vuln.severity.toLowerCase();
            if (severity === 'high') results.summary.highSeverity++;
            else if (severity === 'medium') results.summary.mediumSeverity++;
            else results.summary.lowSeverity++;
          });
        }

        results.files.push(fileResult);
      });
    }
  } catch (error) {
    console.error('OpenAI analysis failed:', error);
    throw error;
  }

  console.log('\nAnalysis completed');
  console.log('Summary:', results.summary);
  return results;
}

// Get analysis history
apiRouter.get('/analysis/history', verifyAuth, async (req, res, next) => {
  try {
    const history = await DB.getAnalysisHistory(req.user.email);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Get analysis details
apiRouter.get('/analysis/:id', verifyAuth, async (req, res, next) => {
  try {
    const analysis = await DB.getAnalysisById(req.params.id);
    
    if (!analysis) {
      throw new APIError('Analysis not found', 404, 'ANALYSIS_NOT_FOUND');
    }

    if (analysis.userEmail !== req.user.email && req.user.role !== 'admin') {
      throw new APIError('Unauthorized', 403, 'UNAUTHORIZED');
    }

    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

// Get user statistics and vulnerability trends
apiRouter.get('/stats', verifyAuth, async (req, res, next) => {
  try {
    const userAnalyses = analyses.filter(a => a.userId === req.user.email && a.status === 'completed');
    
    if (userAnalyses.length === 0) {
      return res.json({
        totalAnalyses: 0,
        vulnerabilityStats: {
          total: 0,
          bySeverity: { Critical: 0, High: 0, Medium: 0, Low: 0 },
          byType: {}
        },
        dailyStats: {},
        lastUpdated: new Date().toISOString()
      });
    }

    // Calculate total analyses
    const totalAnalyses = userAnalyses.length;
    
    // Calculate vulnerability statistics
    const vulnerabilityStats = {
      total: 0,
      bySeverity: {
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0
      },
      byType: {}
    };
    
    // Calculate trends over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailyStats = {};
    
    userAnalyses.forEach(analysis => {
      if (analysis.result) {
        analysis.result.forEach(fileResult => {
          fileResult.vulnerabilities.forEach(vuln => {
            // Count total vulnerabilities
            vulnerabilityStats.total++;
            
            // Count by severity
            if (vuln.severity in vulnerabilityStats.bySeverity) {
              vulnerabilityStats.bySeverity[vuln.severity]++;
            }
            
            // Count by type
            if (!(vuln.type in vulnerabilityStats.byType)) {
              vulnerabilityStats.byType[vuln.type] = 0;
            }
            vulnerabilityStats.byType[vuln.type]++;
            
            // Add to daily stats if within last 30 days
            const analysisDate = new Date(analysis.date);
            if (analysisDate >= thirtyDaysAgo) {
              const dateKey = analysisDate.toISOString().split('T')[0];
              if (!(dateKey in dailyStats)) {
                dailyStats[dateKey] = {
                  total: 0,
                  bySeverity: { Critical: 0, High: 0, Medium: 0, Low: 0 }
                };
              }
              dailyStats[dateKey].total++;
              dailyStats[dateKey].bySeverity[vuln.severity]++;
            }
          });
        });
      }
    });
    
    res.json({
      totalAnalyses,
      vulnerabilityStats,
      dailyStats,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Generate detailed report for a specific analysis
apiRouter.get('/analysis/:id/report', verifyAuth, async (req, res, next) => {
  try {
    const analysis = analyses.find(a => a.id === req.params.id && a.userId === req.user.email);
    
    if (!analysis) {
      throw new APIError('Analysis not found', 404, 'NOT_FOUND');
    }
    
    if (analysis.status !== 'completed') {
      throw new APIError('Analysis not completed yet', 400, 'NOT_COMPLETED');
    }
    
    // Generate detailed HTML report
    const report = generateHTMLReport(analysis);
    
    // Send report with proper headers for HTML content
    res.setHeader('Content-Type', 'text/html');
    res.send(report);
  } catch (error) {
    next(error);
  }
});

// Helper function to generate HTML report
function generateHTMLReport(analysis) {
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Security Analysis Report - ${analysis.name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .vulnerability { margin: 20px 0; padding: 15px; border-left: 4px solid; }
        .Critical { border-color: #dc3545; background: #fff5f5; }
        .High { border-color: #fd7e14; background: #fff9f0; }
        .Medium { border-color: #ffc107; background: #fffde7; }
        .Low { border-color: #28a745; background: #f0fff4; }
        .suggestion { background: #e9ecef; padding: 10px; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Security Analysis Report</h1>
        <p>Analysis Name: ${analysis.name}</p>
        <p>Date: ${new Date(analysis.date).toLocaleString()}</p>
        <p>User: ${analysis.userId}</p>
      </div>
  `;
  
  // Add summary section
  let totalVulnerabilities = 0;
  const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  
  analysis.result.forEach(fileResult => {
    fileResult.vulnerabilities.forEach(vuln => {
      totalVulnerabilities++;
      if (vuln.severity in severityCounts) {
        severityCounts[vuln.severity]++;
      }
    });
  });
  
  html += `
    <h2>Summary</h2>
    <p>Total Files Analyzed: ${analysis.result.length}</p>
    <p>Total Vulnerabilities Found: ${totalVulnerabilities}</p>
    <ul>
      ${Object.entries(severityCounts)
        .map(([severity, count]) => `<li>${severity}: ${count}</li>`)
        .join('')}
    </ul>
  `;
  
  // Add detailed findings
  html += '<h2>Detailed Findings</h2>';
  
  analysis.result.forEach(fileResult => {
    if (fileResult.vulnerabilities.length > 0) {
      html += `<h3>File: ${fileResult.path}</h3>`;
      
      fileResult.vulnerabilities.forEach(vuln => {
        html += `
          <div class="vulnerability ${vuln.severity}">
            <h4>${vuln.type} (${vuln.severity})</h4>
            <p>Line: ${vuln.line}</p>
            <p>${vuln.description}</p>
            <div class="suggestion">
              <strong>Suggestion:</strong> ${vuln.suggestion}
            </div>
          </div>
        `;
      });
    }
  });
  
  html += `
    </body>
    </html>
  `;
  
  return html;
}

// Endpoint to analyze a code snippet
apiRouter.post('/analyze-code', async (req, res, next) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      throw new APIError('No code provided', 400, 'MISSING_CODE');
    }
    
    const analysis = await analyzeCodeWithAI(code);
    res.json(analysis);
  } catch (error) {
    console.error('Error in code analysis endpoint:', error);
    next(error);
  }
});

// Add GitHub URL validation function
function validateGitHubUrl(url) {
  const githubUrlRegex = /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-_.]+(\.git)?(\/)?$/;
  return githubUrlRegex.test(url);
}

// Add GitHub repository download function
async function downloadGitHubRepo(repoUrl) {
  try {
    // Remove .git suffix if present
    const cleanUrl = repoUrl.replace(/\.git$/, '');
    
    // Extract owner and repo from URL
    const [owner, repo] = cleanUrl.split('/').slice(-2);
    
    // Create Octokit instance
    const octokit = new Octokit();
    
    // Get repository info
    const repoInfo = await octokit.repos.get({
      owner,
      repo
    });
    
    // Check repository size
    if (repoInfo.data.size > 100 * 1024 * 1024) { // 100MB limit
      throw new Error('Repository size exceeds 100MB limit');
    }
    
    // Download repository as ZIP
    const response = await axios({
      method: 'get',
      url: `https://api.github.com/repos/${owner}/${repo}/zipball`,
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    return {
      buffer: response.data,
      filename: `${owner}-${repo}.zip`
    };
  } catch (error) {
    console.error('Error downloading GitHub repository:', error);
    throw new Error('Failed to download GitHub repository');
  }
}

// Modify the analyze endpoint
apiRouter.post('/analyze', verifyAuth, upload.single('file'), async (req, res, next) => {
  try {
    let files = [];
    let analysis = null;

    // Handle GitHub URL if provided
    if (req.body.repoUrl) {
      if (!validateGitHubUrl(req.body.repoUrl)) {
        throw new APIError('Invalid GitHub URL format', 400, 'INVALID_GITHUB_URL');
      }

      console.log(`Processing GitHub repository: ${req.body.repoUrl}`);
      
      // Download repository
      const repoData = await downloadGitHubRepo(req.body.repoUrl);
      
      // Create a temporary directory for the downloaded repository
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'securecode-'));
      console.log(`Created temp directory: ${tempDir}`);
      
      const filePath = path.join(tempDir, repoData.filename);
      await fs.writeFile(filePath, repoData.buffer);
      console.log(`Wrote repository to: ${filePath}`);
      
      // Extract the archive
      console.log('Extracting repository...');
      await extract(filePath, { dir: tempDir });
      console.log('Repository extracted successfully');
      
      // Find all code files
      console.log(`Scanning directory: ${tempDir}`);
      await scanDirectory(tempDir, files);
      console.log(`Found files to analyze: ${files.length}`);
      
      // Clean up the temporary directory
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('Cleaned up temp directory');

      // Create analysis record
      analysis = {
        id: uuid.v4(),
        userEmail: req.user.email,
        status: 'pending',
        date: new Date(),
        repoUrl: req.body.repoUrl,
        files: files.map(f => f.path)
      };
    } 
    // Handle file upload if provided
    else if (req.file) {
      console.log(`Processing uploaded file: ${req.file.originalname}`);
      
      // Create a temporary directory for the uploaded file
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'securecode-'));
      console.log(`Created temp directory: ${tempDir}`);
      
      const filePath = path.join(tempDir, req.file.originalname);
      await fs.writeFile(filePath, req.file.buffer);
      console.log(`Wrote file to: ${filePath}`);
      
      // Extract the archive
      console.log('Extracting archive...');
      await extract(filePath, { dir: tempDir });
      console.log('Archive extracted successfully');
      
      // Find all code files
      console.log(`Scanning directory: ${tempDir}`);
      await scanDirectory(tempDir, files);
      console.log(`Found files to analyze: ${files.length}`);
      
      // Clean up the temporary directory
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('Cleaned up temp directory');

      // Create analysis record
      analysis = {
        id: uuid.v4(),
        userEmail: req.user.email,
        status: 'pending',
        date: new Date(),
        files: files.map(f => f.path)
      };
    } else {
      throw new APIError('No file or repository URL provided', 400, 'NO_INPUT');
    }

    if (files.length === 0) {
      throw new APIError('No code files found', 400, 'NO_CODE_FILES');
    }

    console.log('Created analysis record with ID:', analysis.id);

    // Save the analysis record
    const insertedId = await DB.addAnalysis(analysis);
    console.log('Analysis saved to database with ID:', analysis.id, 'MongoDB ID:', insertedId);
    
    // Start the analysis in the background
    analyzeCode(files).then(async (result) => {
      console.log('Analysis completed for ID:', analysis.id);
      await DB.updateAnalysisResults(analysis.id, result, 'completed');
    }).catch(async (error) => {
      console.error('Analysis failed for ID:', analysis.id, error);
      await DB.updateAnalysisStatus(analysis.id, 'failed', error.message);
    });

    // Return the analysis ID immediately
    const response = { 
      id: analysis.id,
      status: analysis.status,
      message: 'Analysis started successfully'
    };
    console.log('Sending response:', response);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(response);
  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    next(error);
  }
});

// Admin-only endpoint example
apiRouter.get('/admin/users', verifyAuth, checkRole('admin'), async (req, res, next) => {
  try {
    const users = await DB.getAllUsers();
    res.json(users.map(user => ({
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    })));
  } catch (error) {
    next(error);
  }
});

// Admin-only endpoint for updating user roles
apiRouter.put('/admin/users/:email/role', verifyAuth, checkRole('admin'), async (req, res, next) => {
  try {
    const { email } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      throw new APIError('Invalid role', 400, 'INVALID_ROLE');
    }

    await DB.updateUserRole(email, role);
    res.status(200).json({ message: 'User role updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Mount routes in the correct order
app.use('/api', apiRouter);  // API routes first

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(`Error: ${err.message}`);
  console.error(err.stack);

  // Don't send error details in production
  const isProduction = process.env.NODE_ENV === 'production';

  if (err instanceof APIError) {
    res.status(err.status).json({
      code: err.code,
      message: err.message
    });
  } else {
    res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'An unexpected error occurred' : err.message,
      stack: isProduction ? undefined : err.stack
    });
  }
});

// Handle 404s for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: 'API endpoint not found'
  });
});

// Serve static files for non-API routes
app.use(express.static('public'));

// Catch-all route for the frontend
app.use((req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile('index.html', { root: 'public' });
  }
});

// Start the server!
const server = app.listen(port, () => {
  console.log(`SecureCode service listening on port ${port}`);
});

// Initialize WebSocket server
peerProxy(server);