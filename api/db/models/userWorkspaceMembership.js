import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let UserWorkspaceMembership;

export function getUserWorkspaceMembershipModel() {
  if (UserWorkspaceMembership) return UserWorkspaceMembership;

  UserWorkspaceMembership = getSequelize().define(
    'UserWorkspaceMembership',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'user_id',
      },
      workspaceId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'workspace_id',
      },
      accessRole: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'readonly_bidder',
        field: 'access_role',
      },
      status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'active',
      },
      createdByUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'created_by_user_id',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
      },
    },
    {
      tableName: 'user_workspace_memberships',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  );

  return UserWorkspaceMembership;
}
