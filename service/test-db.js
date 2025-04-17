const { MongoClient } = require('mongodb');
const config = require('./dbConfig.json');

async function testConnection() {
  const url = `mongodb+srv://${config.userName}:${config.password}@${config.hostname}`;
  const client = new MongoClient(url);

  try {
    console.log('Attempting to connect to MongoDB...');
    await client.connect();
    console.log('Successfully connected to MongoDB');

    const db = client.db('secureCode');
    console.log('Testing database ping...');
    await db.command({ ping: 1 });
    console.log('Database ping successful');

    // Test collection access
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));

    // Test user collection
    const userCollection = db.collection('user');
    const userCount = await userCollection.countDocuments();
    console.log(`User collection contains ${userCount} documents`);

  } catch (error) {
    console.error('Error during connection test:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.codeName) {
      console.error('Error code name:', error.codeName);
    }
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

testConnection(); 