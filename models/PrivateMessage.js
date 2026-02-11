const mongoose = require("mongoose");

const privateMessageSchema = new mongoose.Schema(
    {
        from_user: {
        type: String,
        required: [true, "from_user is required"],
        trim: true,
        },
        to_user: {
        type: String,
        required: [true, "to_user is required"],
        trim: true,
        },
        message: {
        type: String,
        required: [true, "message is required"],
        trim: true,
        maxlength: [2000, "message too long"],
        },
        date_sent: {
        type: String,
        required: true,
        default: () => new Date().toLocaleString(),
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("PrivateMessage", privateMessageSchema);
