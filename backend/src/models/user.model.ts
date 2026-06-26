import mongoose from "mongoose";

const authProviderValues = ["local", "google"] as const;

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: false,
      minlength: 6,
    },
    authProvider: {
      type: String,
      enum: authProviderValues,
      default: "local",
    },
    providerId: {
      type: String,
      default: null,
      index: { unique: true, sparse: true },
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    profilePic: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
