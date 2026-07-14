// ---------------------------------------------------------------------------
// Minimal JSON-file order store.
//
// This is intentionally simple: one JSON file, read/write on every call.
// It is fine for a solo operator doing tens/hundreds of orders a day.
// When you outgrow it, swap this module for Postgres/MySQL - every other
// file in this project only calls the functions exported here, so nothing
// else needs to change.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'orders.json');

function ensureFile() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');
}

function readAll() {
  ensureFile();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function createOrder(order) {
  const all = readAll();
  all[order.orderId] = {
    ...order,
    createdAt: new Date().toISOString(),
    status: order.status || 'pending_payment',
  };
  writeAll(all);
  return all[order.orderId];
}

function updateOrder(orderId, patch) {
  const all = readAll();
  if (!all[orderId]) return null;
  all[orderId] = { ...all[orderId], ...patch, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[orderId];
}

function getOrder(orderId) {
  const all = readAll();
  return all[orderId] || null;
}

module.exports = { createOrder, updateOrder, getOrder };
