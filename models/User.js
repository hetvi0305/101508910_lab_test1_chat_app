const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        username: {
        type: String,
        required: [true, "username is required"],
        unique: true,
        trim: true,
        minlength: [3, "username must be at least 3 chars"],
        maxlength: [30, "username must be at most 30 chars"],
        },
        firstname: {
        type: String,
        required: [true, "firstname is required"],
        trim: true,
        maxlength: [50, "firstname too long"],
        },
        lastname: {
        type: String,
        required: [true, "lastname is required"],
        trim: true,
        maxlength: [50, "lastname too long"],
        },
        password: {
        type: String,
        required: [true, "password is required"],
        minlength: [6, "password must be at least 6 chars"],
        },
        // PDF field name: "createon"
        createon: {
        type: String,
        required: true,
        default: () => new Date().toLocaleString(),
        },
    },
    {
        // you can keep timestamps ON (helpful), even though PDF also has createon
        timestamps: true,
    }
);

// Helps make "unique" validation errors nicer to read
userSchema.index({ username: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
