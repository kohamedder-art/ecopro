import { pool as poolMaybe } from "../utils/database";
import { RequestHandler } from "express";

const pool = poolMaybe!;

export const listBills: RequestHandler = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM platform_bills ORDER BY COALESCE(due_date, created_at) DESC'
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('listBills error:', err);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
};

export const createBill: RequestHandler = async (req, res) => {
  try {
    const { name, category, amount, currency, due_date, paid_at, notes } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO platform_bills (name, category, amount, currency, due_date, paid_at, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name,
        category || 'other',
        amount || 0,
        currency || 'USD',
        due_date || null,
        paid_at || null,
        notes || null,
        (req as any).user?.id || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('createBill error:', err);
    res.status(500).json({ error: 'Failed to create bill' });
  }
};

export const updateBill: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, amount, currency, due_date, paid_at, notes } = req.body;
    const result = await pool.query(
      `UPDATE platform_bills
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           amount = COALESCE($3, amount),
           currency = COALESCE($4, currency),
           due_date = COALESCE($5, due_date),
           paid_at = $6,
           notes = COALESCE($7, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [name, category, amount, currency, due_date, paid_at ?? null, notes, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Bill not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('updateBill error:', err);
    res.status(500).json({ error: 'Failed to update bill' });
  }
};

export const deleteBill: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM platform_bills WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Bill not found' });
      return;
    }
    res.json({ deleted: true });
  } catch (err: any) {
    console.error('deleteBill error:', err);
    res.status(500).json({ error: 'Failed to delete bill' });
  }
};

export const getBillsSummary: RequestHandler = async (req, res) => {
  try {
    const totalResult = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM platform_bills"
    );
    const paidResult = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM platform_bills WHERE paid_at IS NOT NULL"
    );
    const unpaidResult = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM platform_bills WHERE paid_at IS NULL"
    );
    const upcomingResult = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM platform_bills WHERE paid_at IS NULL AND due_date IS NOT NULL AND due_date <= CURRENT_DATE + INTERVAL '30 days'"
    );
    const categoryResult = await pool.query(
      'SELECT category, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM platform_bills GROUP BY category ORDER BY total DESC'
    );
    const monthlyResult = await pool.query(
      `SELECT
         TO_CHAR(COALESCE(due_date, created_at), 'YYYY-MM') AS month,
         COALESCE(SUM(amount), 0) AS total,
         COUNT(*) AS count
       FROM platform_bills
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`
    );
    res.json({
      all: totalResult.rows[0],
      paid: paidResult.rows[0],
      unpaid: unpaidResult.rows[0],
      upcoming: upcomingResult.rows[0],
      byCategory: categoryResult.rows,
      byMonth: monthlyResult.rows,
    });
  } catch (err: any) {
    console.error('getBillsSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch bills summary' });
  }
};
