require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const uuid = require('uuid');
const fetch = require('node-fetch');
const { OpenAI } = require('openai');
const DB = require('./database.js');

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

    const user = await findUser('token', token);
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

// Helper function to create a new user with a hashed password
async function createUser(email, password) {
  if (!email || !password) {
    throw new APIError('Email and password are required', 400, 'MISSING_CREDENTIALS');
  }
  
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new APIError('Invalid credential format', 400, 'INVALID_CREDENTIALS');
  }

  if (password.length < 8) {
    throw new APIError('Password must be at least 8 characters', 400, 'WEAK_PASSWORD');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    email: email.toLowerCase(),
    password: passwordHash,
    token: uuid.v4(),
  };
  await DB.addUser(user);
  return user;
}

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
  });
}

// CreateAuth - Register a new user
apiRouter.post('/auth/register', async (req, res, next) => {
  try {
    if (await findUser('email', req.body.email?.toLowerCase())) {
      throw new APIError('User already exists', 409, 'USER_EXISTS');
    }

    const user = await createUser(req.body.email, req.body.password);
    setAuthCookie(res, user.token);
    res.status(201).json({ email: user.email });
  } catch (error) {
    next(error);
  }
});

// GetAuth - Login an existing user
apiRouter.post('/auth/login', async (req, res, next) => {
  try {
    if (!req.body.email || !req.body.password) {
      throw new APIError('Email and password are required', 400, 'MISSING_CREDENTIALS');
    }

    const user = await findUser('email', req.body.email.toLowerCase());
    if (!user) {
      throw new APIError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) {
      throw new APIError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    user.token = uuid.v4();
    await DB.updateUser(user);
    setAuthCookie(res, user.token);
    res.json({ email: user.email });
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

// Submit code for analysis
apiRouter.post('/analyze', verifyAuth, async (req, res, next) => {
  try {
    const { files } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new APIError('No files provided for analysis', 400, 'NO_FILES');
    }
    
    let result;
    try {
      // In development, we'll just generate mock results to avoid OpenAI API costs
      if (process.env.NODE_ENV === 'development') {
        result = generateMockAnalysisResult(files);
      } else {
        // In production, use the OpenAI API
        // Combine all code for analysis
        const allCode = files.map(f => `File: ${f.name}\n\n${f.content}`).join('\n\n');
        result = await analyzeCodeWithAI(allCode);
      }
      
      // Create and store the analysis record
      const analysis = {
        userEmail: req.user.email,
        date: new Date(),
        files: files.map(f => f.name),
        result: result
      };
      
      const dbResult = await DB.addAnalysis(analysis);
      analysis._id = dbResult.insertedId;
      
      res.json(analysis);
    } catch (error) {
      console.error('Analysis error:', error);
      throw new APIError('Analysis failed', 500, 'ANALYSIS_FAILED');
    }
  } catch (error) {
    next(error);
  }
});

// Get user's analysis history
apiRouter.get('/history', verifyAuth, async (req, res, next) => {
  try {
    const history = await DB.getAnalysisHistory(req.user.email);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Get a specific analysis by ID
apiRouter.get('/analysis/:id', verifyAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      throw new APIError('Analysis ID is required', 400, 'MISSING_ID');
    }
    
    const analysis = await DB.getAnalysisById(id);
    
    if (!analysis) {
      throw new APIError('Analysis not found', 404, 'NOT_FOUND');
    }
    
    // Only allow users to access their own analyses
    if (analysis.userEmail !== req.user.email) {
      throw new APIError('Access denied', 403, 'ACCESS_DENIED');
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
app.listen(port, () => {
  console.log(`SecureCode service listening on port ${port}`);
});