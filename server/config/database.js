const { Sequelize } = require('sequelize');
const path = require('path');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../timetable.sqlite'), // Use the provided pre-filled DB
    logging: false // Disable SQL logging for cleaner console
});

module.exports = sequelize;
