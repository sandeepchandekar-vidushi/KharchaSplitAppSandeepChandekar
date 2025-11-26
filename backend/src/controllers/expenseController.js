import Expense from '../models/Expense.js';
import Group from '../models/Group.js';
import GroupService from '../services/groupService.js';
import ActivityService from '../services/activityService.js';

/**
 * Get expenses for a group
 * GET /api/v1/expenses?groupId=:id&page=1&limit=50
 */
const getExpenses = async (req, res, next) => {
  try {
    const { groupId, page = 1, limit = 50 } = req.query;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: 'groupId query parameter is required',
      });
    }

    // Verify user has access
    await GroupService.validateGroupAccess(groupId, req.user.id);

    const offset = (page - 1) * limit;
    const expenses = await Expense.findByGroupId(groupId, parseInt(limit), offset);
    const total = await Expense.countByGroupId(groupId);

    res.json({
      success: true,
      data: expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: offset + expenses.length < total,
      },
    });
  } catch (error) {
    if (error.message === 'User is not a member of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

/**
 * Get single expense with details
 * GET /api/v1/expenses/:id
 */
const getExpense = async (req, res, next) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findById(id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found',
      });
    }

    // Verify user has access to the group
    await GroupService.validateGroupAccess(expense.group_id, req.user.id);

    res.json({
      success: true,
      data: expense,
    });
  } catch (error) {
    if (error.message === 'User is not a member of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

/**
 * Create new expense
 * POST /api/v1/expenses
 */
const createExpense = async (req, res, next) => {
  try {
    const {
      groupId,
      description,
      amount,
      currency,
      category,
      paidById,
      paidByName,
      splitType,
      receiptBase64,
      notes,
      expenseDate,
      participants,
    } = req.body;

    // Verify user has access
    await GroupService.validateGroupAccess(groupId, req.user.id);

    // Get group name for activity log
    const group = await Group.findById(groupId);

    const expense = await Expense.create(
      {
        groupId,
        description,
        amount,
        currency,
        category,
        paidById,
        paidByName,
        splitType,
        receiptBase64,
        notes,
        expenseDate,
      },
      participants
    );

    // Log activity
    await ActivityService.logExpenseAdded(
      expense.id,
      groupId,
      req.user.id,
      group.name,
      description,
      amount,
      currency || 'USD'
    );

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: expense,
    });
  } catch (error) {
    if (error.message === 'User is not a member of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

/**
 * Update expense
 * PUT /api/v1/expenses/:id
 */
const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { description, amount, currency, category, receiptBase64, notes, expenseDate } = req.body;

    // Get expense to verify access
    const existingExpense = await Expense.findById(id);

    if (!existingExpense) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found',
      });
    }

    // Verify user has access
    await GroupService.validateGroupAccess(existingExpense.group_id, req.user.id);

    // Only the person who paid can edit the expense
    if (existingExpense.paid_by_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Only the person who paid can edit this expense',
      });
    }

    const expense = await Expense.update(id, {
      description,
      amount,
      currency,
      category,
      receiptBase64,
      notes,
      expenseDate,
    });

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete expense
 * DELETE /api/v1/expenses/:id
 */
const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get expense to verify access
    const expense = await Expense.findById(id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found',
      });
    }

    // Verify user is admin of the group or the payer
    const isAdmin = await Group.isAdmin(expense.group_id, req.user.id);
    const isPayer = expense.paid_by_id === req.user.id;

    if (!isAdmin && !isPayer) {
      return res.status(403).json({
        success: false,
        error: 'Only group admins or the payer can delete this expense',
      });
    }

    const deleted = await Expense.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found',
      });
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
};
