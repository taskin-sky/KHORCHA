import "dotenv/config";
import { app } from "../src/app.js";
import { connectDb } from "../src/config/db.js";

let connectionPromise;

export default async function handler(req, res) {
  try {
    connectionPromise ||= connectDb();
    await connectionPromise;
    return app(req, res);
  } catch (error) {
    connectionPromise = undefined;
    console.error("Serverless function failed:", error);
    return res.status(500).json({
      success: false,
      message: "Server configuration or database connection failed",
    });
  }
}
