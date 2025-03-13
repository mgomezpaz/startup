const { MongoClient } = require('mongodb');
const config = require('./dbConfig.json');

const url = `mongodb+srv://${config.userName}:${config.password}@${config.hostname}`;
const client = new MongoClient(url);
const db = client.db('secureCode');
const userCollection = db.collection('user');
const analysisCollection = db.collection('analysis');

// This will asynchronously test the connection and exit the process if it fails
(async function testConnection() {
  try {
    await db.command({ ping: 1 });
    console.log(`Connected to database`);
  } catch (ex) {
    console.log(`Unable to connect to database with ${url} because ${ex.message}`);
    process.exit(1);
  }
})();

// User-related functions
function getUser(email) {
  return userCollection.findOne({ email: email });
}

function getUserByToken(token) {
  return userCollection.findOne({ token: token });
}

async function addUser(user) {
  await userCollection.insertOne(user);
}

async function updateUser(user) {
  await userCollection.updateOne({ email: user.email }, { $set: user });
}

// Analysis-related functions
async function addAnalysis(analysis) {
  return analysisCollection.insertOne(analysis);
}

async function getAnalysisHistory(email) {
  const query = { userEmail: email };
  const options = {
    sort: { date: -1 },
  };
  const cursor = analysisCollection.find(query, options);
  return cursor.toArray();
}

async function getAnalysisById(id) {
  return analysisCollection.findOne({ _id: id });
}

module.exports = {
  getUser,
  getUserByToken,
  addUser,
  updateUser,
  addAnalysis,
  getAnalysisHistory,
  getAnalysisById,
}; 