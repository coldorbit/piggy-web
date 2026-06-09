import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let MarketplaceMatch;

export function getMarketplaceMatchModel() {
  if (MarketplaceMatch) return MarketplaceMatch;

  MarketplaceMatch = getSequelize().define(
    'MarketplaceMatch',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      interviewOpportunityId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'interview_opportunity_id',
      },
      callerProfileId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'caller_profile_id',
      },
      assignedInternalUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'assigned_internal_user_id',
      },
      status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'suggested',
      },
      callerConfirmationStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'pending',
        field: 'caller_confirmation_status',
      },
      interviewConfirmationStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'pending',
        field: 'interview_confirmation_status',
      },
      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'scheduled_at',
      },
      meetingLink: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'meeting_link',
      },
      internalNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'internal_notes',
      },
      interviewOwnerNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'interview_owner_notes',
      },
      callerOwnerNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'caller_owner_notes',
      },
      outcomeStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'pending',
        field: 'outcome_status',
      },
      offerStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'none',
        field: 'offer_status',
      },
      offerAmount: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'offer_amount',
      },
      offerTerms: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'offer_terms',
      },
      platformFee: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'platform_fee',
      },
      callerPayout: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'caller_payout',
      },
      paymentStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'not_started',
        field: 'payment_status',
      },
      payoutStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'not_started',
        field: 'payout_status',
      },
      closedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'closed_at',
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
      tableName: 'marketplace_matches',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['status'] },
        { fields: ['interview_opportunity_id'] },
        { fields: ['caller_profile_id'] },
        { fields: ['scheduled_at'] },
      ],
    },
  );

  return MarketplaceMatch;
}
