import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let ForwardedMailboxMessage;

export function getForwardedMailboxMessageModel() {
  if (ForwardedMailboxMessage) return ForwardedMailboxMessage;

  ForwardedMailboxMessage = getSequelize().define(
    'ForwardedMailboxMessage',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      messageId: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'message_id',
      },
      mailboxPath: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'mailbox_path',
      },
      mailboxUid: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'mailbox_uid',
      },
      profileId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'profile_id',
      },
      matchValue: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'match_value',
      },
      matchSource: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'match_source',
      },
      subject: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      fromName: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
        field: 'from_name',
      },
      fromAddress: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
        field: 'from_address',
      },
      senderName: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
        field: 'sender_name',
      },
      senderAddress: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
        field: 'sender_address',
      },
      toAddresses: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        field: 'to_addresses',
      },
      ccAddresses: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        field: 'cc_addresses',
      },
      bccAddresses: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        field: 'bcc_addresses',
      },
      receivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'received_at',
      },
      bodyPreview: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
        field: 'body_preview',
      },
      bodyHtml: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
        field: 'body_html',
      },
      bodyText: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
        field: 'body_text',
      },
      headers: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_read',
      },
      classification: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      application: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      firstSeenAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'first_seen_at',
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'last_seen_at',
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
      tableName: 'forwarded_mailbox_messages',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { unique: true, fields: ['message_id'] },
        { fields: ['match_value', 'received_at'] },
        { fields: ['match_value', 'is_read'] },
        { fields: ['profile_id', 'received_at'] },
        { fields: ['profile_id', 'is_read'] },
        { fields: ['received_at'] },
      ],
    },
  );

  return ForwardedMailboxMessage;
}
