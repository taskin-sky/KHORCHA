import "dotenv/config";
import { app } from "../src/app.js";
import { connectDb } from "../src/config/db.js";

const requiredEnvironment = ["MONGODB_URI", "JWT_SECRET", "CLIENT_URL"];

export default async function handler(req, res) {
  try {
    const missingEnvironment = requiredEnvironment.filter(
      (name) => !process.env[name]?.trim(),
    );
    if (missingEnvironment.length) {
      console.error(
        `Missing server environment variables: ${missingEnvironment.join(", ")}`,
      );
      return res.status(500).json({
        success: false,
        message: "Server environment variables are not configured",
      });
    }

    await connectDb();
    return app(req, res);
  } catch (error) {
    console.error("Serverless function failed:", error);
    return res.status(500).json({
      success: false,
      message: "Server configuration or database connection failed",
    });
  }
}
