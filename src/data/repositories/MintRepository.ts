/**
 * MintRepository
 *
 * Manages Cashu mint metadata, trust levels, and keysets.
 * Handles mint discovery, verification, and public key caching.
 *
 * Features:
 * - Mint metadata storage and retrieval
 * - Trust level management (untrusted, low, medium, high)
 * - Keyset caching for offline verification
 * - Last sync tracking for staleness detection
 * - Multi-unit support (sat, usd, eur)
 */

import Database from '../database/Database';
import { Mint, MintKeyset, TrustLevel } from '../../types';
import { generateUUID } from '../../utils/uuid';

/**
 * Mint filter options
 */
export interface MintFilter {
  trustLevel?: TrustLevel;
  url?: string;
}

/**
 * Keyset filter options
 */
export interface KeysetFilter {
  mintId?: string;
  keysetId?: string;
  active?: boolean;
  unit?: string;
}

/**
 * MintRepository class
 */
export class MintRepository {
  private static instance: MintRepository;
  private db: Database;

  private constructor() {
    this.db = Database.getInstance();
  }

  static getInstance(): MintRepository {
    if (!MintRepository.instance) {
      MintRepository.instance = new MintRepository();
    }
    return MintRepository.instance;
  }

  /**
   * Create a new mint entry
   */
  async create(
    mint: Omit<Mint, 'id' | 'createdAt'>
  ): Promise<Mint> {
    const id = generateUUID();
    const createdAt = Date.now();

    await this.db.execute(
      `INSERT INTO mints (
        id, url, name, description, public_key,
        trust_level, last_synced_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        mint.url,
        mint.name || null,
        mint.description || null,
        mint.publicKey || null,
        mint.trustLevel || TrustLevel.UNTRUSTED,
        mint.lastSyncedAt || null,
        createdAt,
      ]
    );

    return {
      id,
      ...mint,
      trustLevel: mint.trustLevel || TrustLevel.UNTRUSTED,
      createdAt,
    };
  }

  /**
   * Get mint by ID
   */
  async getById(id: string): Promise<Mint | null> {
    const mints = await this.db.query<any>(
      `SELECT * FROM mints WHERE id = ?`,
      [id]
    );

    if (mints.length === 0) {
      return null;
    }

    return this.mapRowToMint(mints[0]);
  }

  /**
   * Get mint by URL (unique identifier)
   */
  async getByUrl(url: string): Promise<Mint | null> {
    const mints = await this.db.query<any>(
      `SELECT * FROM mints WHERE url = ?`,
      [url]
    );

    if (mints.length === 0) {
      return null;
    }

    return this.mapRowToMint(mints[0]);
  }

  /**
   * Get all mints with optional filters
   */
  async getAll(filter: MintFilter = {}): Promise<Mint[]> {
    let sql = 'SELECT * FROM mints WHERE 1=1';
    const params: any[] = [];

    if (filter.trustLevel) {
      sql += ' AND trust_level = ?';
      params.push(filter.trustLevel);
    }

    if (filter.url) {
      sql += ' AND url = ?';
      params.push(filter.url);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = await this.db.query<any>(sql, params);
    return rows.map(row => this.mapRowToMint(row));
  }

  /**
   * Get trusted mints (medium or high trust)
   */
  async getTrustedMints(): Promise<Mint[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM mints
       WHERE trust_level IN (?, ?)
       ORDER BY trust_level DESC, created_at DESC`,
      [TrustLevel.HIGH, TrustLevel.MEDIUM]
    );

    return rows.map(row => this.mapRowToMint(row));
  }

