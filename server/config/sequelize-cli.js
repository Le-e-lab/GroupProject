require('dotenv').config();
const path = require('path');

const storage = process.env.DB_STORAGE
  ? path.resolve(process.env.DB_STORAGE)
  : path.resolve(__dirname, '../../timetable.sqlite');

module.exports = {
  development: {
    dialect: process.env.DB_DIALECT || 'sqlite',
    storage,
    logging: false
  },
  test: {
    dialect: process.env.DB_DIALECT || 'sqlite',
    storage,
    logging: false
  },
  production: {
    dialect: process.env.DB_DIALECT || 'sqlite',
    storage,
    logging: false
  }
};
