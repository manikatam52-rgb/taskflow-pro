import { Schema, model, Types, type Document } from "mongoose";

/** Safe user shape sent to clients — never includes the password hash. */
export interface SafeUser {
  _id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface UserDocument extends Document {
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  toSafeUser(): SafeUser;
}

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Hashed with bcryptjs in the route/service layer — plaintext never stored.
    password: { type: String, required: true },
    name: { type: String, required: false, default: "", trim: true },
  },
  { timestamps: true }
);

/** Returns only safe fields. Password hash is never sent to the client. */
userSchema.methods.toSafeUser = function (this: UserDocument): SafeUser {
  return {
    _id: (this._id as Types.ObjectId).toString(),
    email: this.email,
    name: this.name,
    createdAt: this.createdAt,
  };
};

export const User = model<UserDocument>("User", userSchema);
