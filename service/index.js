const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const uuid = require('uuid');

const app = express();

// Parse JSON and cookies
app.use(express.json());
app.use(cookieParser());

const port = process.argv.length > 2 ? process.argv[2] : 3000;
const authCookieName = 'securecode_token';

// In-memory data structures (will replace with MongoDB later)
let users = [];
let analyses = [];

// Set up API router
const apiRouter = express.Router();
app.use('/api', apiRouter);

// Add a simple test endpoint
apiRouter.get('/test', (_req, res) => {
  res.send({ msg: 'SecureCode service is running' });
});

// Authentication helper functions
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

async function findUser(field, value) {
  if (!value) return null;
  return users.find((u) => u[field] === value);
}

function setAuthCookie(res, authToken) {
  res.cookie(authCookieName, authToken, {
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
  });
}

// Authentication middleware
const verifyAuth = async (req, res, next) => {
  const user = await findUser('token', req.cookies[authCookieName]);
  if (user) {
    req.user = user; // Attach user to request for use in handlers
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

// Mock function to generate analysis results for demo purposes
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
    // Generate between 0-3 random vulnerabilities per file
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

app.listen(port, () => {
  console.log(`SecureCode service listening on port ${port}`);
});