const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;
const dbPath = path.join(__dirname, 'tax_tracker.db');
const db = new Database(dbPath);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS business_info (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT,
    rcNumber TEXT,
    tin TEXT,
    fiscalYearStart TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('sale', 'expense')),
    date TEXT,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO business_info (id, name, rcNumber, tin, fiscalYearStart)
  VALUES (1, '', '', '', '${new Date().getFullYear()}-01-01');
`);

// API Endpoints

// Get all data (initial load)
app.get('/api/init', (req, res) => {
  try {
    const businessInfo = db.prepare('SELECT * FROM business_info WHERE id = 1').get();
    const transactions = db.prepare('SELECT * FROM transactions').all();
    
    // Parse the JSON data field in transactions
    const sales = transactions
      .filter(t => t.type === 'sale')
      .map(t => ({ ...JSON.parse(t.data), id: t.id, date: t.date }));
      
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .map(t => ({ ...JSON.parse(t.data), id: t.id, date: t.date }));

    res.json({
      businessInfo,
      salesEntries: sales,
      expenseEntries: expenses
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Business Info
app.post('/api/business-info', (req, res) => {
  const { name, rcNumber, tin, fiscalYearStart } = req.body;
  try {
    const stmt = db.prepare(`
      UPDATE business_info 
      SET name = ?, rcNumber = ?, tin = ?, fiscalYearStart = ?
      WHERE id = 1
    `);
    stmt.run(name, rcNumber, tin, fiscalYearStart);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Transaction (Sale or Expense)
app.post('/api/transaction', (req, res) => {
  const { type, date, data } = req.body; // data is the entry object without id
  try {
    const stmt = db.prepare('INSERT INTO transactions (type, date, data) VALUES (?, ?, ?)');
    const info = stmt.run(type, date, JSON.stringify(data));
    res.json({ id: info.lastInsertRowid, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Transaction
app.put('/api/transaction/:id', (req, res) => {
  const { id } = req.params;
  const { date, data } = req.body;
  try {
    const stmt = db.prepare('UPDATE transactions SET date = ?, data = ? WHERE id = ?');
    stmt.run(date, JSON.stringify(data), id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Transaction
app.delete('/api/transaction/:id', (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
    stmt.run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear All Data
app.post('/api/clear', (req, res) => {
  try {
    db.prepare('DELETE FROM transactions').run();
    db.prepare(`
        UPDATE business_info 
        SET name = '', rcNumber = '', tin = '', fiscalYearStart = '${new Date().getFullYear()}-01-01'
        WHERE id = 1
    `).run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
