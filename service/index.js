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

app.listen(port, () => {
  console.log(`SecureCode service listening on port ${port}`);
});