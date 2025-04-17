const { MongoClient, ObjectId } = require('mongodb');
const config = require('./dbConfig.json');

// TODO: Maybe move this to a separate config file later
const url = `mongodb+srv://${config.userName}:${config.password}@${config.hostname}`;
const client = new MongoClient(url);
const db = client.db('secureCode');
const userCollection = db.collection('user');
const analysisCollection = db.collection('analysis');

// Create indexes - this is kinda important for performance
async function createIndexes() {
  try {
    // Email should be unique, duh
    await userCollection.createIndex({ email: 1 }, { unique: true });
    // Token index for faster lookups
    await userCollection.createIndex({ token: 1 });
    // User's analysis history
    await analysisCollection.createIndex({ userEmail: 1 });
    // Sort by date, newest first
    await analysisCollection.createIndex({ date: -1 });
    console.log('Indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
    console.error('Stack trace:', error.stack);
    // Don't throw here, we can still work without indexes
  }
}

// Test connection on startup
(async function testConnection() {
  try {
    await db.command({ ping: 1 });
    console.log(`Connected to database`);
    await createIndexes();
  } catch (ex) {
    console.error(`Unable to connect to database with ${url}`);
    console.error('Error details:', ex.message);
    console.error('Stack trace:', ex.stack);
    process.exit(1);
  }
})();

// User stuff
async function getUser(email) {
  try {
    return await userCollection.findOne({ email: email });
  } catch (error) {
    console.error('Error in getUser:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

async function getUserByToken(token) {
  try {
    return await userCollection.findOne({ token: token });
  } catch (error) {
    console.error('Error in getUserByToken:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

async function addUser(user) {
  try {
    const result = await userCollection.insertOne(user);
    console.log('User added successfully:', result.insertedId);
    return result;
  } catch (error) {
    console.error('Error in addUser:', error);
    console.error('Stack trace:', error.stack);
    if (error.code === 11000) {
      throw new Error('Email already exists');
    }
    throw error;
  }
}

async function updateUser(user) {
  // Always update the updatedAt field
  user.updatedAt = new Date();
  await userCollection.updateOne({ email: user.email }, { $set: user });
}

async function getAllUsers() {
  // Only get the fields we need
  const options = {
    projection: {
      email: 1,
      role: 1,
      createdAt: 1,
      updatedAt: 1
    }
  };
  const cursor = userCollection.find({}, options);
  return cursor.toArray();
}

async function updateUserRole(email, role) {
  // Basic role validation
  if (!['user', 'admin'].includes(role)) {
    throw new Error('Invalid role');
  }
  await userCollection.updateOne(
    { email: email },
    { 
      $set: { 
        role: role,
        updatedAt: new Date()
      }
    }
  );
}

// Analysis related functions
async function addAnalysis(analysis) {
  // Check required fields
  const requiredFields = ['id', 'userEmail', 'date', 'status'];
  for (const field of requiredFields) {
    if (!analysis[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Add some metadata
  const analysisWithMetadata = {
    ...analysis,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: '1.0' // TODO: Maybe make this configurable
  };

  const result = await analysisCollection.insertOne(analysisWithMetadata);
  return result.insertedId;
}

async function updateAnalysisStatus(id, status, error = null) {
  try {
    const update = {
      $set: {
        status,
        updatedAt: new Date()
      }
    };

    // Add error if provided
    if (error) {
      update.$set.error = error;
    }

    return await analysisCollection.updateOne(
      { id: id },
      update
    );
  } catch (error) {
    console.error('Error updating analysis status:', error);
    throw error;
  }
}

async function updateAnalysisResults(id, results, status) {
  try {
    return await analysisCollection.updateOne(
      { id: id },
      {
        $set: {
          results,
          status,
          updatedAt: new Date()
        }
      }
    );
  } catch (error) {
    console.error('Error updating analysis results:', error);
    throw error;
  }
}

async function getAnalysisHistory(email) {
  // Get user's analysis history, sorted by date
  const query = { userEmail: email };
  const options = {
    sort: { date: -1 },
    projection: {
      _id: 1,
      date: 1,
      files: 1,
      repoUrl: 1,
      status: 1,
      results: 1
    }
  };
  const cursor = analysisCollection.find(query, options);
  return cursor.toArray();
}

async function getAnalysisById(id) {
  try {
    return await analysisCollection.findOne({ id: id });
  } catch (error) {
    console.error('Error getting analysis by ID:', error);
    throw error;
  }
}

// Export all the functions
module.exports = {
  getUser,
  getUserByToken,
  addUser,
  updateUser,
  getAllUsers,
  updateUserRole,
  addAnalysis,
  updateAnalysisStatus,
  updateAnalysisResults,
  getAnalysisHistory,
  getAnalysisById,
}; 