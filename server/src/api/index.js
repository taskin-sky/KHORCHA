import "dotenv/config";
import { app } from "../src/app.js";
import { connectDb } from "../src/config/db.js";

let dbConnected = false;

const handler = async (req, res) => {
  try {
    if (!dbConnected) {
      await connectDb();
      dbConnected = true;
    }

    return app(req, res);
  } catch (error) {
    console.error("Database connection failed:", error);

    return res.status(500).json({
      success: false,
      message: "Database connection failed",
      errors: [],
    });
  }
};

export default handler;