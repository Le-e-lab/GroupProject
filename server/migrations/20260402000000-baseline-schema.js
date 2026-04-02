'use strict';

/**
 * Baseline migration for existing UPath databases.
 *
 * This marks the current schema as the migration starting point.
 * The runtime still uses Sequelize sync in server startup; this file
 * intentionally avoids table mutations to prevent data loss.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('SELECT 1;');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('SELECT 1;');
  }
};
