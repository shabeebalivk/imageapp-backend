const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
    user: { type: String, required: true },
    image: { type: String, required: true, unique: true },
    title: { type: String, required: true },
});

const Image = mongoose.model('Image', imageSchema);

module.exports = Image;