  /**
   * Update mint metadata
   */
  async update(
    id: string,
    updates: Partial<Omit<Mint, 'id' | 'createdAt'>>
  ): Promise<void> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.url !== undefined) {
      fields.push('url = ?');
      params.push(updates.url);
    }

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      params.push(updates.description);
    }

    if (updates.publicKey !== undefined) {
      fields.push('public_key = ?');
      params.push(updates.publicKey);
    }

    if (updates.trustLevel !== undefined) {
      fields.push('trust_level = ?');
      params.push(updates.trustLevel);
    }

    if (updates.lastSyncedAt !== undefined) {
      fields.push('last_synced_at = ?');
      params.push(updates.lastSyncedAt);
    }

    if (fields.length === 0) {
      return;
    }

    params.push(id);

    await this.db.execute(
      `UPDATE mints SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  }

  /**
   * Update trust level for a mint
   */
  async setTrustLevel(id: string, trustLevel: TrustLevel): Promise<void> {
    await this.db.execute(
      `UPDATE mints SET trust_level = ? WHERE id = ?`,
      [trustLevel, id]
    );
  }

  /**
   * Update last synced timestamp
   */
  async updateLastSynced(id: string, timestamp: number = Date.now()): Promise<void> {
    await this.db.execute(
      `UPDATE mints SET last_synced_at = ? WHERE id = ?`,
      [timestamp, id]
    );
  }

  /**
   * Delete mint (CASCADE deletes associated keysets)
   */
  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM mints WHERE id = ?', [id]);
  }

  /**
   * Check if mint URL exists
   */
  async exists(url: string): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM mints WHERE url = ?`,
      [url]
    );

    return (result[0]?.count || 0) > 0;
  }

  /**
   * Get mint count
   */
  getCount(): number {
    const result = this.db.querySync<{ count: number }>(
      'SELECT COUNT(*) as count FROM mints'
    );

    return result[0]?.count || 0;
  }

  // ============================================
  // KEYSET MANAGEMENT
  // ============================================

  /**
   * Store mint keyset (public keys for verification)
   */
  async createKeyset(
    keyset: Omit<MintKeyset, 'id' | 'createdAt'>
  ): Promise<MintKeyset> {
    const id = generateUUID();
    const createdAt = Date.now();

    // Serialize keys object to JSON
    const keysJson = JSON.stringify(keyset.keys);

    await this.db.execute(
      `INSERT INTO mint_keysets (
        id, mint_id, keyset_id, unit, active, keys, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        keyset.mintId,
        keyset.keysetId,
        keyset.unit || 'sat',
        keyset.active ? 1 : 0,
        keysJson,
        createdAt,
      ]
    );

    return {
      id,
      ...keyset,
      unit: keyset.unit || 'sat',
      createdAt,
    };
  }

  /**
   * Get keyset by ID
   */
  async getKeysetById(id: string): Promise<MintKeyset | null> {
    const keysets = await this.db.query<any>(
      `SELECT * FROM mint_keysets WHERE id = ?`,
      [id]
    );

    if (keysets.length === 0) {
      return null;
    }

    return this.mapRowToKeyset(keysets[0]);
  }

  /**
   * Get keyset by keyset ID and mint ID
   */
  async getKeysetByKeysetId(
    mintId: string,
    keysetId: string
  ): Promise<MintKeyset | null> {
    const keysets = await this.db.query<any>(
      `SELECT * FROM mint_keysets WHERE mint_id = ? AND keyset_id = ?`,
      [mintId, keysetId]
    );

    if (keysets.length === 0) {
      return null;
    }

    return this.mapRowToKeyset(keysets[0]);
  }

  /**
   * Get all keysets for a mint
   */
  async getKeysets(filter: KeysetFilter = {}): Promise<MintKeyset[]> {
    let sql = 'SELECT * FROM mint_keysets WHERE 1=1';
    const params: any[] = [];

    if (filter.mintId) {
      sql += ' AND mint_id = ?';
      params.push(filter.mintId);
    }

    if (filter.keysetId) {
      sql += ' AND keyset_id = ?';
      params.push(filter.keysetId);
    }

    if (filter.active !== undefined) {
      sql += ' AND active = ?';
      params.push(filter.active ? 1 : 0);
    }

    if (filter.unit) {
      sql += ' AND unit = ?';
      params.push(filter.unit);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = await this.db.query<any>(sql, params);
    return rows.map(row => this.mapRowToKeyset(row));
  }

  /**
   * Get active keysets for a mint
   */
  async getActiveKeysets(mintId: string, unit: string = 'sat'): Promise<MintKeyset[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM mint_keysets
       WHERE mint_id = ? AND unit = ? AND active = 1
       ORDER BY created_at DESC`,
      [mintId, unit]
    );

    return rows.map(row => this.mapRowToKeyset(row));
  }

  /**
   * Update keyset (e.g., mark as inactive)
   */
  async updateKeyset(
    id: string,
    updates: Partial<Omit<MintKeyset, 'id' | 'mintId' | 'keysetId' | 'createdAt'>>
  ): Promise<void> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.active !== undefined) {
      fields.push('active = ?');
      params.push(updates.active ? 1 : 0);
    }

    if (updates.unit !== undefined) {
      fields.push('unit = ?');
      params.push(updates.unit);
    }

    if (updates.keys !== undefined) {
      fields.push('keys = ?');
      params.push(JSON.stringify(updates.keys));
    }

    if (fields.length === 0) {
      return;
    }

    params.push(id);

    await this.db.execute(
      `UPDATE mint_keysets SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  }

  /**
   * Mark keyset as inactive
   */
  async deactivateKeyset(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE mint_keysets SET active = 0 WHERE id = ?`,
      [id]
    );
  }

  /**
   * Deactivate all keysets for a mint and activate a new one
   * Useful when rotating keys
   */
  async rotateKeysets(mintId: string, newKeysetId: string): Promise<void> {
    return this.db.transaction(async (tx) => {
      // Deactivate all current keysets
      tx.execute(
        `UPDATE mint_keysets SET active = 0 WHERE mint_id = ?`,
        [mintId]
      );

      // Activate the new keyset
      tx.execute(
        `UPDATE mint_keysets SET active = 1 WHERE mint_id = ? AND keyset_id = ?`,
        [mintId, newKeysetId]
      );
    });
  }

  /**
   * Delete keyset
   */
  async deleteKeyset(id: string): Promise<void> {
    await this.db.execute('DELETE FROM mint_keysets WHERE id = ?', [id]);
  }

  /**
   * Delete all keysets for a mint
   */
  async deleteAllKeysets(mintId: string): Promise<void> {
    await this.db.execute('DELETE FROM mint_keysets WHERE mint_id = ?', [mintId]);
  }

  /**
   * Check if keyset exists
   */
  async keysetExists(mintId: string, keysetId: string): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM mint_keysets
       WHERE mint_id = ? AND keyset_id = ?`,
      [mintId, keysetId]
    );

    return (result[0]?.count || 0) > 0;
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get mint statistics
   */
  getStats(): {
    totalMints: number;
    trustedMints: number;
    untrustedMints: number;
    keysetCount: number;
    activeKeysetCount: number;
  } {
    const totalMints = this.db.querySync<{ count: number }>(
      'SELECT COUNT(*) as count FROM mints'
    )[0]?.count || 0;

    const trustedMints = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM mints
       WHERE trust_level IN (?, ?)`,
      [TrustLevel.HIGH, TrustLevel.MEDIUM]
    )[0]?.count || 0;

    const untrustedMints = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM mints WHERE trust_level = ?`,
      [TrustLevel.UNTRUSTED]
    )[0]?.count || 0;

    const keysetCount = this.db.querySync<{ count: number }>(
      'SELECT COUNT(*) as count FROM mint_keysets'
    )[0]?.count || 0;

    const activeKeysetCount = this.db.querySync<{ count: number }>(
      'SELECT COUNT(*) as count FROM mint_keysets WHERE active = 1'
    )[0]?.count || 0;

    return {
      totalMints,
      trustedMints,
      untrustedMints,
      keysetCount,
      activeKeysetCount,
    };
  }

  /**
   * Get stale mints (not synced in X hours)
   */
  async getStaleMints(hoursThreshold: number = 24): Promise<Mint[]> {
    const cutoffTime = Date.now() - (hoursThreshold * 60 * 60 * 1000);

    const rows = await this.db.query<any>(
      `SELECT * FROM mints
       WHERE last_synced_at IS NULL OR last_synced_at < ?
       ORDER BY last_synced_at ASC`,
      [cutoffTime]
    );

    return rows.map(row => this.mapRowToMint(row));
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Map database row to Mint object
   */
  private mapRowToMint(row: any): Mint {
    return {
      id: row.id,
      url: row.url,
      name: row.name,
      description: row.description,
      publicKey: row.public_key,
      trustLevel: row.trust_level as TrustLevel,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
    };
  }

  /**
   * Map database row to MintKeyset object
   */
  private mapRowToKeyset(row: any): MintKeyset {
    return {
      id: row.id,
      mintId: row.mint_id,
      keysetId: row.keyset_id,
      unit: row.unit,
      active: row.active === 1,
      keys: JSON.parse(row.keys),
      createdAt: row.created_at,
    };
  }
}

/**
 * Singleton instance export
 */
export default MintRepository.getInstance();
