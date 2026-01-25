/**
 * OAuth models for meta-gameplay
 * Based on migrations 007_meta_gameplay_tables.sql
 */

/**
 * Supported OAuth providers
 */
export type AuthProvider = 'telegram' | 'google' | 'yandex';

/**
 * OAuth Link record
 * Links multiple OAuth providers to a single user account
 * Allows users to authenticate via different platforms
 */
export interface OAuthLink {
  id: string;
  userId: string;
  authProvider: AuthProvider;
  providerUserId: string;
  createdAt: Date;
}
