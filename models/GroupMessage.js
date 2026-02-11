const mongoose = require("mongoose");

const groupMessageSchema = new mongoose.Schema(
    {
        from_user: {
        type: String,
        required: [true, "from_user is required"],
        trim: true,
        },
        room: {
        type: String,
        required: [true, "room is required"],
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

module.exports = mongoose.model("GroupMessage", groupMessageSchema);
