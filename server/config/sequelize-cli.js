require('dotenv').config();

const storage = process.env.DB_STORAGE || './timetable.sqlite';

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
