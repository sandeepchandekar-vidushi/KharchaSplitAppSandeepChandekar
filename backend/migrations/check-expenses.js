import { pool } from '../src/config/database.js';

async function checkExpenses() {
  try {
    console.log('\n📋 Checking Expenses:\n');

    // Get expenses for the Pune Trip groups
    const expensesResult = await pool.query(`
      SELECT e.id, e.description, e.amount, e.currency, e.group_id,
             g.name as group_name, e.paid_by_name, e.expense_date
      FROM expenses e
      JOIN groups g ON e.group_id = g.id
      WHERE g.name = 'Pune Trip Nov 2025' AND e.deleted_at IS NULL
      ORDER BY e.created_at DESC
    `);

    console.log(`Total expenses for "Pune Trip Nov 2025" groups: ${expensesResult.rows.length}\n`);

    if (expensesResult.rows.length === 0) {
      console.log('❌ No expenses found for these groups');
      console.log('   Groups exist but have no expenses yet.\n');
    } else {
      expensesResult.rows.forEach((expense, i) => {
        console.log(`${i + 1}. ${expense.description}`);
        console.log(`   Amount: ${expense.currency} ${expense.amount}`);
        console.log(`   Paid by: ${expense.paid_by_name}`);
        console.log(`   Group: ${expense.group_name}`);
        console.log(`   Date: ${expense.expense_date}`);
        console.log('');
      });
    }

    // Check if there are expenses in any group
    const allExpensesResult = await pool.query(`
      SELECT COUNT(*) as total FROM expenses WHERE deleted_at IS NULL
    `);

    console.log(`Total expenses in database: ${allExpensesResult.rows[0].total}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkExpenses();
