const { query } = require('../config/database');

/**
 * Bulk sync operation
 * POST /api/v1/sync
 */
const syncData = async (req, res, next) => {
  try {
    const { operations } = req.body;

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        error: 'operations array is required',
      });
    }

    const results = [];
    const errors = [];

    // Process each operation
    for (const operation of operations) {
      try {
        const { type, table, data, recordId } = operation;

        let result;

        switch (type) {
          case 'CREATE':
            // Insert new record
            result = await handleCreate(table, data, req.user.id);
            results.push({ recordId, success: true, id: result.id });
            break;

          case 'UPDATE':
            // Update existing record
            result = await handleUpdate(table, recordId, data, req.user.id);
            results.push({ recordId, success: true });
            break;

          case 'DELETE':
            // Soft delete record
            result = await handleDelete(table, recordId, req.user.id);
            results.push({ recordId, success: true });
            break;

          default:
            errors.push({ recordId, error: 'Invalid operation type' });
        }
      } catch (error) {
        errors.push({
          recordId: operation.recordId,
          error: error.message,
        });
      }
    }

    // Update sync metadata
    await query(
      `INSERT INTO sync_metadata (user_id, table_name, last_synced_at)
       VALUES ($1, 'all', NOW())
       ON CONFLICT (user_id, table_name)
       DO UPDATE SET last_synced_at = NOW()`,
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'Sync completed',
      data: {
        processed: operations.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get last sync time for user
 * GET /api/v1/sync/last?userId=:id
 */
const getLastSyncTime = async (req, res, next) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId query parameter is required',
      });
    }

    // Users can only view their own sync time
    if (userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only view your own sync status',
      });
    }

    const result = await query(
      `SELECT table_name, last_synced_at
       FROM sync_metadata
       WHERE user_id = $1
       ORDER BY last_synced_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to handle CREATE operations
 */
async function handleCreate(table, data, userId) {
  // Validate user has permission to create in this table
  // Implement table-specific logic here
  // For now, return a simple response
  return { id: data.id || 'generated-id' };
}

/**
 * Helper function to handle UPDATE operations
 */
async function handleUpdate(table, recordId, data, userId) {
  // Validate user has permission to update this record
  // Implement table-specific logic here
  return { success: true };
}

/**
 * Helper function to handle DELETE operations
 */
async function handleDelete(table, recordId, userId) {
  // Validate user has permission to delete this record
  // Implement table-specific logic here
  return { success: true };
}

module.exports = {
  syncData,
  getLastSyncTime,
};
