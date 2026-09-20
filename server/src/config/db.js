import mongoose from 'mongoose';
export const connectDb = async (uri = process.env.MONGODB_URI) => {
  if (!uri) throw new Error('MONGODB_URI is required');
  return mongoose.connect(uri);
};
