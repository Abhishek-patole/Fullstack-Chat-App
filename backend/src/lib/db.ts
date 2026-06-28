import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URL as string);
    console.log(`MongoDB Connected Successfully At : ${conn.connection.host}`);
  } catch (error: unknown) {
    console.log("MongoDB Connection Error :", error);
  }
};
