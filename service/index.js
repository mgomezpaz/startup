require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const uuid = require('uuid');
const fetch = require('node-fetch');
const { OpenAI } = require('openai');

const app = express();

// Set up our Express app and middleware
app.use(express.json());
app.use(cookieParser());

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

// Helper function to create a new user with a hashed password
async function createUser(email, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    email: email,
    password: passwordHash,
    token: uuid.v4(),
  };
  users.push(user);
  return user;
}

// Helper function to find a user by any field (email, token, etc)
async function findUser(field, value) {
  if (!value) return null;
  return users.find((u) => u[field] === value);
}

// Set up our authentication cookie with secure settings
function setAuthCookie(res, authToken) {
  res.cookie(authCookieName, authToken, {
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
  });
}

// Middleware to check if a user is logged in
const verifyAuth = async (req, res, next) => {
  const user = await findUser('token', req.cookies[authCookieName]);
  if (user) {
    // Store the user info for use in route handlers
    req.user = user;
    next();
  } else {
    res.status(401).send({ msg: 'Unauthorized' });
  }
};

// CreateAuth - Register a new user
apiRouter.post('/auth/create', async (req, res) => {
  if (await findUser('email', req.body.email)) {
    res.status(409).send({ msg: 'User already exists' });
  } else {
    const user = await createUser(req.body.email, req.body.password);
    setAuthCookie(res, user.token);
    res.send({ email: user.email });
  }
});

// GetAuth - Login an existing user
apiRouter.post('/auth/login', async (req, res) => {
  const user = await findUser('email', req.body.email);
  if (user) {
    if (await bcrypt.compare(req.body.password, user.password)) {
      user.token = uuid.v4();
      setAuthCookie(res, user.token);
      res.send({ email: user.email });
      return;
    }
  }
  res.status(401).send({ msg: 'Unauthorized' });
});

// DeleteAuth - Logout a user
apiRouter.delete('/auth/logout', async (req, res) => {
  const user = await findUser('token', req.cookies[authCookieName]);
  if (user) {
    delete user.token;
  }
  res.clearCookie(authCookieName);
  res.status(204).end();
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

// SubmitAnalysis - Start a new code analysis
apiRouter.post('/analysis', verifyAuth, async (req, res) => {
  const analysisId = uuid.v4();
  const timestamp = new Date().toISOString();
  
  // Create a new analysis record
  const analysis = {
    id: analysisId,
    userId: req.user.email,
    name: req.body.name,
    files: req.body.files,
    date: timestamp,
    status: 'processing',
    result: null
  };
  
  analyses.push(analysis);
  
  // In a real implementation, we would call OpenAI API here
  // For now, simulate the analysis with a timeout
  setTimeout(() => {
    analysis.status = 'completed';
    analysis.result = generateMockAnalysisResult(analysis.files);
  }, 3000);
  
  res.send({ 
    id: analysisId, 
    status: 'processing' 
  });
});

// GetAnalysis - Get a specific analysis result
apiRouter.get('/analysis/:id', verifyAuth, async (req, res) => {
  const analysis = analyses.find(a => a.id === req.params.id && a.userId === req.user.email);
  
  if (!analysis) {
    res.status(404).send({ msg: 'Analysis not found' });
    return;
  }
  
  res.send(analysis);
});

// GetUserAnalyses - Get all analyses for the current user
apiRouter.get('/analyses', verifyAuth, async (req, res) => {
  const userAnalyses = analyses
    .filter(a => a.userId === req.user.email)
    .map(a => ({
      id: a.id,
      name: a.name,
      date: a.date,
      status: a.status
    }));
  
  res.send({ analyses: userAnalyses });
});

// Get user statistics and vulnerability trends
apiRouter.get('/stats', verifyAuth, async (req, res) => {
  const userAnalyses = analyses.filter(a => a.userId === req.user.email && a.status === 'completed');
  
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
  
  res.send({
    totalAnalyses,
    vulnerabilityStats,
    dailyStats,
    lastUpdated: new Date().toISOString()
  });
});

// Generate detailed report for a specific analysis
apiRouter.get('/analysis/:id/report', verifyAuth, async (req, res) => {
  const analysis = analyses.find(a => a.id === req.params.id && a.userId === req.user.email);
  
  if (!analysis) {
    res.status(404).send({ msg: 'Analysis not found' });
    return;
  }
  
  if (analysis.status !== 'completed') {
    res.status(400).send({ msg: 'Analysis not completed yet' });
    return;
  }
  
  // Generate detailed HTML report
  const report = generateHTMLReport(analysis);
  
  // Send report with proper headers for HTML content
  res.setHeader('Content-Type', 'text/html');
  res.send(report);
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
    // Ask OpenAI to analyze our code for security issues
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a cybersecurity expert. Analyze the provided code for security vulnerabilities. Format your response as JSON with the following structure: {\"vulnerabilities\": [{\"type\": \"vulnerability type\", \"severity\": \"high/medium/low\", \"line\": \"line number or range\", \"description\": \"description of the issue\", \"suggestion\": \"how to fix it\"}]}"
        },
        {
          role: "user",
          content: `Analyze this code for security vulnerabilities:\n\n${code}`
        }
      ],
      temperature: 0.7,
    });

    // Try to parse OpenAI's response as JSON
    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      // If parsing fails, wrap the raw response in our expected format
      return {
        vulnerabilities: [{
          type: "Analysis Result",
          severity: "info",
          line: "N/A",
          description: response.choices[0].message.content,
          suggestion: "See description for details"
        }]
      };
    }
  } catch (error) {
    console.error('Error analyzing code with OpenAI:', error);
    throw error;
  }
}

// Endpoint to analyze a code snippet
apiRouter.post('/analyze-code', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).send({ error: 'No code provided' });
    }
    
    const analysis = await analyzeCodeWithAI(code);
    res.send(analysis);
  } catch (error) {
    console.error('Error in code analysis endpoint:', error);
    res.status(500).send({ 
      error: 'Failed to analyze code',
      message: error.message 
    });
  }
});

// Mount routes in the correct order
app.use('/api', apiRouter);  // API routes first

// Error handler
app.use(function (err, req, res, next) {
  console.error(err);
  res.status(500).send({
    type: err.name,
    message: err.message
  });
});

// Static files and catch-all route last
app.use(express.static('public'));
app.use((_req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// Start the server!
app.listen(port, () => {
  console.log(`SecureCode service listening on port ${port}`);
});