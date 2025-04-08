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

app.listen(port, () => {
  console.log(`SecureCode service listening on port ${port}`);
});