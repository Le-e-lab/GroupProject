const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const storagePath = process.env.DB_STORAGE
    ? path.resolve(process.env.DB_STORAGE)
    : path.resolve(__dirname, '../../timetable.sqlite');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
    dialect: process.env.DB_DIALECT || 'sqlite',
    storage: storagePath,
    logging: false
});

module.exports = sequelize;
