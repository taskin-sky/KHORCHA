import mongoose from 'mongoose';

let connectionPromise;

export const connectDb = async (uri = process.env.MONGODB_URI) => {
  if (!uri) throw new Error('MONGODB_URI is required');
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  connectionPromise ??= mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    return await connectionPromise;
  } catch (error) {
    connectionPromise = undefined;
    throw error;
  }
};
