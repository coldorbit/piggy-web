import { Sequelize } from 'sequelize';

let sequelize;

export function getSequelize() {
  if (!sequelize) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for the web app');
    }

    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions:
        process.env.DATABASE_SSL === 'true'
          ? {
              ssl: {
                require: true,
                rejectUnauthorized: false,
              },
            }
          : {},
    });
  }

  return sequelize;
}
