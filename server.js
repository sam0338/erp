require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== DATABASE =====
// Where the live database (and its temp backup/restore files) live.
// Defaults to `backend/db` next to this file — fine for development and
// for running straight from source. The packaged Windows installer sets
// DB_DIR to a folder under %PROGRAMDATA% instead, so the data survives an
// uninstall/reinstall/upgrade cleanly rather than living inside Program
// Files (which a reinstall would wipe, and which needs admin rights to
// write to on some machines).
const dbDir = process.env.DB_DIR || path.join(__dirname, 'backend/db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const db = new Database(path.join(dbDir, 'sakaar-erp.db'));
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      department TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_code TEXT UNIQUE NOT NULL,
      vendor_name TEXT NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      country TEXT DEFAULT 'India',
      gst_number TEXT,
      pan_number TEXT,
      bank_name TEXT,
      bank_account TEXT,
      ifsc_code TEXT,
      payment_terms TEXT,
      credit_limit DECIMAL(12, 2) DEFAULT 0,
      rating DECIMAL(3, 1) DEFAULT 5,
      is_active BOOLEAN DEFAULT 1,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_code TEXT UNIQUE NOT NULL,
      material_name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      material_grade TEXT,
      unit_of_measure TEXT DEFAULT 'Kg',
      reorder_level DECIMAL(10, 2) DEFAULT 0,
      reorder_quantity DECIMAL(10, 2) DEFAULT 0,
      hsn_code TEXT,
      gst_rate DECIMAL(5, 2) DEFAULT 18,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE NOT NULL,
      vendor_id INTEGER NOT NULL,
      po_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expected_delivery_date DATE,
      delivery_date DATE,
      status TEXT DEFAULT 'Draft',
      total_amount DECIMAL(12, 2) DEFAULT 0,
      tax_amount DECIMAL(12, 2) DEFAULT 0,
      grand_total DECIMAL(12, 2) DEFAULT 0,
      notes TEXT,
      created_by INTEGER,
      approved_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      tax_rate DECIMAL(5, 2) DEFAULT 0,
      line_total DECIMAL(12, 2) NOT NULL,
      received_quantity DECIMAL(10, 2) DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE TABLE IF NOT EXISTS grn (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grn_number TEXT UNIQUE NOT NULL,
      po_id INTEGER NOT NULL,
      warehouse_id INTEGER,
      grn_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'Completed',
      total_amount DECIMAL(12, 2) DEFAULT 0,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS grn_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grn_id INTEGER NOT NULL,
      po_item_id INTEGER NOT NULL,
      received_quantity DECIMAL(10, 2) NOT NULL,
      rejected_quantity DECIMAL(10, 2) DEFAULT 0,
      batch_number TEXT,
      expiry_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (grn_id) REFERENCES grn(id) ON DELETE CASCADE,
      FOREIGN KEY (po_item_id) REFERENCES purchase_order_items(id)
    );

    CREATE TABLE IF NOT EXISTS grn_accounts_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grn_id INTEGER NOT NULL,
      submitted_by INTEGER NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'Submitted',
      acknowledged_by INTEGER,
      acknowledged_at DATETIME,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (grn_id) REFERENCES grn(id),
      FOREIGN KEY (submitted_by) REFERENCES users(id),
      FOREIGN KEY (acknowledged_by) REFERENCES users(id),
      UNIQUE(grn_id)
    );

    CREATE TABLE IF NOT EXISTS vendor_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      po_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      invoice_date DATE NOT NULL,
      due_date DATE,
      status TEXT DEFAULT 'Pending',
      total_amount DECIMAL(12, 2) NOT NULL,
      tax_amount DECIMAL(12, 2) DEFAULT 0,
      grand_total DECIMAL(12, 2) NOT NULL,
      paid_amount DECIMAL(12, 2) DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_code TEXT UNIQUE NOT NULL,
      warehouse_name TEXT NOT NULL,
      location TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      quantity DECIMAL(10, 2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      UNIQUE(material_id, warehouse_id)
    );

    -- Batch/lot/heat/coil/serial-level stock. stock_ledger stays as the
    -- fast aggregate total per material+warehouse (used everywhere that
    -- just needs "how much do we have"); this table is the traceable
    -- detail underneath it — one row per receipt, decremented as it's
    -- consumed, so you can always answer "which batch is this stock from"
    -- and "where did batch X end up".
    CREATE TABLE IF NOT EXISTS stock_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      batch_number TEXT,
      heat_number TEXT,
      coil_number TEXT,
      serial_number TEXT,
      quantity_received DECIMAL(10, 2) NOT NULL,
      quantity_remaining DECIMAL(10, 2) NOT NULL,
      unit_cost DECIMAL(10, 2),
      received_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expiry_date DATE,
      source TEXT, -- 'GRN', 'Stock In', 'Adjustment', 'Transfer In'
      source_reference TEXT, -- e.g. GRN number, adjustment number
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS stock_in (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_in_number TEXT UNIQUE NOT NULL,
      material_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL,
      unit_cost DECIMAL(10, 2),
      source TEXT,
      batch_number TEXT,
      expiry_date DATE,
      status TEXT DEFAULT 'Completed',
      received_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS stock_out (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_out_number TEXT UNIQUE NOT NULL,
      material_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL,
      purpose TEXT,
      issued_to TEXT,
      remarks TEXT,
      status TEXT DEFAULT 'Issued',
      issued_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS stock_transfer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_number TEXT UNIQUE NOT NULL,
      material_id INTEGER NOT NULL,
      from_warehouse_id INTEGER NOT NULL,
      to_warehouse_id INTEGER NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL,
      remarks TEXT,
      status TEXT DEFAULT 'In Transit',
      transfer_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      received_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS stock_adjustment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      adjustment_number TEXT UNIQUE NOT NULL,
      material_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      quantity_before DECIMAL(10, 2),
      quantity_after DECIMAL(10, 2),
      difference DECIMAL(10, 2),
      reason TEXT,
      status TEXT DEFAULT 'Pending',
      requested_by INTEGER,
      approved_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS indents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indent_number TEXT UNIQUE NOT NULL,
      indent_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      area_of_use TEXT NOT NULL,
      priority TEXT DEFAULT 'Normal',
      required_by_date DATE,
      justification TEXT,
      status TEXT DEFAULT 'Draft',
      requested_by INTEGER NOT NULL,
      approved_by INTEGER,
      approval_date DATETIME,
      approval_comments TEXT,
      assigned_to_purchaser INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (requested_by) REFERENCES users(id)
    );

    -- An indent can cover several materials at once — one Raise Indent
    -- form, one approval, one RFQ round, potentially one PO with several
    -- lines. material_type is per-item (not per-indent) since a single
    -- indent might mix Raw Material and Consumable lines.
    CREATE TABLE IF NOT EXISTS indent_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indent_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantity_required DECIMAL(10, 2) NOT NULL,
      unit_of_measure TEXT,
      material_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (indent_id) REFERENCES indents(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    -- A vendor's quotation is now one response covering every item on the
    -- indent (RFQ is maintained indent-wise, not item-wise) — total_price
    -- is a stored sum of its line items, kept in sync on insert, so
    -- sorting/comparing quotations by total doesn't need a join+aggregate
    -- every time.
    CREATE TABLE IF NOT EXISTS vendor_quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indent_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      quotation_number TEXT UNIQUE NOT NULL,
      quotation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
      delivery_time_days INTEGER,
      payment_terms TEXT,
      validity_days INTEGER DEFAULT 30,
      notes TEXT,
      status TEXT DEFAULT 'Submitted',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (indent_id) REFERENCES indents(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS vendor_quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      indent_item_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL,
      total_price DECIMAL(12, 2) NOT NULL,
      technical_specification TEXT,
      FOREIGN KEY (quotation_id) REFERENCES vendor_quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (indent_item_id) REFERENCES indent_items(id),
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE TABLE IF NOT EXISTS rate_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indent_id INTEGER NOT NULL,
      vendor_id_1 INTEGER, vendor_id_2 INTEGER, vendor_id_3 INTEGER,
      quotation_id_1 INTEGER, quotation_id_2 INTEGER, quotation_id_3 INTEGER,
      selected_vendor_id INTEGER,
      selected_quotation_id INTEGER,
      evaluation_comments TEXT,
      selection_criteria TEXT,
      evaluated_by INTEGER,
      evaluation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      po_generated_from_evaluation BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (indent_id) REFERENCES indents(id)
    );

    CREATE TABLE IF NOT EXISTS indent_po_mapping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indent_id INTEGER NOT NULL,
      po_id INTEGER NOT NULL,
      evaluation_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS production_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE NOT NULL,
      product_name TEXT NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL,
      unit_of_measure TEXT,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      priority TEXT DEFAULT 'Normal',
      status TEXT DEFAULT 'Draft',
      created_by INTEGER,
      approved_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS production_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT UNIQUE,
      product_name TEXT NOT NULL,
      output_quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
      output_unit TEXT DEFAULT 'Kg',
      process_notes TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS production_recipe_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      input_quantity DECIMAL(10, 2) NOT NULL,
      input_unit TEXT DEFAULT 'Kg',
      scrap_percent DECIMAL(5, 2) DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recipe_id) REFERENCES production_recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    -- Default/expected by-products for a BOM batch (e.g. "producing 100 Kg
    -- of strip also yields 5 Kg of slitting scrap coil"). Separate from the
    -- actual by-product captured on a Production Receipt, which is the
    -- real transactional quantity for one specific order.
    CREATE TABLE IF NOT EXISTS production_recipe_byproducts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
      unit TEXT DEFAULT 'Kg',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recipe_id) REFERENCES production_recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_number TEXT UNIQUE NOT NULL,
      production_order_id INTEGER NOT NULL,
      operation_number INTEGER,
      operation_name TEXT,
      assigned_to INTEGER,
      start_time DATETIME,
      end_time DATETIME,
      planned_hours DECIMAL(10, 2),
      actual_hours DECIMAL(10, 2),
      quantity_produced DECIMAL(10, 2) DEFAULT 0,
      defects DECIMAL(10, 2) DEFAULT 0,
      status TEXT DEFAULT 'Not Started',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (production_order_id) REFERENCES production_orders(id)
    );

    CREATE TABLE IF NOT EXISTS production_allocation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      allocation_number TEXT UNIQUE NOT NULL,
      production_order_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantity_allocated DECIMAL(10, 2) NOT NULL,
      warehouse_id INTEGER,
      allocation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      allocated_by INTEGER,
      status TEXT DEFAULT 'Allocated',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    -- Unused raw material handed back from the shop floor to store. Adds
    -- the quantity back to usable stock (as its own traceable batch) and
    -- reduces how much of that material's issue is treated as "consumed"
    -- for variance reporting.
    CREATE TABLE IF NOT EXISTS production_material_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT UNIQUE NOT NULL,
      production_order_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantity_returned DECIMAL(10, 2) NOT NULL,
      warehouse_id INTEGER NOT NULL,
      reason TEXT,
      returned_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );

    -- Work-in-progress movement log: one row per stage/operation handoff
    -- (e.g. "50 units moved from Slitting to Annealing"), so WIP quantity
    -- sitting at any given stage can always be reconstructed. Also the
    -- capture point for scrap/rework/rejection recorded at that stage,
    -- tagged with machine/shift/operator.
    CREATE TABLE IF NOT EXISTS production_wip_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wip_number TEXT UNIQUE NOT NULL,
      production_order_id INTEGER NOT NULL,
      work_order_id INTEGER,
      stage_name TEXT NOT NULL,
      sequence_no INTEGER,
      quantity_in DECIMAL(10, 2) DEFAULT 0,
      quantity_out DECIMAL(10, 2) DEFAULT 0,
      scrap_quantity DECIMAL(10, 2) DEFAULT 0,
      rework_quantity DECIMAL(10, 2) DEFAULT 0,
      rejection_quantity DECIMAL(10, 2) DEFAULT 0,
      by_product_quantity DECIMAL(10, 2) DEFAULT 0,
      machine_id INTEGER,
      shift TEXT,
      operator_id INTEGER,
      status TEXT DEFAULT 'In Progress',
      remarks TEXT,
      logged_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
      FOREIGN KEY (machine_id) REFERENCES machines(id),
      FOREIGN KEY (operator_id) REFERENCES employees(id)
    );

    -- Finished-goods receipt: closes the loop from BOM/routing/issue/WIP
    -- into actual usable stock. Posts output_quantity of the recipe's
    -- output_material_id into stock_ledger/stock_batches at receipt time,
    -- and separately records scrap/rework/rejection/by-product quantities
    -- for that receipt so variance reporting has real numbers to compare
    -- against the BOM's expected yield.
    CREATE TABLE IF NOT EXISTS production_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT UNIQUE NOT NULL,
      production_order_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      quantity_received DECIMAL(10, 2) NOT NULL DEFAULT 0,
      batch_number TEXT,
      scrap_quantity DECIMAL(10, 2) DEFAULT 0,
      rework_quantity DECIMAL(10, 2) DEFAULT 0,
      rejection_quantity DECIMAL(10, 2) DEFAULT 0,
      by_product_material_id INTEGER,
      by_product_quantity DECIMAL(10, 2) DEFAULT 0,
      is_final BOOLEAN DEFAULT 0,
      remarks TEXT,
      received_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY (by_product_material_id) REFERENCES materials(id)
    );

    -- ===== SALES & DISPATCH =====
    CREATE TABLE IF NOT EXISTS sales_quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      quotation_date DATE DEFAULT (date('now')),
      valid_until DATE,
      status TEXT DEFAULT 'Draft', -- Draft, Sent, Accepted, Rejected, Expired, Converted
      total_amount DECIMAL(12, 2) DEFAULT 0,
      tax_amount DECIMAL(12, 2) DEFAULT 0,
      grand_total DECIMAL(12, 2) DEFAULT 0,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS sales_quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL,
      unit_of_measure TEXT,
      unit_price DECIMAL(10, 2) DEFAULT 0,
      tax_rate DECIMAL(5, 2) DEFAULT 18,
      line_total DECIMAL(12, 2) DEFAULT 0,
      FOREIGN KEY (quotation_id) REFERENCES sales_quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    -- Order status tracking lives on the status column itself (Draft ->
    -- Confirmed -> Ready to Dispatch -> Partially Dispatched -> Dispatched
    -- -> Completed, or Cancelled at any point before full dispatch).
    CREATE TABLE IF NOT EXISTS sales_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      so_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      quotation_id INTEGER,
      order_date DATE DEFAULT (date('now')),
      expected_delivery_date DATE,
      status TEXT DEFAULT 'Draft',
      payment_term TEXT,
      transporter TEXT,
      destination TEXT,
      special_remarks TEXT,
      total_amount DECIMAL(12, 2) DEFAULT 0,
      tax_amount DECIMAL(12, 2) DEFAULT 0,
      grand_total DECIMAL(12, 2) DEFAULT 0,
      created_by INTEGER,
      approved_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (quotation_id) REFERENCES sales_quotations(id)
    );

    CREATE TABLE IF NOT EXISTS sales_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      so_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL,
      unit_of_measure TEXT,
      unit_price DECIMAL(10, 2) DEFAULT 0,
      tax_rate DECIMAL(5, 2) DEFAULT 18,
      line_total DECIMAL(12, 2) DEFAULT 0,
      dispatched_quantity DECIMAL(10, 2) DEFAULT 0,
      FOREIGN KEY (so_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    -- Dispatch planning: which SO items are intended to go out together,
    -- from which warehouse, on which date/vehicle — before the actual
    -- challan (which moves real stock) is cut.
    CREATE TABLE IF NOT EXISTS dispatch_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_number TEXT UNIQUE NOT NULL,
      so_id INTEGER NOT NULL,
      warehouse_id INTEGER,
      planned_date DATE,
      vehicle_number TEXT,
      transporter TEXT,
      status TEXT DEFAULT 'Planned', -- Planned, In Progress, Completed, Cancelled
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (so_id) REFERENCES sales_orders(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS dispatch_plan_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      so_item_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      planned_quantity DECIMAL(10, 2) NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES dispatch_plans(id) ON DELETE CASCADE,
      FOREIGN KEY (so_item_id) REFERENCES sales_order_items(id),
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    -- The actual dispatch note: cutting this deducts real, traceable stock
    -- (FIFO) and is what "Order to Dispatch" hangs off.
    CREATE TABLE IF NOT EXISTS delivery_challans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challan_number TEXT UNIQUE NOT NULL,
      so_id INTEGER NOT NULL,
      dispatch_plan_id INTEGER,
      warehouse_id INTEGER NOT NULL,
      challan_date DATE DEFAULT (date('now')),
      vehicle_number TEXT,
      transporter TEXT,
      driver_name TEXT,
      driver_phone TEXT,
      destination TEXT,
      eway_bill_number TEXT,
      status TEXT DEFAULT 'Dispatched', -- Dispatched, Delivered, Cancelled
      invoice_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (so_id) REFERENCES sales_orders(id),
      FOREIGN KEY (dispatch_plan_id) REFERENCES dispatch_plans(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS delivery_challan_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challan_id INTEGER NOT NULL,
      so_item_id INTEGER,
      material_id INTEGER NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL,
      unit_of_measure TEXT,
      batch_number TEXT,
      FOREIGN KEY (challan_id) REFERENCES delivery_challans(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    -- Packing list: package-wise breakdown of a challan (carton/bundle/coil
    -- count, weights), separate from the challan's material-wise lines.
    CREATE TABLE IF NOT EXISTS packing_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      packing_list_number TEXT UNIQUE NOT NULL,
      challan_id INTEGER NOT NULL,
      total_packages INTEGER DEFAULT 0,
      gross_weight DECIMAL(10, 2),
      net_weight DECIMAL(10, 2),
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (challan_id) REFERENCES delivery_challans(id)
    );

    CREATE TABLE IF NOT EXISTS packing_list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      packing_list_id INTEGER NOT NULL,
      package_no TEXT NOT NULL,
      material_id INTEGER,
      description TEXT,
      quantity DECIMAL(10, 2),
      weight DECIMAL(10, 2),
      dimensions TEXT,
      FOREIGN KEY (packing_list_id) REFERENCES packing_lists(id) ON DELETE CASCADE
    );

    -- Sales return: goods coming back from a customer. Accepting a line
    -- posts it back into usable/traceable stock (or a hold bucket if it
    -- needs inspection first).
    CREATE TABLE IF NOT EXISTS sales_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT UNIQUE NOT NULL,
      so_id INTEGER,
      customer_id INTEGER NOT NULL,
      challan_id INTEGER,
      return_date DATE DEFAULT (date('now')),
      warehouse_id INTEGER NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'Pending', -- Pending, Accepted, Rejected
      created_by INTEGER,
      decided_by INTEGER,
      decided_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (so_id) REFERENCES sales_orders(id),
      FOREIGN KEY (challan_id) REFERENCES delivery_challans(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS sales_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL,
      unit_of_measure TEXT,
      item_condition TEXT DEFAULT 'Good', -- Good, Damaged, Rework
      remarks TEXT,
      FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    -- Invoice reference capture: this app doesn't run a full accounting
    -- engine, so this is a lightweight record of "an invoice exists for
    -- this dispatch/order" (number, date, value, external reference to
    -- Tally/Busy/etc.) rather than a GST-compliant invoice generator.
    CREATE TABLE IF NOT EXISTS sales_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      so_id INTEGER,
      challan_id INTEGER,
      customer_id INTEGER NOT NULL,
      invoice_date DATE DEFAULT (date('now')),
      due_date DATE,
      taxable_value DECIMAL(12, 2) DEFAULT 0,
      tax_amount DECIMAL(12, 2) DEFAULT 0,
      cgst_total DECIMAL(12, 2) DEFAULT 0,
      sgst_total DECIMAL(12, 2) DEFAULT 0,
      igst_total DECIMAL(12, 2) DEFAULT 0,
      is_interstate INTEGER DEFAULT 0,
      place_of_supply TEXT,
      grand_total DECIMAL(12, 2) DEFAULT 0,
      paid_amount DECIMAL(12, 2) DEFAULT 0,
      status TEXT DEFAULT 'Pending', -- Pending, Partially Paid, Paid, Overdue
      external_reference TEXT, -- e.g. Tally/Busy voucher number
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (so_id) REFERENCES sales_orders(id),
      FOREIGN KEY (challan_id) REFERENCES delivery_challans(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    -- Real invoice line items — a single GST invoice can consolidate
    -- dispatched quantities from several different Sales Orders / delivery
    -- challans for the same customer. Each line keeps its own SO/challan
    -- reference so the printed invoice can show exactly which order it
    -- belongs to (avoids the "what is this line for" confusion), and its
    -- own HSN/tax rate/GST split so mixed-rate invoices compute correctly.
    CREATE TABLE IF NOT EXISTS sales_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      so_id INTEGER,
      so_item_id INTEGER,
      challan_id INTEGER,
      material_id INTEGER,
      description TEXT NOT NULL,
      hsn_code TEXT,
      quantity DECIMAL(10, 3) NOT NULL DEFAULT 0,
      unit_of_measure TEXT,
      unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
      tax_rate DECIMAL(5, 2) DEFAULT 0,
      taxable_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
      cgst_amount DECIMAL(12, 2) DEFAULT 0,
      sgst_amount DECIMAL(12, 2) DEFAULT 0,
      igst_amount DECIMAL(12, 2) DEFAULT 0,
      line_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (so_id) REFERENCES sales_orders(id),
      FOREIGN KEY (so_item_id) REFERENCES sales_order_items(id),
      FOREIGN KEY (challan_id) REFERENCES delivery_challans(id),
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    -- ===== FINANCE & COMMERCIAL CONTROLS =====
    -- Generic expense capture — not tied to a PO/vendor invoice (rent,
    -- utilities, freight, professional fees, etc.), with GST-ready fields
    -- so it can feed both the payables view and the GST summary.
    CREATE TABLE IF NOT EXISTS expense_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_number TEXT UNIQUE NOT NULL,
      expense_date DATE DEFAULT (date('now')),
      category TEXT NOT NULL,
      vendor_id INTEGER,
      department TEXT,
      taxable_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(12, 2) DEFAULT 0,
      grand_total DECIMAL(12, 2) DEFAULT 0,
      paid_amount DECIMAL(12, 2) DEFAULT 0,
      hsn_sac_code TEXT,
      gst_class TEXT,
      paid_through TEXT,
      payment_reference TEXT,
      status TEXT DEFAULT 'Recorded', -- Recorded, Partially Paid, Paid
      remarks TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    -- Mirrors payment_vouchers (which is the AP/vendor side) for the AR/
    -- customer side, so receivables have the same auditable payment trail
    -- vendor payables already have.
    CREATE TABLE IF NOT EXISTS customer_payment_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT UNIQUE NOT NULL,
      invoice_id INTEGER NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      receipt_date DATE DEFAULT (date('now')),
      payment_mode TEXT,
      reference_number TEXT,
      remarks TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id)
    );

    -- Integration staging for Tally/Busy/external accounting software.
    -- This app doesn't talk to Tally/Busy directly — it stages a clean,
    -- flat voucher row per transaction (Purchase/Sales/Payment/Receipt/
    -- Expense) that's ready to export (CSV today; a native XML/API push
    -- is a natural next step) and re-import on the accounting side.
    CREATE TABLE IF NOT EXISTS accounting_staging (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staging_number TEXT UNIQUE NOT NULL,
      voucher_type TEXT NOT NULL, -- Purchase, Sales, Payment, Receipt, Expense
      voucher_date DATE NOT NULL,
      reference_number TEXT,
      party_type TEXT, -- Vendor, Customer, Other
      party_name TEXT,
      taxable_value DECIMAL(12, 2) DEFAULT 0,
      tax_amount DECIMAL(12, 2) DEFAULT 0,
      grand_total DECIMAL(12, 2) DEFAULT 0,
      narration TEXT,
      source_table TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      export_status TEXT DEFAULT 'Pending', -- Pending, Exported
      exported_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_table, source_id)
    );

    -- ===== EMPLOYEE ADVANCE & EXPENSE CLAIMS =====
    -- Covers travel advances and expense bills (customer visits, complaint
    -- visits, fuel/commute, tours, etc). Snapshots employee_name/department
    -- /manager at submission time so the record stays accurate for history
    -- even if the employee later changes department or reporting manager.
    -- Flow: Employee submits -> Reporting Manager approves/rejects ->
    -- Accounts/Finance settles (payment/adjustment).
    CREATE TABLE IF NOT EXISTS expense_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_number TEXT UNIQUE NOT NULL,
      claim_type TEXT NOT NULL, -- 'Advance' or 'Expense Bill'
      category TEXT NOT NULL, -- Customer Visit, Complaint Visit, Tour, Fuel/Commute, Travel, Other
      purpose TEXT,
      customer_id INTEGER,
      from_date DATE,
      to_date DATE,
      amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      linked_advance_claim_id INTEGER, -- an Expense Bill can adjust against a prior Advance
      employee_id INTEGER NOT NULL,
      employee_name TEXT NOT NULL,
      department TEXT,
      manager_id INTEGER,
      manager_name TEXT,
      status TEXT DEFAULT 'Pending Approval', -- Pending Approval, Approved, Rejected, Settled
      manager_action_by INTEGER,
      manager_action_at DATETIME,
      manager_comments TEXT,
      settled_by INTEGER,
      settled_at DATETIME,
      settlement_reference TEXT,
      settlement_mode TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES users(id),
      FOREIGN KEY (manager_id) REFERENCES users(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (linked_advance_claim_id) REFERENCES expense_claims(id)
    );

    -- Itemized lines for an Expense Bill (e.g. "11-Jul Fuel Rs.500",
    -- "11-Jul Toll Rs.100"). An Advance claim typically has no items — it's
    -- a single lump-sum request — but items are supported either way.
    CREATE TABLE IF NOT EXISTS expense_claim_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_id INTEGER NOT NULL,
      item_date DATE,
      category TEXT,
      description TEXT,
      amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
      FOREIGN KEY (claim_id) REFERENCES expense_claims(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ===== INCOMING QUALITY CONTROL =====
    -- Stock received via GRN lands here first (NOT in stock_ledger), so it
    -- can't be issued/used until QC clears it.
    CREATE TABLE IF NOT EXISTS qc_pending_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      quantity DECIMAL(10, 2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      UNIQUE(material_id, warehouse_id)
    );

    -- Quantity inspected and put on hold (needs rework/CAPA disposition
    -- before it can become usable stock or be written off as rejected).
    CREATE TABLE IF NOT EXISTS qc_hold_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      quantity DECIMAL(10, 2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      UNIQUE(material_id, warehouse_id)
    );

    -- One row per GRN line item, tracking how the received quantity was
    -- ultimately disposed: passed / on hold / rejected.
    CREATE TABLE IF NOT EXISTS quality_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_number TEXT UNIQUE NOT NULL,
      grn_id INTEGER NOT NULL,
      grn_item_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      quantity_received DECIMAL(10, 2) NOT NULL,
      quantity_passed DECIMAL(10, 2) DEFAULT 0,
      quantity_hold DECIMAL(10, 2) DEFAULT 0,
      quantity_rejected DECIMAL(10, 2) DEFAULT 0,
      status TEXT DEFAULT 'Pending', -- Pending, Partial, Completed
      remarks TEXT,
      inspected_by INTEGER,
      inspection_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (grn_id) REFERENCES grn(id),
      FOREIGN KEY (grn_item_id) REFERENCES grn_items(id),
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );
  `);

  db.exec(`
    -- ===== LICENSING =====
    -- Single-row table holding the currently activated license. The key
    -- itself is a signed token (see verifyLicenseKey in server.js) — this
    -- table just caches its parsed, verified contents so every request
    -- doesn't need to re-verify the signature.
    CREATE TABLE IF NOT EXISTS license_info (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      license_key TEXT,
      licensed_to TEXT,
      issued_date DATE,
      valid_until DATE,
      max_users INTEGER,
      status TEXT DEFAULT 'Not Activated',
      activated_at DATETIME
    );

    -- ===== BACKUP: SCHEDULE + CLOUD CONNECTION =====
    CREATE TABLE IF NOT EXISTS backup_schedule (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER DEFAULT 0,
      time_of_day TEXT DEFAULT '02:00',
      destination TEXT DEFAULT 'local',
      local_path TEXT,
      last_run_at DATETIME,
      last_run_status TEXT,
      last_run_message TEXT
    );

    -- Google Drive OAuth connection. client_id/client_secret come from the
    -- business owner's own Google Cloud project (this app can't provision
    -- one on their behalf) — entered once in System Settings; the refresh
    -- token is captured after they complete the consent screen.
    CREATE TABLE IF NOT EXISTS google_drive_connection (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      client_id TEXT,
      client_secret TEXT,
      refresh_token TEXT,
      connected_email TEXT,
      folder_id TEXT,
      connected_at DATETIME
    );
  `);

  db.exec(`
    -- ===== COMPANY BRANDING (used on PO/GRN print headers) =====
    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      company_name TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      gstin TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      logo_data_url TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ===== APPROVAL HIERARCHY =====
    -- How many sequential approval levels an Indent needs before it's final.
    CREATE TABLE IF NOT EXISTS approval_settings (
      module TEXT PRIMARY KEY,
      levels_required INTEGER NOT NULL DEFAULT 1
    );

    -- Value-based approval hierarchy for POs: which grand_total range needs
    -- how many sequential levels of approval.
    CREATE TABLE IF NOT EXISTS approval_matrix (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      min_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      max_amount DECIMAL(12, 2),
      required_level INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit trail of every approval/rejection at every level, for both
    -- indents and POs.
    CREATE TABLE IF NOT EXISTS approval_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL, -- 'indent' or 'po'
      record_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      action TEXT NOT NULL, -- 'Approved' or 'Rejected'
      approved_by INTEGER,
      comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    -- ===== VENDOR PAYMENT VOUCHERS =====
    CREATE TABLE IF NOT EXISTS payment_vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_number TEXT UNIQUE NOT NULL,
      invoice_id INTEGER NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_mode TEXT NOT NULL,
      reference_number TEXT,
      remarks TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES vendor_invoices(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- ===== BRANCHES =====
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_code TEXT UNIQUE NOT NULL,
      branch_name TEXT NOT NULL,
      address TEXT, city TEXT, state TEXT, postal_code TEXT,
      gstin TEXT, phone TEXT, email TEXT,
      is_head_office INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ===== FINANCIAL YEAR & PERIOD LOCKING =====
    CREATE TABLE IF NOT EXISTS financial_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fy_label TEXT UNIQUE NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      is_current INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS period_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      financial_year_id INTEGER NOT NULL,
      period_label TEXT NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      is_locked INTEGER DEFAULT 0,
      locked_by INTEGER,
      locked_at DATETIME,
      FOREIGN KEY (financial_year_id) REFERENCES financial_years(id),
      FOREIGN KEY (locked_by) REFERENCES users(id)
    );

    -- ===== NOTIFICATION TEMPLATES =====
    -- Message content for key events (PO approval needed, GRN submitted,
    -- low stock, etc). NOTE: this only stores the template text — there is
    -- no email/SMS sending configured in this app, so nothing is actually
    -- dispatched automatically yet. See CHANGES.md for what this does and
    -- doesn't do.
    CREATE TABLE IF NOT EXISTS notification_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ===== MASTER DATA MANAGEMENT =====

    -- One shared table for every "simple" master (just a code + name +
    -- a little type-specific extra data): item groups, grades, UOM,
    -- payment terms, transporters, dispatch modes, departments, shifts,
    -- and reason codes. Cuts down on having 9 nearly-identical tables.
    CREATE TABLE IF NOT EXISTS simple_masters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      master_type TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      extra TEXT, -- JSON blob for type-specific fields (e.g. shift start/end time, reason code category, payment term days)
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(master_type, code)
    );

    -- Unit of Measure conversions (e.g. 1 Box = 12 Pcs), referencing UOM
    -- codes stored in simple_masters (master_type = 'uom').
    CREATE TABLE IF NOT EXISTS uom_conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_uom TEXT NOT NULL,
      to_uom TEXT NOT NULL,
      conversion_factor DECIMAL(12, 6) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(from_uom, to_uom)
    );

    CREATE TABLE IF NOT EXISTS work_centers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wc_code TEXT UNIQUE NOT NULL,
      wc_name TEXT NOT NULL,
      department TEXT,
      capacity_per_day DECIMAL(10, 2),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_code TEXT UNIQUE NOT NULL,
      machine_name TEXT NOT NULL,
      work_center_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_center_id) REFERENCES work_centers(id)
    );

    -- Rack/bin locations within an existing warehouse.
    CREATE TABLE IF NOT EXISTS warehouse_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL,
      location_code TEXT NOT NULL,
      rack TEXT,
      bin TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      UNIQUE(warehouse_id, location_code)
    );

    -- Customer master (standalone for now — no sales module consumes this
    -- yet, but it's ready for one, same shape as the vendor master).
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_code TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      contact_person TEXT, email TEXT, phone TEXT,
      address TEXT, city TEXT, state TEXT, postal_code TEXT,
      gst_number TEXT, credit_limit DECIMAL(12, 2) DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tax_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tax_name TEXT NOT NULL,
      rate DECIMAL(5, 2) NOT NULL,
      hsn_sac_code TEXT,
      gst_class TEXT, -- e.g. 'Goods', 'Services', 'Exempt', 'Nil-rated'
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_code TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      department TEXT,
      designation TEXT,
      shift TEXT,
      date_of_joining DATE,
      phone TEXT, email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Routing master: the sequence of operations (each at a work center)
    -- to produce something, distinct from the BOM (which is materials in/
    -- out) — this is the process steps. Optionally tied to a recipe.
    CREATE TABLE IF NOT EXISTS routing_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routing_name TEXT NOT NULL,
      recipe_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recipe_id) REFERENCES production_recipes(id)
    );

    CREATE TABLE IF NOT EXISTS routing_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routing_id INTEGER NOT NULL,
      sequence_no INTEGER NOT NULL,
      operation_name TEXT NOT NULL,
      work_center_id INTEGER,
      standard_time_minutes DECIMAL(10, 2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (routing_id) REFERENCES routing_master(id) ON DELETE CASCADE,
      FOREIGN KEY (work_center_id) REFERENCES work_centers(id)
    );

    -- ===== DOCUMENT NUMBERING =====
    -- Backs nextSerial(): one row per entity type, tracking the next number
    -- to hand out. Using a table (rather than counting existing rows) means
    -- numbers stay sequential and gap-free even if a record is later deleted.
    CREATE TABLE IF NOT EXISTS sequences (
      entity TEXT PRIMARY KEY,
      prefix TEXT NOT NULL,
      pad_length INTEGER NOT NULL DEFAULT 4,
      next_number INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS po_change_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL,
      requested_by INTEGER NOT NULL,
      request_type TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'Pending',
      approved_by INTEGER,
      decision_comments TEXT,
      decided_at DATETIME,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (requested_by) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );
  `);

  // Lightweight migration: add columns that older databases created before
  // this feature existed won't have yet, without dropping any data.
  const ensureColumn = (table, column, definition) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };
  // Lets specific materials skip QC (e.g. consumables) and go straight to
  // usable stock on receipt, same as before this feature existed.
  ensureColumn('materials', 'qc_required', 'INTEGER DEFAULT 1');
  // Dedicated approval timestamp so the GRN traceability print can show
  // exactly when the PO was approved, independent of updated_at (which
  // gets overwritten by later, unrelated status changes).
  ensureColumn('purchase_orders', 'approved_at', 'DATETIME');
  // Multi-level approval hierarchy support.
  ensureColumn('users', 'approval_level', 'INTEGER DEFAULT 1');
  ensureColumn('users', 'approver_id', 'INTEGER');
  ensureColumn('users', 'module_permissions', 'TEXT');
  ensureColumn('indents', 'current_level', 'INTEGER DEFAULT 0');
  ensureColumn('indents', 'required_level', 'INTEGER DEFAULT 1');

  // ===== Round 27: indents -> multi-item (indent_items) migration =====
  // An install that's already running has an `indents` table in the OLD
  // single-material shape (material_id/quantity_required/unit_of_measure/
  // material_type directly on the row). CREATE TABLE IF NOT EXISTS above
  // does nothing for a table that already exists, so without this, the
  // old columns would just sit there unused while new code tries to
  // insert into indent_items instead — actual indent data would be
  // silently orphaned. This carries every existing indent's single item
  // into indent_items first, then drops the now-obsolete columns.
  const indentCols = db.prepare('PRAGMA table_info(indents)').all();
  if (indentCols.some(c => c.name === 'material_id')) {
    const oldIndents = db.prepare('SELECT * FROM indents').all();
    const insertItem = db.prepare('INSERT INTO indent_items (indent_id, material_id, quantity_required, unit_of_measure, material_type) VALUES (?, ?, ?, ?, ?)');
    for (const ind of oldIndents) {
      if (ind.material_id) {
        insertItem.run(ind.id, ind.material_id, ind.quantity_required, ind.unit_of_measure, ind.material_type || 'Raw Material');
      }
    }
    db.exec('ALTER TABLE indents DROP COLUMN material_id');
    db.exec('ALTER TABLE indents DROP COLUMN quantity_required');
    db.exec('ALTER TABLE indents DROP COLUMN unit_of_measure');
    db.exec('ALTER TABLE indents DROP COLUMN material_type');
    console.log(`[migration] Migrated ${oldIndents.length} existing indent(s) to the new multi-item structure.`);
  }

  // Same idea for vendor_quotations: an existing quotation had exactly
  // one price for the indent's one material — carried into
  // vendor_quotation_items against that same indent's (now migrated)
  // single indent_item row, before the old header-level pricing columns
  // are dropped.
  const vqCols = db.prepare('PRAGMA table_info(vendor_quotations)').all();
  if (vqCols.some(c => c.name === 'unit_price')) {
    const oldQuotations = db.prepare('SELECT * FROM vendor_quotations').all();
    const insertQItem = db.prepare('INSERT INTO vendor_quotation_items (quotation_id, indent_item_id, material_id, unit_price, quantity, total_price, technical_specification) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const q of oldQuotations) {
      const item = db.prepare('SELECT * FROM indent_items WHERE indent_id = ? LIMIT 1').get(q.indent_id);
      if (item) {
        insertQItem.run(q.id, item.id, item.material_id, q.unit_price, item.quantity_required, q.total_price, q.technical_specification || null);
      }
    }
    db.exec('ALTER TABLE vendor_quotations DROP COLUMN unit_price');
    db.exec('ALTER TABLE vendor_quotations DROP COLUMN technical_specification');
    console.log(`[migration] Migrated ${oldQuotations.length} existing vendor quotation(s) to per-item pricing.`);
  }

  ensureColumn('purchase_orders', 'current_level', 'INTEGER DEFAULT 0');
  ensureColumn('purchase_orders', 'required_level', 'INTEGER DEFAULT 1');
  // Commercial terms + special remarks, printed on the PO (per the Work
  // Order format the user wants matched).
  ensureColumn('purchase_orders', 'category', 'TEXT');
  ensureColumn('purchase_orders', 'our_rates', 'TEXT');
  ensureColumn('purchase_orders', 'inspection_terms', 'TEXT');
  ensureColumn('purchase_orders', 'packing_forwarding', 'TEXT');
  ensureColumn('purchase_orders', 'payment_term', 'TEXT');
  ensureColumn('purchase_orders', 'insurance', 'TEXT');
  ensureColumn('purchase_orders', 'freight', 'TEXT');
  ensureColumn('purchase_orders', 'destination', 'TEXT');
  ensureColumn('purchase_orders', 'transporter', 'TEXT');
  ensureColumn('purchase_orders', 'special_remarks', 'TEXT');
  // Batch/lot/heat/coil/serial tracking at the point of receipt.
  ensureColumn('grn_items', 'heat_number', 'TEXT');
  ensureColumn('grn_items', 'coil_number', 'TEXT');
  ensureColumn('grn_items', 'serial_number', 'TEXT');
  ensureColumn('stock_in', 'heat_number', 'TEXT');
  ensureColumn('stock_in', 'coil_number', 'TEXT');
  ensureColumn('stock_in', 'serial_number', 'TEXT');
  // Max stock level, alongside the existing reorder_level (min).
  ensureColumn('materials', 'max_stock_level', 'DECIMAL(10, 2)');
  // Carries which batches were consumed at transfer-out time, so
  // receiving the transfer can recreate the same batches (with their
  // original heat/coil/serial identifiers) in the destination warehouse.
  ensureColumn('stock_transfer', 'batch_details', 'TEXT');
  // Migration: sequences existed before prefix/pad_length were added to it.
  // Backfill any old rows (which only had entity + next_number) with
  // sensible defaults so nextSerial() doesn't break on upgrade.
  ensureColumn('sequences', 'prefix', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('sequences', 'pad_length', 'INTEGER NOT NULL DEFAULT 4');
  const blankPrefixSeqs = db.prepare("SELECT entity FROM sequences WHERE prefix = ''").all();
  for (const { entity } of blankPrefixSeqs) {
    const def = DEFAULT_SEQUENCES[entity] || { prefix: entity.toUpperCase().slice(0, 3), pad: 4 };
    db.prepare('UPDATE sequences SET prefix = ?, pad_length = ? WHERE entity = ?').run(def.prefix, def.pad, entity);
  }
  for (const [entity, def] of Object.entries(DEFAULT_SEQUENCES)) {
    db.prepare('INSERT OR IGNORE INTO sequences (entity, prefix, pad_length, next_number) VALUES (?, ?, ?, 1)').run(entity, def.prefix, def.pad);
  }
  ensureColumn('production_orders', 'recipe_id', 'INTEGER');
  ensureColumn('production_orders', 'expected_input_quantity', 'DECIMAL(10, 2) DEFAULT 0');
  ensureColumn('production_orders', 'expected_output_quantity', 'DECIMAL(10, 2) DEFAULT 0');
  // ===== Round 15: Production Planning & Execution =====
  // Lets a material record represent a finished/semi-finished good (not just
  // a purchased raw material), so a BOM's output can post real stock.
  ensureColumn('materials', 'item_type', "TEXT DEFAULT 'Raw Material'");
  // Alternate BOM support: an alternate recipe shares the same product but
  // is a different formulation (e.g. substitute material, different route).
  // primary_recipe_id groups alternates under the original recipe; NULL on
  // the primary itself. Also links the recipe's finished-good output to a
  // real materials row (for FG receipt) and an optional default routing.
  ensureColumn('production_recipes', 'output_material_id', 'INTEGER');
  ensureColumn('production_recipes', 'is_alternate', 'INTEGER DEFAULT 0');
  ensureColumn('production_recipes', 'primary_recipe_id', 'INTEGER');
  ensureColumn('production_recipes', 'routing_id', 'INTEGER');
  ensureColumn('production_recipes', 'alternate_label', 'TEXT');
  // ===== Round 17: BOM entry redesign + weight-based yield + ATP =====
  // Short code shown alongside the BOM name (matches the "Alias" field on
  // the reference BOM-entry screen the user shared).
  ensureColumn('production_recipes', 'alias', 'TEXT');
  // RM is always tracked in Kg, but the finished item can be sold/counted
  // in Nos/Mtr/CBM/Kg. This is the Kg-equivalent of ONE output_unit, so
  // total output weight (output_quantity * weight_per_output_unit) can
  // always be compared against RM consumed in Kg regardless of what unit
  // the finished item is counted in. Defaults to 1 (i.e. output IS Kg).
  ensureColumn('production_recipes', 'weight_per_output_unit', 'DECIMAL(10,4) DEFAULT 1');
  ensureColumn('production_recipes', 'expenses_per_unit', 'DECIMAL(10,2) DEFAULT 0');
  ensureColumn('production_recipes', 'default_machine_id', 'INTEGER');
  ensureColumn('production_orders', 'expected_output_weight_kg', 'DECIMAL(12,2)');
  // ===== Round 21: proper multi-order GST invoicing =====
  // How much of this dispatched line has already been pulled onto an
  // invoice — lets "what's billable right now" be computed as
  // dispatched_quantity - invoiced_quantity per line, so the same
  // delivered goods can never be invoiced twice even when a customer's
  // invoice consolidates lines from several different orders.
  ensureColumn('sales_order_items', 'invoiced_quantity', 'DECIMAL(10,2) DEFAULT 0');
  // ===== Round 24: POS / Trading Edition =====
  ensureColumn('materials', 'barcode', 'TEXT');
  ensureColumn('materials', 'default_sale_price', 'DECIMAL(10,2) DEFAULT 0');
  // A POS sale skips Sales Order -> Dispatch -> Invoice entirely (too many
  // steps for a shop counter) and creates the invoice directly — `channel`
  // tells the two apart in reporting without needing a separate table.
  ensureColumn('sales_invoices', 'channel', "TEXT DEFAULT 'Sales Order'");
  ensureColumn('sales_invoices', 'payment_mode', 'TEXT');
  ensureColumn('sales_invoices', 'discount_amount', 'DECIMAL(12,2) DEFAULT 0');
  ensureColumn('sales_invoice_items', 'discount_amount', 'DECIMAL(10,2) DEFAULT 0');
  ensureColumn('sales_invoices', 'warehouse_id', 'INTEGER');
  // ===== Round 26: POS bill history + customer mobile capture =====
  // Independent of customer_id — captures a phone number on ANY sale
  // (registered customer or Walk-in) without forcing a full customer
  // record to be created just to ring someone up. Useful on its own for
  // SMS/WhatsApp follow-ups and repeat-customer lookups even when nobody
  // bothered picking a customer from the dropdown.
  ensureColumn('sales_invoices', 'customer_mobile', 'TEXT');
  // Scheduling + shop-floor tagging on the production order itself.
  ensureColumn('production_orders', 'routing_id', 'INTEGER');
  ensureColumn('production_orders', 'machine_id', 'INTEGER');
  ensureColumn('production_orders', 'shift', 'TEXT');
  ensureColumn('production_orders', 'operator_id', 'INTEGER');
  ensureColumn('production_orders', 'source_warehouse_id', 'INTEGER');
  ensureColumn('production_orders', 'output_warehouse_id', 'INTEGER');
  ensureColumn('production_orders', 'actual_input_quantity', 'DECIMAL(10, 2) DEFAULT 0');
  ensureColumn('production_orders', 'actual_output_quantity', 'DECIMAL(10, 2) DEFAULT 0');
  ensureColumn('production_orders', 'total_scrap_quantity', 'DECIMAL(10, 2) DEFAULT 0');
  ensureColumn('production_orders', 'total_rejection_quantity', 'DECIMAL(10, 2) DEFAULT 0');
  // Machine/shift/operator tagging at the individual operation level too.
  ensureColumn('work_orders', 'machine_id', 'INTEGER');
  ensureColumn('work_orders', 'shift', 'TEXT');
  ensureColumn('work_orders', 'operator_id', 'INTEGER');
  ensureColumn('work_orders', 'routing_step_id', 'INTEGER');
  ensureColumn('work_orders', 'scrap_quantity', 'DECIMAL(10, 2) DEFAULT 0');
  ensureColumn('work_orders', 'rework_quantity', 'DECIMAL(10, 2) DEFAULT 0');
  ensureColumn('work_orders', 'rejection_quantity', 'DECIMAL(10, 2) DEFAULT 0');

  // Seed company letterhead (blank placeholders — admin fills these in via
  // the Company Settings screen).
  const companyExists = db.prepare('SELECT COUNT(*) as count FROM company_settings WHERE id = 1').get();
  if (companyExists.count === 0) {
    db.prepare(
      'INSERT INTO company_settings (id, company_name, address, gstin, phone, email) VALUES (1, ?, ?, ?, ?, ?)'
    ).run('Your Company Name', 'Company Address', '', '', '');
  }

  // Seed default approval requirements: 1 level for indents, and a single
  // catch-all PO matrix row so nothing is blocked until an admin actually
  // configures a real hierarchy.
  const indentApprovalExists = db.prepare("SELECT COUNT(*) as count FROM approval_settings WHERE module = 'indent'").get();
  if (indentApprovalExists.count === 0) {
    db.prepare("INSERT INTO approval_settings (module, levels_required) VALUES ('indent', 1)").run();
  }
  const poMatrixExists = db.prepare("SELECT COUNT(*) as count FROM approval_matrix WHERE module = 'po'").get();
  if (poMatrixExists.count === 0) {
    db.prepare("INSERT INTO approval_matrix (module, min_amount, max_amount, required_level) VALUES ('po', 0, NULL, 1)").run();
  }

  // Seed default admin
  const adminExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get('admin');
  if (adminExists.count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      'INSERT INTO users (username, email, password, full_name, role, department) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('admin', 'admin@erp.com', hash, 'System Administrator', 'admin', 'Management');
    console.log('✅ Default admin created (admin / admin123)');
  }

  // Seed default warehouse
  const whExists = db.prepare('SELECT COUNT(*) as count FROM warehouses WHERE warehouse_code = ?').get('WH001');
  if (whExists.count === 0) {
    db.prepare('INSERT INTO warehouses (warehouse_code, warehouse_name, location) VALUES (?, ?, ?)')
      .run('WH001', 'Main Warehouse', 'Factory');
  }

  // Seed a default Head Office branch
  const branchExists = db.prepare('SELECT COUNT(*) as count FROM branches').get();
  if (branchExists.count === 0) {
    db.prepare('INSERT INTO branches (branch_code, branch_name, is_head_office) VALUES (?, ?, 1)').run('HO', 'Head Office');
  }

  // Seed the current financial year (Apr-Mar, standard for India) with its
  // 12 monthly periods, all unlocked, if none exists yet.
  const fyExists = db.prepare('SELECT COUNT(*) as count FROM financial_years').get();
  if (fyExists.count === 0) {
    const today = new Date();
    const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1; // April = month index 3
    const fyLabel = `${fyStartYear}-${String(fyStartYear + 1).slice(2)}`;
    const startDate = `${fyStartYear}-04-01`;
    const endDate = `${fyStartYear + 1}-03-31`;
    const fyResult = db.prepare('INSERT INTO financial_years (fy_label, start_date, end_date, is_current) VALUES (?, ?, ?, 1)').run(fyLabel, startDate, endDate);
    const fyId = fyResult.lastInsertRowid;

    const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const insertPeriod = db.prepare('INSERT INTO period_locks (financial_year_id, period_label, period_start, period_end, is_locked) VALUES (?, ?, ?, ?, 0)');
    for (let i = 0; i < 12; i++) {
      const monthOffset = (3 + i) % 12; // starts at April (index 3)
      const year = i < 9 ? fyStartYear : fyStartYear + 1;
      const periodStart = new Date(year, monthOffset, 1);
      const periodEnd = new Date(year, monthOffset + 1, 0);
      const label = `${monthNames[i]}-${year}`;
      insertPeriod.run(fyId, label, periodStart.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0]);
    }
  }

  // Seed a few starter notification templates (content only — see the
  // schema comment above; nothing sends these automatically yet).
  const templateExists = db.prepare('SELECT COUNT(*) as count FROM notification_templates').get();
  if (templateExists.count === 0) {
    const templates = [
      ['po_pending_approval', 'PO Pending Approval', 'Purchase Order {po_number} needs your approval', 'Hi {approver_name},\n\nPurchase Order {po_number} for {vendor_name} (₹{grand_total}) is awaiting your approval at Level {level}.\n\nPlease review it in the ERP portal.'],
      ['grn_submitted_to_accounts', 'GRN Submitted to Accounts', 'GRN {grn_number} submitted for payment processing', 'Hi Accounts Team,\n\nGRN {grn_number} against PO {po_number} ({vendor_name}, ₹{total_amount}) has been submitted and is awaiting daily acknowledgment.'],
      ['low_stock_alert', 'Low Stock Alert', '{material_name} is below reorder level', 'Stock for {material_name} has dropped to {current_quantity} {unit}, below the reorder level of {reorder_level} {unit}. Consider raising an indent.'],
      ['indent_approved', 'Indent Approved', 'Your indent {indent_number} has been approved', 'Hi {requester_name},\n\nYour indent {indent_number} has been approved and will proceed to RFQ.'],
      ['payment_voucher_recorded', 'Payment Recorded', 'Payment recorded against invoice {invoice_number}', 'A payment of ₹{amount} has been recorded against invoice {invoice_number} ({vendor_name}) via {payment_mode}.']
    ];
    const insertTemplate = db.prepare('INSERT INTO notification_templates (template_key, title, subject, body) VALUES (?, ?, ?, ?)');
    for (const [key, title, subject, body] of templates) insertTemplate.run(key, title, subject, body);
  }

  // Seed a handful of starter rows for the simple masters, so the Master
  // Data screens have something in them from day one instead of being
  // blank. All editable/deletable afterward.
  const simpleMasterExists = db.prepare('SELECT COUNT(*) as count FROM simple_masters').get();
  if (simpleMasterExists.count === 0) {
    const insertSimple = db.prepare('INSERT INTO simple_masters (master_type, code, name, extra) VALUES (?, ?, ?, ?)');
    const seedRows = [
      ['item_group', 'RM', 'Raw Material', null],
      ['item_group', 'FG', 'Finished Goods', null],
      ['item_group', 'CONS', 'Consumables', null],
      ['grade', '304', 'SS 304', null],
      ['grade', '316', 'SS 316', null],
      ['grade', 'MS', 'Mild Steel', null],
      ['uom', 'KG', 'Kilogram', null],
      ['uom', 'NOS', 'Numbers', null],
      ['uom', 'MTR', 'Meter', null],
      ['uom', 'LTR', 'Litre', null],
      ['payment_term', 'NET30', 'Net 30 Days', JSON.stringify({ days: 30 })],
      ['payment_term', 'ADV100', '100% Advance', JSON.stringify({ days: 0 })],
      ['transporter', 'ANY', 'Any Reliable Transporter', null],
      ['dispatch_mode', 'ROAD', 'By Road', null],
      ['dispatch_mode', 'RAIL', 'By Rail', null],
      ['department', 'PROD', 'Production', null],
      ['department', 'QC', 'Quality Control', null],
      ['department', 'STORE', 'Stores', null],
      ['department', 'ACCT', 'Accounts', null],
      ['shift', 'A', 'Shift A (6am-2pm)', JSON.stringify({ start_time: '06:00', end_time: '14:00' })],
      ['shift', 'B', 'Shift B (2pm-10pm)', JSON.stringify({ start_time: '14:00', end_time: '22:00' })],
      ['shift', 'C', 'Shift C (10pm-6am)', JSON.stringify({ start_time: '22:00', end_time: '06:00' })],
      ['reason_code', 'DIM-NC', 'Dimensional Non-Conformance', JSON.stringify({ category: 'rejection' })],
      ['reason_code', 'SURF-DEF', 'Surface Defect', JSON.stringify({ category: 'rejection' })],
      ['reason_code', 'WRONG-QTY', 'Wrong Quantity Delivered', JSON.stringify({ category: 'return' })],
      ['reason_code', 'DAMAGED', 'Damaged in Transit', JSON.stringify({ category: 'return' })],
      ['reason_code', 'PROC-SCRAP', 'Process Scrap', JSON.stringify({ category: 'scrap' })],
      ['reason_code', 'PHYS-COUNT', 'Physical Count Correction', JSON.stringify({ category: 'adjustment' })]
    ];
    for (const [type, code, name, extra] of seedRows) insertSimple.run(type, code, name, extra);
  }
}

// ===== LICENSING =====
// A license key is a small signed token: base64url(JSON payload) + "." +
// HMAC-SHA256(payload, LICENSE_SECRET). It's fully self-contained and
// verifiable offline — deliberately, since this app is pitched on running
// on a client's local network without an internet dependency, so activation
// can't require phoning home. LICENSE_SECRET is what makes a key
// unforgeable without it: change it for your own builds, and keep it out
// of anything you hand to clients (only the generator script and this
// verification function ever need it).
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'SakaarERP-7d4b2f9e1c6a8035bf42d9e7c1a5b830f6e4c0a9';

function signLicensePayload(payload) {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json).toString('base64url');
  const signature = crypto.createHmac('sha256', LICENSE_SECRET).update(encoded).digest('hex');
  return `${encoded}.${signature}`;
}

function verifyLicenseKey(key) {
  if (!key || typeof key !== 'string' || !key.includes('.')) return null;
  const [encoded, signature] = key.split('.');
  if (!encoded || !signature) return null;
  const expectedSignature = crypto.createHmac('sha256', LICENSE_SECRET).update(encoded).digest('hex');
  // Constant-time comparison — a naive `===` here would leak timing
  // information about how many leading characters of a guessed signature
  // are correct, which is exactly the kind of detail a license check
  // shouldn't hand out for free.
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expectedSignature, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch (_) {
    return null;
  }
}

// Re-derives status (Active/Expired/Invalid/Not Activated) from whatever
// key is currently stored, and writes it back so every request doesn't
// need to re-verify the HMAC — called at startup and right after activation.
function refreshLicenseStatus() {
  const row = db.prepare('SELECT * FROM license_info WHERE id = 1').get();
  if (!row || !row.license_key) {
    db.prepare(`INSERT INTO license_info (id, status) VALUES (1, 'Not Activated') ON CONFLICT(id) DO UPDATE SET status = 'Not Activated'`).run();
    return;
  }
  const payload = verifyLicenseKey(row.license_key);
  if (!payload) {
    db.prepare('UPDATE license_info SET status = ? WHERE id = 1').run('Invalid');
    return;
  }
  const isExpired = payload.valid_until && new Date(payload.valid_until) < new Date();
  db.prepare('UPDATE license_info SET status = ? WHERE id = 1').run(isExpired ? 'Expired' : 'Active');
}

function getLicenseStatus() {
  const row = db.prepare('SELECT * FROM license_info WHERE id = 1').get();
  if (!row || !row.license_key) {
    return { activated: false, valid: false, status: 'Not Activated' };
  }
  const payload = verifyLicenseKey(row.license_key);
  if (!payload) {
    return { activated: true, valid: false, status: 'Invalid' };
  }
  const isExpired = payload.valid_until && new Date(payload.valid_until) < new Date();
  const daysRemaining = payload.valid_until ? Math.ceil((new Date(payload.valid_until) - new Date()) / 86400000) : null;
  return {
    activated: true,
    valid: !isExpired,
    status: isExpired ? 'Expired' : 'Active',
    licensed_to: payload.licensed_to,
    issued_date: payload.issued_date,
    valid_until: payload.valid_until,
    max_users: payload.max_users,
    days_remaining: daysRemaining
  };
}


// and CRUD routes.
const SIMPLE_MASTER_TYPES = ['item_group', 'grade', 'uom', 'payment_term', 'transporter', 'dispatch_mode', 'department', 'shift', 'reason_code'];

// Default prefix/padding for every document type, used the first time each
// is ever generated (after that, the `sequences` table is the source of
// truth and admins can change prefix/padding from the Number Series screen
// without touching code). Defined here, before initSchema() runs, because
// its migration step backfills old `sequences` rows using this map.
const DEFAULT_SEQUENCES = {
  vendor: { prefix: 'VEN', pad: 4 },
  material: { prefix: 'MAT', pad: 4 },
  po: { prefix: 'PO', pad: 4 },
  indent: { prefix: 'IND', pad: 4 },
  grn: { prefix: 'GRN', pad: 4 },
  invoice: { prefix: 'INV', pad: 4 },
  voucher: { prefix: 'PV', pad: 4 },
  adjustment: { prefix: 'ADJ', pad: 4 },
  stock_in: { prefix: 'SIN', pad: 4 },
  stock_out: { prefix: 'SOUT', pad: 4 },
  transfer: { prefix: 'TRF', pad: 4 },
  quotation: { prefix: 'QUO', pad: 4 },
  production_order: { prefix: 'PRD', pad: 4 },
  work_order: { prefix: 'WO', pad: 4 },
  allocation: { prefix: 'ALC', pad: 4 },
  product: { prefix: 'FG', pad: 4 },
  employee: { prefix: 'EMP', pad: 4 },
  customer: { prefix: 'CUS', pad: 4 },
  production_return: { prefix: 'PRR', pad: 4 },
  wip_entry: { prefix: 'WIP', pad: 4 },
  production_receipt: { prefix: 'PRC', pad: 4 },
  sales_quotation: { prefix: 'SQT', pad: 4 },
  sales_order: { prefix: 'SO', pad: 4 },
  dispatch_plan: { prefix: 'DPL', pad: 4 },
  challan: { prefix: 'DC', pad: 4 },
  packing_list: { prefix: 'PKL', pad: 4 },
  sales_return: { prefix: 'SRT', pad: 4 },
  sales_invoice: { prefix: 'SINV', pad: 4 },
  expense: { prefix: 'EXP', pad: 4 },
  customer_receipt: { prefix: 'RCT', pad: 4 },
  staging: { prefix: 'STG', pad: 5 },
  expense_claim: { prefix: 'ECL', pad: 4 }
};

initSchema();
refreshLicenseStatus();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));

const log = (level, msg) => console.log(`[${new Date().toISOString()}] ${level}: ${msg}`);

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    // The JWT signature alone doesn't prove the user still exists — if the
    // database was ever reset, restored from an older backup, or the user
    // deleted/deactivated, a still-valid-looking token can carry a user id
    // that no longer has a row in `users`. Every route that stamps
    // created_by/requested_by/etc. with req.userId would then hit a raw
    // "FOREIGN KEY constraint failed" deep in a DB insert — a confusing
    // error with no obvious connection to "you're logged in as a ghost
    // user." Checking here turns that into one clear, actionable message.
    const user = db.prepare('SELECT id, role, is_active FROM users WHERE id = ?').get(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Your session refers to an account that no longer exists or has been deactivated. Please log out and log in again.' });
    }
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Must run after verifyToken. Gates user-management and other admin-only routes.
const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// BUG FIX: 'sales' (added Round 16) was never added here, so creating a
// user with the Sales role was silently rejected by this exact check —
// "role must be one of: admin, approver, purchaser, storekeeper,
// production, accounts, employee" with no 'sales' in the list. Added it,
// plus the new 'cashier' role for POS/Trading Edition counter staff.
const VALID_ROLES = ['admin', 'approver', 'purchaser', 'storekeeper', 'production', 'sales', 'accounts', 'cashier', 'employee'];
const MODULES = ['dashboard', 'purchase', 'indent', 'inventory', 'quality', 'production', 'sales', 'pos', 'accounts', 'finance', 'expenses', 'reports', 'masters', 'admin'];
const DEFAULT_MODULE_PERMISSIONS = {
  admin: MODULES.reduce((acc, key) => ({ ...acc, [key]: true }), {}),
  approver: { dashboard: true, purchase: true, indent: true, inventory: true, quality: true, production: true, sales: true, pos: false, finance: false, expenses: true, reports: true, masters: false, admin: false },
  purchaser: { dashboard: true, purchase: true, indent: true, inventory: true, quality: false, production: false, sales: false, pos: false, finance: false, expenses: true, reports: false, masters: true, admin: false },
  storekeeper: { dashboard: true, purchase: false, indent: false, inventory: true, quality: true, production: false, sales: false, pos: false, finance: false, expenses: true, reports: false, masters: false, admin: false },
  production: { dashboard: true, purchase: false, indent: true, inventory: true, quality: false, production: true, sales: false, pos: false, finance: false, expenses: true, reports: false, masters: true, admin: false },
  sales: { dashboard: true, purchase: false, indent: false, inventory: true, quality: false, production: false, sales: true, pos: false, accounts: false, finance: false, expenses: true, reports: false, masters: true, admin: false },
  accounts: { dashboard: true, purchase: false, indent: false, inventory: false, quality: false, production: false, sales: true, pos: false, accounts: true, finance: true, expenses: true, reports: true, masters: false, admin: false },
  // The counter/shop-floor role for a Trading Edition deployment: billing
  // screen and enough inventory visibility to check stock while selling,
  // nothing else — no purchase, no finance, no admin.
  cashier: { dashboard: true, purchase: false, indent: false, inventory: true, quality: false, production: false, sales: false, pos: true, accounts: false, finance: false, expenses: true, reports: false, masters: false, admin: false },
  employee: { dashboard: true, purchase: false, indent: true, inventory: false, quality: false, production: false, sales: false, pos: false, finance: false, expenses: true, reports: false, masters: false, admin: false }
};

const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve'];

// Expands a stored permission value for one module into the full
// {view, create, edit, delete, approve} shape. Accepts the old simple
// boolean shape too (true/false applied to every action) so upgrading
// doesn't break permissions set before action-level control existed.
function expandModulePerm(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') {
    return ACTIONS.reduce((acc, a) => ({ ...acc, [a]: value }), {});
  }
  return ACTIONS.reduce((acc, a) => ({ ...acc, [a]: value[a] !== undefined ? !!value[a] : fallback[a] }), {});
}

function normalizeModulePermissions(role, raw) {
  const roleDefaults = DEFAULT_MODULE_PERMISSIONS[role] || DEFAULT_MODULE_PERMISSIONS.employee;
  let parsed = {};
  if (raw) {
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (_) {
      parsed = {};
    }
  }
  const allTrue = ACTIONS.reduce((acc, a) => ({ ...acc, [a]: true }), {});
  const allFalse = ACTIONS.reduce((acc, a) => ({ ...acc, [a]: false }), {});
  return MODULES.reduce((acc, module) => {
    if (role === 'admin') { acc[module] = allTrue; return acc; }
    const fallback = expandModulePerm(roleDefaults[module], allFalse);
    acc[module] = expandModulePerm(parsed[module], fallback);
    return acc;
  }, {});
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    department: user.department,
    approval_level: user.approval_level || 1,
    approver_id: user.approver_id || null,
    module_permissions: normalizeModulePermissions(user.role, user.module_permissions)
  };
}

function requireModuleAccess(module) {
  return (req, res, next) => {
    if (req.userRole === 'admin') return next();
    // Admin always keeps access (so an expired/invalid license can still be
    // fixed from inside the app), but everyone else is locked out of actual
    // work until it's renewed — same pattern most on-prem/boxed software uses.
    const license = getLicenseStatus();
    if (!license.valid) {
      return res.status(402).json({ error: `This installation's license is ${license.status.toLowerCase()}. Ask an administrator to renew it under System Settings → License.`, license_status: license.status });
    }
    const user = db.prepare('SELECT role, module_permissions FROM users WHERE id = ?').get(req.userId);
    const permissions = normalizeModulePermissions(user ? user.role : req.userRole, user ? user.module_permissions : null);
    const modulePerms = permissions[module] || {};

    // Derive the action from the request itself, since these guards are
    // mounted once per module prefix (e.g. everything under /api/purchase)
    // rather than repeated on every individual route.
    const path = req.path.toLowerCase();
    let action = 'view';
    if (path.includes('approve') || path.includes('acknowledge') || path.includes('/status')) action = 'approve';
    else if (req.method === 'DELETE') action = 'delete';
    else if (req.method === 'POST') action = 'create';
    else if (req.method === 'PUT' || req.method === 'PATCH') action = 'edit';

    if (!modulePerms[action]) {
      return res.status(403).json({ error: `You don't have '${action}' permission for the ${module} module. Ask an admin to grant it.` });
    }
    next();
  };
}

// Hands out the next sequential number for an entity type (e.g.
// nextSerial('vendor') => 'VEN-0001', then 'VEN-0002', ...). Prefix/padding
// come from the `sequences` table if an admin has configured it there,
// otherwise from DEFAULT_SEQUENCES the first time this entity is used.
// Wrapped in its own transaction so two simultaneous requests can't ever
// be handed the same number.
const nextSerialTxn = db.transaction((entity) => {
  let row = db.prepare('SELECT * FROM sequences WHERE entity = ?').get(entity);
  if (!row) {
    const def = DEFAULT_SEQUENCES[entity] || { prefix: entity.toUpperCase().slice(0, 3), pad: 4 };
    db.prepare('INSERT INTO sequences (entity, prefix, pad_length, next_number) VALUES (?, ?, ?, ?)').run(entity, def.prefix, def.pad, 1);
    row = { entity, prefix: def.prefix, pad_length: def.pad, next_number: 1 };
  }
  db.prepare('UPDATE sequences SET next_number = next_number + 1 WHERE entity = ?').run(entity);
  return `${row.prefix}-${String(row.next_number).padStart(row.pad_length, '0')}`;
});
function nextSerial(entity) {
  return nextSerialTxn(entity);
}

function addToLedger(materialId, warehouseId, delta) {
  const existing = db.prepare('SELECT * FROM stock_ledger WHERE material_id = ? AND warehouse_id = ?').get(materialId, warehouseId);
  if (existing) {
    db.prepare('UPDATE stock_ledger SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE material_id = ? AND warehouse_id = ?')
      .run(delta, materialId, warehouseId);
  } else {
    db.prepare('INSERT INTO stock_ledger (material_id, warehouse_id, quantity) VALUES (?, ?, ?)')
      .run(materialId, warehouseId, delta);
  }
}

// Records a new receipt as its own traceable batch (never merged into an
// existing batch row, even if the same material/warehouse/batch_number
// repeats — each receipt keeps its own identity) and mirrors the quantity
// into the aggregate stock_ledger so existing "how much do we have" checks
// keep working unchanged.
function addStockBatch(materialId, warehouseId, qty, meta = {}) {
  if (qty <= 0) return;
  db.prepare(`
    INSERT INTO stock_batches (material_id, warehouse_id, batch_number, heat_number, coil_number, serial_number, quantity_received, quantity_remaining, unit_cost, expiry_date, source, source_reference)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    materialId, warehouseId, meta.batch_number || null, meta.heat_number || null, meta.coil_number || null, meta.serial_number || null,
    qty, qty, meta.unit_cost || null, meta.expiry_date || null, meta.source || null, meta.source_reference || null
  );
  addToLedger(materialId, warehouseId, qty);
}

// Consumes `qty` from the oldest available batches first (FIFO) for a
// material/warehouse. Throws if there isn't enough traceable batch
// quantity to cover it. Returns the list of batches drawn from, so the
// caller can log/display exactly what was issued.
function consumeStockFIFO(materialId, warehouseId, qty) {
  if (qty <= 0) return [];
  const batches = db.prepare(`
    SELECT * FROM stock_batches
    WHERE material_id = ? AND warehouse_id = ? AND quantity_remaining > 0
    ORDER BY received_date ASC, id ASC
  `).all(materialId, warehouseId);

  const totalAvailable = batches.reduce((sum, b) => sum + b.quantity_remaining, 0);
  if (totalAvailable < qty - 0.0001) {
    throw new Error(`Not enough traceable batch stock: need ${qty}, only ${totalAvailable} available across all batches`);
  }

  let remaining = qty;
  const consumed = [];
  const updateBatch = db.prepare('UPDATE stock_batches SET quantity_remaining = ? WHERE id = ?');
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity_remaining, remaining);
    updateBatch.run(batch.quantity_remaining - take, batch.id);
    consumed.push({ batch_id: batch.id, batch_number: batch.batch_number, heat_number: batch.heat_number, coil_number: batch.coil_number, serial_number: batch.serial_number, quantity_taken: take });
    remaining -= take;
  }

  addToLedger(materialId, warehouseId, -qty);
  return consumed;
}

// Consumes stock the "smart" way: FIFO from traceable batches where any
// exist, or a plain ledger decrement for stock that predates batch
// tracking (nothing to trace it back to). Used by every stock-reducing
// flow (stock-out, transfer-out, negative adjustment, production issue)
// so they all behave consistently.
function consumeStock(materialId, warehouseId, qty) {
  const hasBatches = db.prepare('SELECT 1 FROM stock_batches WHERE material_id = ? AND warehouse_id = ? AND quantity_remaining > 0').get(materialId, warehouseId);
  if (hasBatches) {
    return consumeStockFIFO(materialId, warehouseId, qty);
  }
  addToLedger(materialId, warehouseId, -qty);
  return [];
}

// Same upsert pattern as addToLedger, for the QC-pending and QC-hold
// buckets — stock in either of these is NOT usable/issuable yet.
function addToBucket(table, materialId, warehouseId, delta) {
  const existing = db.prepare(`SELECT * FROM ${table} WHERE material_id = ? AND warehouse_id = ?`).get(materialId, warehouseId);
  if (existing) {
    db.prepare(`UPDATE ${table} SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE material_id = ? AND warehouse_id = ?`)
      .run(delta, materialId, warehouseId);
  } else {
    db.prepare(`INSERT INTO ${table} (material_id, warehouse_id, quantity) VALUES (?, ?, ?)`)
      .run(materialId, warehouseId, delta);
  }
}
const addToQCPending = (materialId, warehouseId, delta) => addToBucket('qc_pending_stock', materialId, warehouseId, delta);
const addToQCHold = (materialId, warehouseId, delta) => addToBucket('qc_hold_stock', materialId, warehouseId, delta);

// ===== AUTH ROUTES =====
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated. Contact your administrator.' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: publicUser(user)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password, full_name, department } = req.body;
    // SECURITY FIX: this endpoint used to trust a `role` field straight from
    // the request body, so anyone hitting it directly (not just through the
    // Register tab, which doesn't even show a role picker) could set
    // role: "admin" on their own account. Self-registration is now always
    // the lowest-privilege role; an admin has to promote someone via the
    // new User Management screen.
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, email, password, full_name, role, department) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(username, email, hash, full_name, 'employee', department);
    res.status(201).json({ message: 'User registered successfully', userId: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auth/profile', verifyToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, email, full_name, role, department, approval_level, approver_id, module_permissions FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== USER MANAGEMENT (admin only) =====
// Lets an admin create logins for approvers, purchasers, storekeepers, etc.
// and set what each one is allowed to do (their role).
app.get('/api/users/roles', verifyToken, requireAdmin, (req, res) => {
  res.json(VALID_ROLES);
});

app.get('/api/users', verifyToken, requireAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.username, u.email, u.full_name, u.role, u.department, u.approval_level,
             u.approver_id, a.full_name as approver_name, u.module_permissions,
             u.is_active, u.created_at
      FROM users u
      LEFT JOIN users a ON u.approver_id = a.id
      ORDER BY u.created_at DESC
    `).all();
    res.json((users || []).map(u => ({
      ...u,
      module_permissions: normalizeModulePermissions(u.role, u.module_permissions)
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', verifyToken, requireAdmin, (req, res) => {
  try {
    const { username, email, password, full_name, role, department, approval_level, approver_id, module_permissions } = req.body;
    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'username, email, password and full_name are required' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
    }
    const hash = bcrypt.hashSync(password, 10);
    const permissions = JSON.stringify(normalizeModulePermissions(role, module_permissions));
    const result = db.prepare(
      'INSERT INTO users (username, email, password, full_name, role, department, approval_level, approver_id, module_permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(username, email, hash, full_name, role, department || null, parseInt(approval_level) || 1, approver_id || null, permissions);
    logAudit(req.userId, 'Created', 'user', result.lastInsertRowid, null, { username, role, approval_level, approver_id });
    res.status(201).json({ id: result.lastInsertRowid, message: 'User created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id', verifyToken, requireAdmin, (req, res) => {
  try {
    const { full_name, email, role, department, is_active, approval_level, approver_id, module_permissions } = req.body;
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
    }
    // Guard against an admin locking themself out by deactivating their own only-admin account.
    if (parseInt(req.params.id) === req.userId && (is_active === false || is_active === 0)) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const nextRole = role ?? existing.role;
    const permissions = module_permissions !== undefined
      ? JSON.stringify(normalizeModulePermissions(nextRole, module_permissions))
      : existing.module_permissions;
    db.prepare(
      'UPDATE users SET full_name = ?, email = ?, role = ?, department = ?, is_active = ?, approval_level = ?, approver_id = ?, module_permissions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(
      full_name ?? existing.full_name,
      email ?? existing.email,
      nextRole,
      department ?? existing.department,
      (is_active === undefined ? existing.is_active : (is_active ? 1 : 0)),
      approval_level !== undefined ? (parseInt(approval_level) || 1) : existing.approval_level,
      approver_id !== undefined ? (approver_id || null) : existing.approver_id,
      permissions,
      req.params.id
    );
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id/reset-password', verifyToken, requireAdmin, (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, req.params.id);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== COMPANY SETTINGS (letterhead used on PO/GRN prints) =====
app.get('/api/settings/company', verifyToken, (req, res) => {
  try {
    const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();
    res.json(company || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings/company', verifyToken, requireAdmin, (req, res) => {
  try {
    const { company_name, address, city, state, postal_code, gstin, phone, email, website, logo_data_url } = req.body;
    db.prepare(`
      UPDATE company_settings SET company_name=?, address=?, city=?, state=?, postal_code=?, gstin=?, phone=?, email=?, website=?, logo_data_url=?, updated_at=CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(company_name, address, city, state, postal_code, gstin, phone, email, website, logo_data_url);
    res.json({ message: 'Company settings updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== APPROVAL HIERARCHY SETTINGS (admin only) =====
app.get('/api/settings/approval/indent', verifyToken, (req, res) => {
  try {
    const setting = db.prepare("SELECT * FROM approval_settings WHERE module = 'indent'").get();
    res.json(setting || { module: 'indent', levels_required: 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings/approval/indent', verifyToken, requireAdmin, (req, res) => {
  try {
    const levels = parseInt(req.body.levels_required);
    if (!levels || levels < 1) return res.status(400).json({ error: 'levels_required must be at least 1' });
    db.prepare("INSERT INTO approval_settings (module, levels_required) VALUES ('indent', ?) ON CONFLICT(module) DO UPDATE SET levels_required = excluded.levels_required").run(levels);
    res.json({ message: 'Indent approval levels updated' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/settings/approval/po-matrix', verifyToken, (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM approval_matrix WHERE module = 'po' ORDER BY min_amount ASC").all();
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/approval/po-matrix', verifyToken, requireAdmin, (req, res) => {
  try {
    const { min_amount, max_amount, required_level } = req.body;
    if (!required_level || required_level < 1) return res.status(400).json({ error: 'required_level must be at least 1' });
    const result = db.prepare("INSERT INTO approval_matrix (module, min_amount, max_amount, required_level) VALUES ('po', ?, ?, ?)")
      .run(parseFloat(min_amount) || 0, max_amount === '' || max_amount === undefined || max_amount === null ? null : parseFloat(max_amount), parseInt(required_level));
    res.status(201).json({ id: result.lastInsertRowid, message: 'Approval tier added' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/settings/approval/po-matrix/:id', verifyToken, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM approval_matrix WHERE id = ?').run(req.params.id);
    res.json({ message: 'Approval tier removed' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== NUMBER SERIES / DOCUMENT PREFIXES =====
app.get('/api/settings/number-series', verifyToken, requireAdmin, (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM sequences ORDER BY entity').all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings/number-series/:entity', verifyToken, requireAdmin, (req, res) => {
  try {
    const { prefix, pad_length, next_number } = req.body;
    if (!prefix) return res.status(400).json({ error: 'prefix is required' });
    const existing = db.prepare('SELECT * FROM sequences WHERE entity = ?').get(req.params.entity);
    if (!existing) return res.status(404).json({ error: 'Unknown document type' });
    db.prepare('UPDATE sequences SET prefix = ?, pad_length = ?, next_number = ? WHERE entity = ?')
      .run(prefix, parseInt(pad_length) || 4, parseInt(next_number) || existing.next_number, req.params.entity);
    res.json({ message: `Number series updated. Next number: ${prefix}-${String(parseInt(next_number) || existing.next_number).padStart(parseInt(pad_length) || 4, '0')}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== BRANCHES =====
app.get('/api/settings/branches', verifyToken, (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM branches WHERE is_active = 1 ORDER BY is_head_office DESC, branch_name').all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/branches', verifyToken, requireAdmin, (req, res) => {
  try {
    const { branch_code, branch_name, address, city, state, postal_code, gstin, phone, email, is_head_office } = req.body;
    if (!branch_code || !branch_name) return res.status(400).json({ error: 'branch_code and branch_name are required' });
    if (is_head_office) db.prepare('UPDATE branches SET is_head_office = 0').run(); // only one HO at a time
    const result = db.prepare(
      'INSERT INTO branches (branch_code, branch_name, address, city, state, postal_code, gstin, phone, email, is_head_office) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(branch_code, branch_name, address || null, city || null, state || null, postal_code || null, gstin || null, phone || null, email || null, is_head_office ? 1 : 0);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Branch created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/settings/branches/:id', verifyToken, requireAdmin, (req, res) => {
  try {
    const { branch_name, address, city, state, postal_code, gstin, phone, email, is_head_office, is_active } = req.body;
    if (is_head_office) db.prepare('UPDATE branches SET is_head_office = 0').run();
    const existing = db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Branch not found' });
    db.prepare(
      'UPDATE branches SET branch_name = ?, address = ?, city = ?, state = ?, postal_code = ?, gstin = ?, phone = ?, email = ?, is_head_office = ?, is_active = ? WHERE id = ?'
    ).run(
      branch_name ?? existing.branch_name, address ?? existing.address, city ?? existing.city, state ?? existing.state,
      postal_code ?? existing.postal_code, gstin ?? existing.gstin, phone ?? existing.phone, email ?? existing.email,
      is_head_office !== undefined ? (is_head_office ? 1 : 0) : existing.is_head_office,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      req.params.id
    );
    res.json({ message: 'Branch updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== FINANCIAL YEAR & PERIOD LOCKING =====
app.get('/api/settings/financial-years', verifyToken, (req, res) => {
  try {
    const years = db.prepare('SELECT * FROM financial_years ORDER BY start_date DESC').all();
    for (const fy of years) {
      fy.periods = db.prepare(`
        SELECT pl.*, u.full_name as locked_by_name
        FROM period_locks pl LEFT JOIN users u ON pl.locked_by = u.id
        WHERE pl.financial_year_id = ? ORDER BY pl.period_start
      `).all(fy.id);
    }
    res.json(years);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/financial-years', verifyToken, requireAdmin, (req, res) => {
  const createFY = db.transaction((body) => {
    const { fy_label, start_date, end_date, make_current } = body;
    if (!fy_label || !start_date || !end_date) throw new Error('fy_label, start_date and end_date are required');
    if (make_current) db.prepare('UPDATE financial_years SET is_current = 0').run();
    const result = db.prepare('INSERT INTO financial_years (fy_label, start_date, end_date, is_current) VALUES (?, ?, ?, ?)')
      .run(fy_label, start_date, end_date, make_current ? 1 : 0);
    const fyId = result.lastInsertRowid;

    // Auto-generate one calendar-month period per month spanned by the FY.
    const insertPeriod = db.prepare('INSERT INTO period_locks (financial_year_id, period_label, period_start, period_end, is_locked) VALUES (?, ?, ?, ?, 0)');
    let cursor = new Date(start_date);
    const end = new Date(end_date);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    while (cursor <= end) {
      const periodStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const periodEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const label = `${monthNames[cursor.getMonth()]}-${cursor.getFullYear()}`;
      insertPeriod.run(fyId, label, periodStart.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0]);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return fyId;
  });

  try {
    const fyId = createFY(req.body);
    res.status(201).json({ id: fyId, message: 'Financial year created with monthly periods' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/settings/periods/:id/lock', verifyToken, requireAdmin, (req, res) => {
  try {
    db.prepare('UPDATE period_locks SET is_locked = 1, locked_by = ?, locked_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.userId, req.params.id);
    res.json({ message: 'Period locked. No new transactions can be dated within it.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/settings/periods/:id/unlock', verifyToken, requireAdmin, (req, res) => {
  try {
    db.prepare('UPDATE period_locks SET is_locked = 0, locked_by = NULL, locked_at = NULL WHERE id = ?').run(req.params.id);
    res.json({ message: 'Period unlocked' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Used by transaction-creating routes to block backdating into a locked
// period. Returns null if the date is fine, or an error message if not.
function checkPeriodOpen(dateStr) {
  if (!dateStr) return null;
  const locked = db.prepare('SELECT period_label FROM period_locks WHERE is_locked = 1 AND ? BETWEEN period_start AND period_end').get(dateStr);
  return locked ? `The period ${locked.period_label} is locked for new/edited transactions. Contact an admin.` : null;
}

// ===== AUDIT LOG =====
function logAudit(userId, action, module, recordId, oldValue, newValue) {
  try {
    db.prepare('INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId || null, action, module, recordId || null, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null);
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

app.get('/api/settings/audit-log', verifyToken, requireAdmin, (req, res) => {
  try {
    const { module, user_id, from_date, to_date } = req.query;
    let query = `
      SELECT al.*, u.full_name as user_name
      FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (module) { query += ' AND al.module = ?'; params.push(module); }
    if (user_id) { query += ' AND al.user_id = ?'; params.push(user_id); }
    if (from_date) { query += ' AND date(al.timestamp) >= date(?)'; params.push(from_date); }
    if (to_date) { query += ' AND date(al.timestamp) <= date(?)'; params.push(to_date); }
    query += ' ORDER BY al.timestamp DESC LIMIT 500';
    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== NOTIFICATION TEMPLATES =====
app.get('/api/settings/notification-templates', verifyToken, requireAdmin, (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM notification_templates ORDER BY title').all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings/notification-templates/:id', verifyToken, requireAdmin, (req, res) => {
  try {
    const { subject, body, is_active } = req.body;
    db.prepare('UPDATE notification_templates SET subject = ?, body = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(subject || null, body, is_active === false ? 0 : 1, req.params.id);
    res.json({ message: 'Template updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== BACKUP & RESTORE =====
// Streams a hot backup of the live SQLite file (safe to run while the app
// is in use — better-sqlite3's .backup() handles this correctly, unlike
// just copying the .db file directly which can catch it mid-write).
// ===== LICENSE =====
// Public (only verifyToken, not requireAdmin) — every logged-in user's
// frontend needs to know if the license has lapsed so it can show the
// right screen, not just admins.
app.get('/api/license/status', verifyToken, (req, res) => {
  try {
    res.json(getLicenseStatus());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/license/activate', verifyToken, requireAdmin, (req, res) => {
  try {
    const { license_key } = req.body;
    if (!license_key) return res.status(400).json({ error: 'license_key is required' });
    const payload = verifyLicenseKey(license_key.trim());
    if (!payload || !payload.licensed_to) {
      return res.status(400).json({ error: 'This license key is not valid. Check it was copied in full, with no extra spaces or line breaks.' });
    }
    const isExpired = payload.valid_until && new Date(payload.valid_until) < new Date();
    db.prepare(`
      INSERT INTO license_info (id, license_key, licensed_to, issued_date, valid_until, max_users, status, activated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET license_key = excluded.license_key, licensed_to = excluded.licensed_to,
        issued_date = excluded.issued_date, valid_until = excluded.valid_until, max_users = excluded.max_users,
        status = excluded.status, activated_at = CURRENT_TIMESTAMP
    `).run(license_key.trim(), payload.licensed_to, payload.issued_date || null, payload.valid_until || null,
      payload.max_users || null, isExpired ? 'Expired' : 'Active');
    logAudit(req.userId, 'Activated', 'license', 1, null, { licensed_to: payload.licensed_to, valid_until: payload.valid_until });
    res.json({ message: isExpired ? 'License key accepted, but it is already expired — contact your vendor for a renewal.' : `License activated for ${payload.licensed_to}`, ...getLicenseStatus() });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/settings/backup', verifyToken, requireAdmin, async (req, res) => {
  try {
    const backupPath = path.join(dbDir, `backup-${Date.now()}.db`);
    await db.backup(backupPath);
    res.download(backupPath, `sakaar-erp-backup-${new Date().toISOString().split('T')[0]}.db`, (err) => {
      fs.unlink(backupPath, () => {}); // clean up the temp copy either way
      if (err) console.error('Backup download error:', err.message);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restores from an uploaded backup file (sent as base64 in JSON, consistent
// with how the logo upload works elsewhere in this app — avoids needing a
// separate multipart upload library just for this one feature).
// This is destructive, so: take a safety copy of the CURRENT database
// before overwriting it, and require the admin to type a confirmation
// phrase (checked here, not just client-side) before proceeding.
app.post('/api/settings/restore', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { file_data_base64, confirm } = req.body;
    if (confirm !== 'RESTORE') {
      return res.status(400).json({ error: 'Confirmation phrase does not match. Type RESTORE to proceed.' });
    }
    if (!file_data_base64) return res.status(400).json({ error: 'No backup file provided' });
    const buffer = Buffer.from(file_data_base64.replace(/^data:.*;base64,/, ''), 'base64');
    const safetyFilename = performRestoreFromBuffer(buffer);
    res.json({ message: `Database restored. A safety copy of the previous database was saved as ${safetyFilename}. Please restart the server now.` });
    // The live `db` connection is now stale (file swapped underneath it);
    // safest option is for the process to exit and let it be restarted,
    // rather than silently keep serving from a closed handle.
    setTimeout(() => process.exit(0), 500);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Shared by both "upload a file" restore and "pull from Google Drive"
// restore — same safety-copy-first, validate-header, swap-and-restart logic
// either way.
function performRestoreFromBuffer(buffer) {
  const header = buffer.subarray(0, 16).toString('utf8');
  if (!header.startsWith('SQLite format 3')) {
    throw new Error('That file does not look like a valid SQLite backup.');
  }
  const dbPath = path.join(dbDir, 'sakaar-erp.db');
  const safetyPath = path.join(dbDir, `pre-restore-safety-${Date.now()}.db`);
  db.backup(safetyPath);
  const tempRestorePath = path.join(dbDir, `restore-upload-${Date.now()}.db`);
  fs.writeFileSync(tempRestorePath, buffer);
  db.close();
  fs.renameSync(tempRestorePath, dbPath);
  return path.basename(safetyPath);
}

// ===== BACKUP: local folder (server-side path, no browser download dialog) =====
app.post('/api/settings/backup/to-path', verifyToken, requireAdmin, async (req, res) => {
  try {
    const targetDir = (req.body && req.body.path) || (db.prepare('SELECT local_path FROM backup_schedule WHERE id = 1').get() || {}).local_path;
    if (!targetDir) return res.status(400).json({ error: 'No folder path given, and no default local backup path is configured yet.' });
    if (!fs.existsSync(targetDir)) {
      try { fs.mkdirSync(targetDir, { recursive: true }); }
      catch (e) { return res.status(400).json({ error: `Could not create/access folder "${targetDir}": ${e.message}` }); }
    }
    const filename = `sakaar-erp-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    const fullPath = path.join(targetDir, filename);
    await db.backup(fullPath);
    res.json({ message: `Backup saved to ${fullPath}`, path: fullPath, filename });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== BACKUP: auto-backup schedule =====
app.get('/api/settings/backup-schedule', verifyToken, requireAdmin, (req, res) => {
  try {
    let row = db.prepare('SELECT * FROM backup_schedule WHERE id = 1').get();
    if (!row) {
      db.prepare('INSERT INTO backup_schedule (id) VALUES (1)').run();
      row = db.prepare('SELECT * FROM backup_schedule WHERE id = 1').get();
    }
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/settings/backup-schedule', verifyToken, requireAdmin, (req, res) => {
  try {
    const { enabled, time_of_day, destination, local_path } = req.body;
    if (time_of_day && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time_of_day)) {
      return res.status(400).json({ error: 'time_of_day must be in 24-hour HH:MM format, e.g. 02:00 or 23:30' });
    }
    if (!['local', 'gdrive', 'both'].includes(destination || 'local')) {
      return res.status(400).json({ error: 'destination must be local, gdrive, or both' });
    }
    db.prepare(`
      INSERT INTO backup_schedule (id, enabled, time_of_day, destination, local_path) VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled, time_of_day = excluded.time_of_day, destination = excluded.destination, local_path = excluded.local_path
    `).run(enabled ? 1 : 0, time_of_day || '02:00', destination || 'local', local_path || null);
    res.json({ message: 'Auto-backup schedule saved' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Checked once a minute (see setInterval near the bottom of this file).
// Fires at most once per calendar day, the moment server-local clock time
// reaches the configured HH:MM — "any time of day" the admin picks, not a
// fixed slot in code.
async function runScheduledBackupIfDue() {
  try {
    const sched = db.prepare('SELECT * FROM backup_schedule WHERE id = 1').get();
    if (!sched || !sched.enabled) return;
    const now = new Date();
    const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];
    const lastRunDate = sched.last_run_at ? new Date(sched.last_run_at).toISOString().split('T')[0] : null;
    if (lastRunDate === today) return; // already ran today
    if (nowHHMM !== sched.time_of_day) return; // not time yet

    const results = [];
    if (sched.destination === 'local' || sched.destination === 'both') {
      try {
        if (sched.local_path) {
          if (!fs.existsSync(sched.local_path)) fs.mkdirSync(sched.local_path, { recursive: true });
          const filename = `sakaar-erp-autobackup-${today}.db`;
          await db.backup(path.join(sched.local_path, filename));
          results.push('local: OK');
        } else {
          results.push('local: skipped (no path configured)');
        }
      } catch (e) { results.push(`local: FAILED (${e.message})`); }
    }
    if (sched.destination === 'gdrive' || sched.destination === 'both') {
      try {
        await backupToGoogleDrive();
        results.push('gdrive: OK');
      } catch (e) { results.push(`gdrive: FAILED (${e.message})`); }
    }
    db.prepare('UPDATE backup_schedule SET last_run_at = CURRENT_TIMESTAMP, last_run_status = ?, last_run_message = ? WHERE id = 1')
      .run(results.some(r => r.includes('FAILED')) ? 'Partial/Failed' : 'Success', results.join('; '));
  } catch (err) {
    console.error('Scheduled backup check failed:', err.message);
  }
}

// ===== GOOGLE DRIVE BACKUP =====
// googleapis is a fairly heavy dependency for something only Drive backup
// needs, so it's required lazily here rather than at the top of the file —
// if it isn't installed yet (`npm install`), every OTHER feature in the app
// keeps working; only these routes fail with a clear message instead of
// the whole server refusing to start.
function loadGoogleApis() {
  try {
    return require('googleapis');
  } catch (e) {
    throw new Error('Google Drive support needs the "googleapis" package. Run `npm install` in the project folder, then restart the server.');
  }
}

function getDriveOAuthClient(redirectUri) {
  const { google } = loadGoogleApis();
  const conn = db.prepare('SELECT * FROM google_drive_connection WHERE id = 1').get();
  if (!conn || !conn.client_id || !conn.client_secret) {
    throw new Error('Google Drive is not configured yet. Enter your Google Cloud OAuth Client ID and Secret first.');
  }
  const oAuth2Client = new google.auth.OAuth2(conn.client_id, conn.client_secret, redirectUri);
  if (conn.refresh_token) oAuth2Client.setCredentials({ refresh_token: conn.refresh_token });
  return { oAuth2Client, conn, google };
}

function getRedirectUri(req) {
  return `${req.protocol}://${req.get('host')}/api/settings/gdrive/callback`;
}

app.get('/api/settings/gdrive/status', verifyToken, requireAdmin, (req, res) => {
  try {
    const conn = db.prepare('SELECT client_id, connected_email, connected_at, folder_id FROM google_drive_connection WHERE id = 1').get();
    res.json({
      configured: !!(conn && conn.client_id),
      connected: !!(conn && conn.connected_email),
      connected_email: conn ? conn.connected_email : null,
      connected_at: conn ? conn.connected_at : null
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings/gdrive/configure', verifyToken, requireAdmin, (req, res) => {
  try {
    const { client_id, client_secret } = req.body;
    if (!client_id || !client_secret) return res.status(400).json({ error: 'client_id and client_secret are both required' });
    db.prepare(`
      INSERT INTO google_drive_connection (id, client_id, client_secret) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET client_id = excluded.client_id, client_secret = excluded.client_secret
    `).run(client_id.trim(), client_secret.trim());
    res.json({ message: 'Google OAuth credentials saved. Click "Connect Google Drive" next to finish.' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/settings/gdrive/auth-url', verifyToken, requireAdmin, (req, res) => {
  try {
    const { oAuth2Client } = getDriveOAuthClient(getRedirectUri(req));
    const url = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // forces a refresh_token even on a re-connect
      scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email']
    });
    res.json({ url });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Google redirects the browser here directly (not an SPA fetch call), so
// this responds with a small standalone HTML page rather than JSON.
app.get('/api/settings/gdrive/callback', async (req, res) => {
  const sendResult = (ok, message) => {
    res.send(`<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center;">
      <h2>${ok ? '✅ Google Drive Connected' : '❌ Connection Failed'}</h2>
      <p>${message}</p>
      <p style="color:#888">You can close this tab and go back to SAKAAR ERP.</p>
      </body></html>`);
  };
  try {
    const { code } = req.query;
    if (!code) return sendResult(false, 'No authorization code was returned by Google.');
    const { google } = loadGoogleApis();
    const { oAuth2Client } = getDriveOAuthClient(getRedirectUri(req));
    const { tokens } = await oAuth2Client.getToken(code);
    if (!tokens.refresh_token) {
      return sendResult(false, 'Google did not return a refresh token. Disconnect and try connecting again (make sure to approve access when prompted).');
    }
    oAuth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Create (or reuse) a dedicated backups folder in the connected account's Drive.
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const existing = await drive.files.list({ q: "name='SAKAAR ERP Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false", fields: 'files(id, name)' });
    let folderId = existing.data.files && existing.data.files[0] ? existing.data.files[0].id : null;
    if (!folderId) {
      const folder = await drive.files.create({ requestBody: { name: 'SAKAAR ERP Backups', mimeType: 'application/vnd.google-apps.folder' }, fields: 'id' });
      folderId = folder.data.id;
    }

    db.prepare(`
      UPDATE google_drive_connection SET refresh_token = ?, connected_email = ?, folder_id = ?, connected_at = CURRENT_TIMESTAMP WHERE id = 1
    `).run(tokens.refresh_token, userInfo.email, folderId);

    sendResult(true, `Connected as ${userInfo.email}. Backups will be saved to a "SAKAAR ERP Backups" folder in this account's Drive.`);
  } catch (err) {
    console.error('Google Drive OAuth callback error:', err.message);
    sendResult(false, err.message);
  }
});

app.post('/api/settings/gdrive/disconnect', verifyToken, requireAdmin, (req, res) => {
  try {
    db.prepare('UPDATE google_drive_connection SET refresh_token = NULL, connected_email = NULL, folder_id = NULL, connected_at = NULL WHERE id = 1').run();
    res.json({ message: 'Google Drive disconnected' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Shared by both the manual "Backup to Google Drive" button and the
// scheduled auto-backup.
async function backupToGoogleDrive() {
  const { google } = loadGoogleApis();
  const { oAuth2Client, conn } = getDriveOAuthClient('postmessage'); // redirect_uri unused for a refresh-token-based call
  if (!conn.refresh_token) throw new Error('Google Drive is not connected yet.');
  if (!conn.folder_id) throw new Error('No backup folder on Drive is on record — try disconnecting and reconnecting Google Drive.');
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  const tempPath = path.join(dbDir, `gdrive-upload-${Date.now()}.db`);
  await db.backup(tempPath);
  try {
    const filename = `sakaar-erp-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    await drive.files.create({
      requestBody: { name: filename, parents: [conn.folder_id] },
      media: { mimeType: 'application/x-sqlite3', body: fs.createReadStream(tempPath) }
    });
    return filename;
  } finally {
    fs.unlink(tempPath, () => {});
  }
}

app.post('/api/settings/gdrive/backup-now', verifyToken, requireAdmin, async (req, res) => {
  try {
    const filename = await backupToGoogleDrive();
    res.json({ message: `Backup uploaded to Google Drive as ${filename}` });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/settings/gdrive/backups', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { google } = loadGoogleApis();
    const { oAuth2Client, conn } = getDriveOAuthClient('postmessage');
    if (!conn.refresh_token) return res.status(400).json({ error: 'Google Drive is not connected yet.' });
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const result = await drive.files.list({
      q: `'${conn.folder_id}' in parents and trashed=false`,
      fields: 'files(id, name, createdTime, size)',
      orderBy: 'createdTime desc',
      pageSize: 50
    });
    res.json(result.data.files || []);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/settings/gdrive/restore', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { file_id, confirm } = req.body;
    if (confirm !== 'RESTORE') return res.status(400).json({ error: 'Confirmation phrase does not match. Type RESTORE to proceed.' });
    if (!file_id) return res.status(400).json({ error: 'file_id is required' });
    const { google } = loadGoogleApis();
    const { oAuth2Client } = getDriveOAuthClient('postmessage');
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const result = await drive.files.get({ fileId: file_id, alt: 'media' }, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(result.data);
    const safetyFilename = performRestoreFromBuffer(buffer);
    res.json({ message: `Database restored from Google Drive backup. A safety copy of the previous database was saved as ${safetyFilename}. Please restart the server now.` });
    setTimeout(() => process.exit(0), 500);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.use('/api/purchase', verifyToken, requireModuleAccess('purchase'));
app.use('/api/quality', verifyToken, requireModuleAccess('quality'));
app.use('/api/inventory', verifyToken, requireModuleAccess('inventory'));
app.use('/api/indent', verifyToken, requireModuleAccess('indent'));
app.use('/api/production', verifyToken, requireModuleAccess('production'));
app.use('/api/accounts', verifyToken, requireModuleAccess('accounts'));
app.use('/api/masters', verifyToken, requireModuleAccess('masters'));
// These three module route groups (Sales & Dispatch, Finance & Commercial
// Controls, Expense Claims) were added in later rounds and never got
// wired into this enforcement — meaning a valid login could call any of
// their endpoints regardless of module permission, even though the nav
// correctly hid them. Fixed: same enforcement every other module already had.
app.use('/api/sales', verifyToken, requireModuleAccess('sales'));
app.use('/api/pos', verifyToken, requireModuleAccess('pos'));
app.use('/api/mis', verifyToken, requireModuleAccess('reports'));
app.use('/api/finance', verifyToken, requireModuleAccess('finance'));
app.use('/api/expenses', verifyToken, requireModuleAccess('expenses'));

// ===== MASTER DATA MANAGEMENT =====

// --- Generic "simple master" CRUD (item groups, grades, UOM, payment
// terms, transporters, dispatch modes, departments, shifts, reason codes)
app.get('/api/masters/simple/:type', (req, res) => {
  try {
    if (!SIMPLE_MASTER_TYPES.includes(req.params.type)) return res.status(404).json({ error: 'Unknown master type' });
    const rows = db.prepare('SELECT * FROM simple_masters WHERE master_type = ? AND is_active = 1 ORDER BY name').all(req.params.type);
    res.json(rows.map(r => ({ ...r, extra: r.extra ? JSON.parse(r.extra) : null })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/masters/simple/:type', (req, res) => {
  try {
    if (!SIMPLE_MASTER_TYPES.includes(req.params.type)) return res.status(404).json({ error: 'Unknown master type' });
    const { code, name, extra } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
    const result = db.prepare('INSERT INTO simple_masters (master_type, code, name, extra) VALUES (?, ?, ?, ?)')
      .run(req.params.type, code, name, extra ? JSON.stringify(extra) : null);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/simple/:type/:id', (req, res) => {
  try {
    const { code, name, extra, is_active } = req.body;
    const existing = db.prepare('SELECT * FROM simple_masters WHERE id = ? AND master_type = ?').get(req.params.id, req.params.type);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE simple_masters SET code = ?, name = ?, extra = ?, is_active = ? WHERE id = ?').run(
      code ?? existing.code, name ?? existing.name,
      extra !== undefined ? JSON.stringify(extra) : existing.extra,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      req.params.id
    );
    res.json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/masters/simple/:type/:id', (req, res) => {
  try {
    db.prepare('UPDATE simple_masters SET is_active = 0 WHERE id = ? AND master_type = ?').run(req.params.id, req.params.type);
    res.json({ message: 'Removed successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- UOM conversions ---
app.get('/api/masters/uom-conversions', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM uom_conversions ORDER BY from_uom').all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/masters/uom-conversions', (req, res) => {
  try {
    const { from_uom, to_uom, conversion_factor } = req.body;
    if (!from_uom || !to_uom || !conversion_factor) return res.status(400).json({ error: 'from_uom, to_uom and conversion_factor are required' });
    const result = db.prepare('INSERT INTO uom_conversions (from_uom, to_uom, conversion_factor) VALUES (?, ?, ?)').run(from_uom, to_uom, parseFloat(conversion_factor));
    res.status(201).json({ id: result.lastInsertRowid, message: `1 ${from_uom} = ${conversion_factor} ${to_uom}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/masters/uom-conversions/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM uom_conversions WHERE id = ?').run(req.params.id);
    res.json({ message: 'Removed successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Work Centers ---
app.get('/api/masters/work-centers', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM work_centers WHERE is_active = 1 ORDER BY wc_name').all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/masters/work-centers', (req, res) => {
  try {
    const { wc_code, wc_name, department, capacity_per_day } = req.body;
    if (!wc_code || !wc_name) return res.status(400).json({ error: 'wc_code and wc_name are required' });
    const result = db.prepare('INSERT INTO work_centers (wc_code, wc_name, department, capacity_per_day) VALUES (?, ?, ?, ?)')
      .run(wc_code, wc_name, department || null, parseFloat(capacity_per_day) || null);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Work center created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/work-centers/:id', (req, res) => {
  try {
    const { wc_name, department, capacity_per_day, is_active } = req.body;
    const existing = db.prepare('SELECT * FROM work_centers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE work_centers SET wc_name = ?, department = ?, capacity_per_day = ?, is_active = ? WHERE id = ?').run(
      wc_name ?? existing.wc_name, department ?? existing.department,
      capacity_per_day !== undefined ? parseFloat(capacity_per_day) : existing.capacity_per_day,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      req.params.id
    );
    res.json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Machines ---
app.get('/api/masters/machines', (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT m.*, w.wc_name FROM machines m LEFT JOIN work_centers w ON m.work_center_id = w.id
      WHERE m.is_active = 1 ORDER BY m.machine_name
    `).all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/masters/machines', (req, res) => {
  try {
    const { machine_code, machine_name, work_center_id } = req.body;
    if (!machine_code || !machine_name) return res.status(400).json({ error: 'machine_code and machine_name are required' });
    const result = db.prepare('INSERT INTO machines (machine_code, machine_name, work_center_id) VALUES (?, ?, ?)')
      .run(machine_code, machine_name, work_center_id || null);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Machine created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/machines/:id', (req, res) => {
  try {
    const { machine_name, work_center_id, is_active } = req.body;
    const existing = db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE machines SET machine_name = ?, work_center_id = ?, is_active = ? WHERE id = ?').run(
      machine_name ?? existing.machine_name, work_center_id !== undefined ? work_center_id : existing.work_center_id,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active, req.params.id
    );
    res.json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Warehouse Locations (rack/bin) ---
app.get('/api/masters/warehouse-locations', (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT wl.*, w.warehouse_name FROM warehouse_locations wl LEFT JOIN warehouses w ON wl.warehouse_id = w.id
      WHERE wl.is_active = 1 ORDER BY w.warehouse_name, wl.location_code
    `).all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/masters/warehouse-locations', (req, res) => {
  try {
    const { warehouse_id, location_code, rack, bin } = req.body;
    if (!warehouse_id || !location_code) return res.status(400).json({ error: 'warehouse_id and location_code are required' });
    const result = db.prepare('INSERT INTO warehouse_locations (warehouse_id, location_code, rack, bin) VALUES (?, ?, ?, ?)')
      .run(warehouse_id, location_code, rack || null, bin || null);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Location created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/masters/warehouse-locations/:id', (req, res) => {
  try {
    db.prepare('UPDATE warehouse_locations SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Removed successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Customers ---
app.get('/api/masters/customers', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM customers WHERE is_active = 1 ORDER BY customer_name').all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/masters/customers', (req, res) => {
  try {
    const { customer_name, contact_person, email, phone, address, city, state, postal_code, gst_number, credit_limit } = req.body;
    if (!customer_name) return res.status(400).json({ error: 'customer_name is required' });
    const customer_code = nextSerial('customer');
    const result = db.prepare(
      'INSERT INTO customers (customer_code, customer_name, contact_person, email, phone, address, city, state, postal_code, gst_number, credit_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(customer_code, customer_name, contact_person || null, email || null, phone || null, address || null, city || null, state || null, postal_code || null, gst_number || null, parseFloat(credit_limit) || 0);
    res.status(201).json({ id: result.lastInsertRowid, customer_code, message: `Customer created successfully (${customer_code})` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/customers/:id', (req, res) => {
  try {
    const { customer_name, contact_person, email, phone, address, city, state, postal_code, gst_number, credit_limit, is_active } = req.body;
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare(`
      UPDATE customers SET customer_name=?, contact_person=?, email=?, phone=?, address=?, city=?, state=?, postal_code=?, gst_number=?, credit_limit=?, is_active=?
      WHERE id = ?
    `).run(
      customer_name ?? existing.customer_name, contact_person ?? existing.contact_person, email ?? existing.email, phone ?? existing.phone,
      address ?? existing.address, city ?? existing.city, state ?? existing.state, postal_code ?? existing.postal_code,
      gst_number ?? existing.gst_number, credit_limit !== undefined ? parseFloat(credit_limit) : existing.credit_limit,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active, req.params.id
    );
    res.json({ message: 'Customer updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Tax Master / HSN-SAC / GST Class ---
app.get('/api/masters/tax', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM tax_master WHERE is_active = 1 ORDER BY tax_name').all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/masters/tax', (req, res) => {
  try {
    const { tax_name, rate, hsn_sac_code, gst_class } = req.body;
    if (!tax_name || rate === undefined) return res.status(400).json({ error: 'tax_name and rate are required' });
    const result = db.prepare('INSERT INTO tax_master (tax_name, rate, hsn_sac_code, gst_class) VALUES (?, ?, ?, ?)')
      .run(tax_name, parseFloat(rate), hsn_sac_code || null, gst_class || null);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Tax entry created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/tax/:id', (req, res) => {
  try {
    const { tax_name, rate, hsn_sac_code, gst_class, is_active } = req.body;
    const existing = db.prepare('SELECT * FROM tax_master WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE tax_master SET tax_name = ?, rate = ?, hsn_sac_code = ?, gst_class = ?, is_active = ? WHERE id = ?').run(
      tax_name ?? existing.tax_name, rate !== undefined ? parseFloat(rate) : existing.rate,
      hsn_sac_code ?? existing.hsn_sac_code, gst_class ?? existing.gst_class,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active, req.params.id
    );
    res.json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Employees ---
app.get('/api/masters/employees', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM employees WHERE is_active = 1 ORDER BY full_name').all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/masters/employees', (req, res) => {
  try {
    const { full_name, department, designation, shift, date_of_joining, phone, email } = req.body;
    if (!full_name) return res.status(400).json({ error: 'full_name is required' });
    const employee_code = nextSerial('employee');
    const result = db.prepare(
      'INSERT INTO employees (employee_code, full_name, department, designation, shift, date_of_joining, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(employee_code, full_name, department || null, designation || null, shift || null, date_of_joining || null, phone || null, email || null);
    res.status(201).json({ id: result.lastInsertRowid, employee_code, message: `Employee created successfully (${employee_code})` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/employees/:id', (req, res) => {
  try {
    const { full_name, department, designation, shift, date_of_joining, phone, email, is_active } = req.body;
    const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare(`
      UPDATE employees SET full_name=?, department=?, designation=?, shift=?, date_of_joining=?, phone=?, email=?, is_active=?
      WHERE id = ?
    `).run(
      full_name ?? existing.full_name, department ?? existing.department, designation ?? existing.designation,
      shift ?? existing.shift, date_of_joining ?? existing.date_of_joining, phone ?? existing.phone, email ?? existing.email,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active, req.params.id
    );
    res.json({ message: 'Employee updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Routing Master (with steps) ---
app.get('/api/masters/routing', (req, res) => {
  try {
    const routings = db.prepare(`
      SELECT rm.*, pr.product_name as recipe_product_name
      FROM routing_master rm LEFT JOIN production_recipes pr ON rm.recipe_id = pr.id
      WHERE rm.is_active = 1 ORDER BY rm.routing_name
    `).all();
    for (const r of routings) {
      r.steps = db.prepare(`
        SELECT rs.*, wc.wc_name FROM routing_steps rs LEFT JOIN work_centers wc ON rs.work_center_id = wc.id
        WHERE rs.routing_id = ? ORDER BY rs.sequence_no
      `).all(r.id);
    }
    res.json(routings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/masters/routing', (req, res) => {
  const createRouting = db.transaction((body) => {
    const { routing_name, recipe_id, steps = [] } = body;
    if (!routing_name) throw new Error('routing_name is required');
    const result = db.prepare('INSERT INTO routing_master (routing_name, recipe_id) VALUES (?, ?)').run(routing_name, recipe_id || null);
    const routingId = result.lastInsertRowid;
    const insertStep = db.prepare('INSERT INTO routing_steps (routing_id, sequence_no, operation_name, work_center_id, standard_time_minutes) VALUES (?, ?, ?, ?, ?)');
    steps.forEach((step, idx) => {
      if (!step.operation_name) return;
      insertStep.run(routingId, idx + 1, step.operation_name, step.work_center_id || null, parseFloat(step.standard_time_minutes) || null);
    });
    return routingId;
  });

  try {
    const id = createRouting(req.body);
    res.status(201).json({ id, message: 'Routing created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/routing/:id', (req, res) => {
  const updateRouting = db.transaction((id, body) => {
    const { routing_name, recipe_id, steps = [] } = body;
    const existing = db.prepare('SELECT * FROM routing_master WHERE id = ?').get(id);
    if (!existing) throw new Error('Routing not found');
    db.prepare('UPDATE routing_master SET routing_name = ?, recipe_id = ? WHERE id = ?').run(routing_name ?? existing.routing_name, recipe_id !== undefined ? recipe_id : existing.recipe_id, id);
    db.prepare('DELETE FROM routing_steps WHERE routing_id = ?').run(id);
    const insertStep = db.prepare('INSERT INTO routing_steps (routing_id, sequence_no, operation_name, work_center_id, standard_time_minutes) VALUES (?, ?, ?, ?, ?)');
    steps.forEach((step, idx) => {
      if (!step.operation_name) return;
      insertStep.run(id, idx + 1, step.operation_name, step.work_center_id || null, parseFloat(step.standard_time_minutes) || null);
    });
  });

  try {
    updateRouting(req.params.id, req.body);
    res.json({ message: 'Routing updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/masters/routing/:id', (req, res) => {
  try {
    db.prepare('UPDATE routing_master SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Removed successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== MATERIALS ROUTES =====
app.get('/api/purchase/materials', verifyToken, (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM materials WHERE is_active = 1 ORDER BY material_name').all() || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchase/materials', verifyToken, (req, res) => {
  try {
    const { material_name, description, category, material_grade, unit_of_measure, reorder_level, reorder_quantity, max_stock_level, hsn_code, gst_rate, qc_required, item_type, barcode, default_sale_price } = req.body;
    const material_code = nextSerial('material');
    const result = db.prepare(
      'INSERT INTO materials (material_code, material_name, description, category, material_grade, unit_of_measure, reorder_level, reorder_quantity, max_stock_level, hsn_code, gst_rate, qc_required, item_type, barcode, default_sale_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(material_code, material_name, description, category, material_grade, unit_of_measure, reorder_level || 0, reorder_quantity || 0, max_stock_level || null, hsn_code, gst_rate || 18, qc_required === false ? 0 : 1, item_type || 'Raw Material', barcode || null, parseFloat(default_sale_price) || 0);
    res.status(201).json({ id: result.lastInsertRowid, material_code, message: `Material created successfully (${material_code})` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/purchase/materials/:id', verifyToken, (req, res) => {
  try {
    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });
    res.json(material);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/purchase/materials/:id', verifyToken, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Material not found' });
    const { material_name, description, category, material_grade, unit_of_measure, reorder_level, reorder_quantity, max_stock_level, hsn_code, gst_rate, qc_required, item_type, barcode, default_sale_price } = req.body;
    db.prepare(`
      UPDATE materials SET material_name=?, description=?, category=?, material_grade=?, unit_of_measure=?, reorder_level=?, reorder_quantity=?, max_stock_level=?, hsn_code=?, gst_rate=?, qc_required=?, item_type=?, barcode=?, default_sale_price=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      material_name ?? existing.material_name, description ?? existing.description, category ?? existing.category, material_grade ?? existing.material_grade,
      unit_of_measure ?? existing.unit_of_measure, reorder_level ?? existing.reorder_level, reorder_quantity ?? existing.reorder_quantity,
      max_stock_level ?? existing.max_stock_level, hsn_code ?? existing.hsn_code, gst_rate ?? existing.gst_rate,
      qc_required !== undefined ? (qc_required ? 1 : 0) : existing.qc_required, item_type ?? existing.item_type,
      barcode ?? existing.barcode, default_sale_price !== undefined ? parseFloat(default_sale_price) || 0 : existing.default_sale_price, req.params.id
    );
    res.json({ message: 'Material updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.get('/api/purchase/vendors', verifyToken, (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM vendors WHERE is_active = 1 ORDER BY vendor_name').all() || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/purchase/vendors/:id', verifyToken, (req, res) => {
  try {
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json(vendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchase/vendors', verifyToken, (req, res) => {
  try {
    const { vendor_name, contact_person, email, phone, address, city, state, postal_code, gst_number, pan_number, bank_name, bank_account, ifsc_code, payment_terms, credit_limit, notes } = req.body;
    // Auto-generated rather than trusting client input — avoids duplicate/
    // inconsistent codes from manual entry (e.g. "V001" vs "VEN-1" vs "v1").
    const vendor_code = nextSerial('vendor');
    const result = db.prepare(
      'INSERT INTO vendors (vendor_code, vendor_name, contact_person, email, phone, address, city, state, postal_code, gst_number, pan_number, bank_name, bank_account, ifsc_code, payment_terms, credit_limit, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(vendor_code, vendor_name, contact_person, email, phone, address, city, state, postal_code, gst_number, pan_number, bank_name, bank_account, ifsc_code, payment_terms, credit_limit || 0, notes);
    res.status(201).json({ id: result.lastInsertRowid, vendor_code, message: `Vendor created successfully (${vendor_code})` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/purchase/vendors/:id', verifyToken, (req, res) => {
  try {
    // vendor_code is intentionally not accepted here — it's assigned once
    // at creation and stays fixed, same reasoning as not letting it be
    // manually typed in the first place.
    const { vendor_name, contact_person, email, phone, address, city, state, postal_code, gst_number, pan_number, bank_name, bank_account, ifsc_code, payment_terms, credit_limit, notes } = req.body;
    db.prepare(
      `UPDATE vendors SET vendor_name=?, contact_person=?, email=?, phone=?, address=?, city=?, state=?, postal_code=?, gst_number=?, pan_number=?, bank_name=?, bank_account=?, ifsc_code=?, payment_terms=?, credit_limit=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(vendor_name, contact_person, email, phone, address, city, state, postal_code, gst_number, pan_number, bank_name, bank_account, ifsc_code, payment_terms, credit_limit || 0, notes, req.params.id);
    res.json({ message: 'Vendor updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/purchase/vendors/:id', verifyToken, (req, res) => {
  try {
    // Soft delete so historical POs referencing this vendor still resolve
    db.prepare('UPDATE vendors SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    res.json({ message: 'Vendor deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== PURCHASE ORDERS ROUTES =====
app.get('/api/purchase/purchase-orders', verifyToken, (req, res) => {
  try {
    const pos = db.prepare(`
      SELECT po.*, v.vendor_name, v.vendor_code
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      ORDER BY po.created_at DESC
    `).all();
    res.json(pos || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/purchase/purchase-orders/:id', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const po = db.prepare(`
      SELECT po.*, v.vendor_name, v.vendor_code, v.gst_number as vendor_gstin,
             v.address as vendor_address, v.city as vendor_city, v.state as vendor_state,
             v.postal_code as vendor_postal_code, v.phone as vendor_phone, v.contact_person as vendor_contact_person,
             cu.full_name as created_by_name, au.full_name as approved_by_name
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN users cu ON po.created_by = cu.id
      LEFT JOIN users au ON po.approved_by = au.id
      WHERE po.id = ?
    `).get(id);
    if (!po) return res.status(404).json({ error: 'PO not found' });

    po.items = db.prepare(`
      SELECT poi.*, m.material_name, m.material_code, m.material_grade, m.unit_of_measure
      FROM purchase_order_items poi
      LEFT JOIN materials m ON poi.material_id = m.id
      WHERE poi.po_id = ?
    `).all(id);

    res.json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchase/purchase-orders', verifyToken, (req, res) => {
  const insertPO = db.transaction((body, userId) => {
    const {
      vendor_id, po_date, expected_delivery_date, status, notes, items = [],
      category, our_rates, inspection_terms, packing_forwarding, payment_term,
      insurance, freight, destination, transporter, special_remarks
    } = body;

    const periodError = checkPeriodOpen(po_date);
    if (periodError) throw new Error(periodError);

    const po_number = nextSerial('po');

    let total_amount = 0;
    let tax_amount = 0;
    const lineItems = items.map(it => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.unit_price) || 0;
      const taxRate = parseFloat(it.tax_rate) || 0;
      const lineBase = qty * price;
      const lineTax = lineBase * (taxRate / 100);
      total_amount += lineBase;
      tax_amount += lineTax;
      return { material_id: it.material_id, quantity: qty, unit_price: price, tax_rate: taxRate, line_total: lineBase + lineTax };
    });
    const grand_total = total_amount + tax_amount;

    const result = db.prepare(`
      INSERT INTO purchase_orders (
        po_number, vendor_id, po_date, expected_delivery_date, status, total_amount, tax_amount, grand_total, notes, created_by,
        category, our_rates, inspection_terms, packing_forwarding, payment_term, insurance, freight, destination, transporter, special_remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      po_number, vendor_id, po_date, expected_delivery_date, status || 'Draft', total_amount, tax_amount, grand_total, notes, userId,
      category || null, our_rates || null, inspection_terms || null, packing_forwarding || null, payment_term || null,
      insurance || null, freight || null, destination || null, transporter || null, special_remarks || null
    );

    const poId = result.lastInsertRowid;
    const insertItem = db.prepare(
      'INSERT INTO purchase_order_items (po_id, material_id, quantity, unit_price, tax_rate, line_total) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const it of lineItems) {
      if (!it.material_id) continue;
      insertItem.run(poId, it.material_id, it.quantity, it.unit_price, it.tax_rate, it.line_total);
    }

    return { po_number, id: poId };
  });

  try {
    const { po_number, id } = insertPO(req.body, req.userId);
    logAudit(req.userId, 'Created', 'po', id, null, { po_number, vendor_id: req.body.vendor_id, grand_total: req.body.items });
    res.status(201).json({ po_number, id, message: 'PO created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function calculatePOAmounts(items = []) {
  let total_amount = 0;
  let tax_amount = 0;
  const lineItems = items.map(it => {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.unit_price) || 0;
    const taxRate = parseFloat(it.tax_rate) || 0;
    const lineBase = qty * price;
    const lineTax = lineBase * (taxRate / 100);
    total_amount += lineBase;
    tax_amount += lineTax;
    return {
      material_id: it.material_id,
      quantity: qty,
      unit_price: price,
      tax_rate: taxRate,
      line_total: lineBase + lineTax
    };
  });
  return { total_amount, tax_amount, grand_total: total_amount + tax_amount, lineItems };
}

function hasApprovedPOChangeGrant(poId, userId, requestType) {
  return db.prepare(`
    SELECT r.*
    FROM po_change_requests r
    JOIN users u ON u.id = r.requested_by
    WHERE r.po_id = ?
      AND r.requested_by = ?
      AND r.request_type = ?
      AND r.status = 'Approved'
      AND r.used_at IS NULL
      AND (r.approved_by = u.approver_id OR r.approved_by IN (SELECT id FROM users WHERE role = 'admin'))
    ORDER BY r.decided_at DESC
    LIMIT 1
  `).get(poId, userId, requestType);
}

function assertCanChangePO(po, userId, userRole, requestType) {
  if (!po) throw new Error('PO not found');
  if (userRole === 'admin') return null;
  if (po.status === 'Draft') {
    if (po.created_by !== userId) throw new Error('Only the PO creator can change this draft PO');
    return null;
  }
  const grant = hasApprovedPOChangeGrant(po.id, userId, requestType);
  if (!grant) {
    throw new Error(`This PO is ${po.status}. Ask your assigned approver to allow ${requestType} first.`);
  }
  return grant;
}

function markPOGrantUsed(grant) {
  if (grant) {
    db.prepare('UPDATE po_change_requests SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(grant.id);
  }
}

app.get('/api/purchase/po-change-requests', verifyToken, (req, res) => {
  try {
    const where = req.userRole === 'admin'
      ? ''
      : 'WHERE r.requested_by = @userId OR u.approver_id = @userId';
    const requests = db.prepare(`
      SELECT r.*, po.po_number, po.status as po_status,
             u.full_name as requested_by_name,
             a.full_name as approved_by_name
      FROM po_change_requests r
      JOIN purchase_orders po ON r.po_id = po.id
      JOIN users u ON r.requested_by = u.id
      LEFT JOIN users a ON r.approved_by = a.id
      ${where}
      ORDER BY r.created_at DESC
    `).all({ userId: req.userId });
    res.json(requests || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchase/purchase-orders/:id/change-requests', verifyToken, (req, res) => {
  try {
    const { request_type, reason } = req.body;
    if (!['edit', 'delete'].includes(request_type)) {
      return res.status(400).json({ error: 'request_type must be edit or delete' });
    }
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
    if (!po) return res.status(404).json({ error: 'PO not found' });
    if (req.userRole === 'admin') return res.json({ message: 'Admin can change this PO without requesting approval' });
    if (po.status === 'Draft' && po.created_by === req.userId) {
      return res.json({ message: 'This is your draft PO, so you can change it directly' });
    }
    const user = db.prepare('SELECT approver_id FROM users WHERE id = ?').get(req.userId);
    if (!user || !user.approver_id) {
      return res.status(400).json({ error: 'No fixed approver is assigned to your account. Ask admin to set one.' });
    }
    const existing = db.prepare(`
      SELECT id FROM po_change_requests
      WHERE po_id = ? AND requested_by = ? AND request_type = ? AND status = 'Pending'
    `).get(req.params.id, req.userId, request_type);
    if (existing) return res.json({ message: 'A request is already pending for this PO' });
    const result = db.prepare(`
      INSERT INTO po_change_requests (po_id, requested_by, request_type, reason)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, req.userId, request_type, reason || null);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Request sent to your approver' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/purchase/po-change-requests/:id/decision', verifyToken, (req, res) => {
  try {
    const { status, comments } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be Approved or Rejected' });
    }
    const request = db.prepare(`
      SELECT r.*, u.approver_id
      FROM po_change_requests r
      JOIN users u ON r.requested_by = u.id
      WHERE r.id = ?
    `).get(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'Pending') return res.status(400).json({ error: `Request is already ${request.status}` });
    if (req.userRole !== 'admin' && request.approver_id !== req.userId) {
      return res.status(403).json({ error: 'Only the requester fixed approver can decide this request' });
    }
    db.prepare(`
      UPDATE po_change_requests
      SET status = ?, approved_by = ?, decision_comments = ?, decided_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, req.userId, comments || null, req.params.id);
    res.json({ message: `Request ${status.toLowerCase()}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/purchase/purchase-orders/:id', verifyToken, (req, res) => {
  const updatePO = db.transaction((poId, body, userId, userRole) => {
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId);
    const grant = assertCanChangePO(po, userId, userRole, 'edit');
    if (db.prepare('SELECT COUNT(*) as count FROM grn WHERE po_id = ?').get(poId).count > 0) {
      throw new Error('This PO already has a GRN, so it cannot be edited');
    }

    const {
      vendor_id, expected_delivery_date, notes, items = [],
      category, our_rates, inspection_terms, packing_forwarding, payment_term,
      insurance, freight, destination, transporter, special_remarks
    } = body;
    if (!vendor_id) throw new Error('vendor_id is required');
    if (!items.length) throw new Error('At least one item is required');
    const { total_amount, tax_amount, grand_total, lineItems } = calculatePOAmounts(items);
    const requiredLevel = po.status === 'Draft' ? po.required_level : computePORequiredLevel(grand_total);

    db.prepare(`
      UPDATE purchase_orders
      SET vendor_id = ?, expected_delivery_date = ?, total_amount = ?, tax_amount = ?,
          grand_total = ?, notes = ?, current_level = CASE WHEN status = 'Draft' THEN current_level ELSE 0 END,
          required_level = ?, status = CASE WHEN status = 'Approved' THEN 'Submitted' ELSE status END,
          category = ?, our_rates = ?, inspection_terms = ?, packing_forwarding = ?, payment_term = ?,
          insurance = ?, freight = ?, destination = ?, transporter = ?, special_remarks = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      vendor_id, expected_delivery_date || null, total_amount, tax_amount, grand_total, notes || null, requiredLevel,
      category || null, our_rates || null, inspection_terms || null, packing_forwarding || null, payment_term || null,
      insurance || null, freight || null, destination || null, transporter || null, special_remarks || null,
      poId
    );
    db.prepare('DELETE FROM purchase_order_items WHERE po_id = ?').run(poId);
    const insertItem = db.prepare('INSERT INTO purchase_order_items (po_id, material_id, quantity, unit_price, tax_rate, line_total) VALUES (?, ?, ?, ?, ?, ?)');
    for (const it of lineItems) {
      if (it.material_id && it.quantity > 0) {
        insertItem.run(poId, it.material_id, it.quantity, it.unit_price, it.tax_rate, it.line_total);
      }
    }
    markPOGrantUsed(grant);
  });

  try {
    updatePO(req.params.id, req.body, req.userId, req.userRole);
    res.json({ message: 'PO updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/purchase/purchase-orders/:id', verifyToken, (req, res) => {
  const deletePO = db.transaction((poId, userId, userRole) => {
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId);
    const grant = assertCanChangePO(po, userId, userRole, 'delete');
    if (db.prepare('SELECT COUNT(*) as count FROM grn WHERE po_id = ?').get(poId).count > 0) {
      throw new Error('This PO already has a GRN, so it cannot be deleted');
    }
    db.prepare('DELETE FROM purchase_order_items WHERE po_id = ?').run(poId);
    db.prepare('DELETE FROM approval_history WHERE module = ? AND record_id = ?').run('po', poId);
    db.prepare('DELETE FROM po_change_requests WHERE po_id = ?').run(poId);
    db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(poId);
    markPOGrantUsed(grant);
  });

  try {
    deletePO(req.params.id, req.userId, req.userRole);
    res.json({ message: 'PO deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Finds how many sequential approval levels a PO of this value requires,
// using the most senior (highest required_level) matching bracket if
// brackets happen to overlap.
function computePORequiredLevel(grandTotal) {
  const rows = db.prepare(`
    SELECT * FROM approval_matrix
    WHERE module = 'po' AND min_amount <= ? AND (max_amount IS NULL OR ? <= max_amount)
    ORDER BY required_level DESC
  `).all(grandTotal, grandTotal);
  return rows.length > 0 ? rows[0].required_level : 1;
}

// Shared by /approve and /status (status=Approved) — the UI's "Approve"
// button actually calls /status, but both need identical hierarchy
// enforcement so neither becomes a backdoor around the other.
function approvePOAtNextLevel(poId, userId, userRole) {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId);
  if (!po) throw new Error('PO not found');
  if (po.status !== 'Submitted') throw new Error(`This PO is ${po.status}, not awaiting approval`);

  const approverUser = db.prepare('SELECT approval_level FROM users WHERE id = ?').get(userId);
  const nextLevel = po.current_level + 1;
  if (userRole !== 'admin' && (!approverUser || approverUser.approval_level !== nextLevel)) {
    throw new Error(`This PO needs Level ${nextLevel} approval next. Your approval level is ${approverUser ? approverUser.approval_level : 'unknown'}.`);
  }

  const isFinal = nextLevel >= po.required_level;
  db.prepare('INSERT INTO approval_history (module, record_id, level, action, approved_by) VALUES (?, ?, ?, ?, ?)')
    .run('po', poId, nextLevel, 'Approved', userId);
  db.prepare('UPDATE purchase_orders SET current_level = ?, status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(nextLevel, isFinal ? 'Approved' : 'Submitted', userId, poId);
  logAudit(userId, isFinal ? 'Fully Approved' : `Approved (Level ${nextLevel})`, 'po', poId, { status: po.status }, { status: isFinal ? 'Approved' : 'Submitted', level: nextLevel });
  return { isFinal, newLevel: nextLevel, requiredLevel: po.required_level };
}

app.put('/api/purchase/purchase-orders/:id/submit', verifyToken, (req, res) => {
  try {
    const po = db.prepare('SELECT grand_total FROM purchase_orders WHERE id = ?').get(req.params.id);
    const requiredLevel = computePORequiredLevel(po ? po.grand_total : 0);
    db.prepare('UPDATE purchase_orders SET status = ?, current_level = 0, required_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('Submitted', requiredLevel, req.params.id);
    res.json({ message: `PO submitted successfully (requires ${requiredLevel} approval level${requiredLevel > 1 ? 's' : ''})` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/purchase/purchase-orders/:id/approve', verifyToken, (req, res) => {
  const doApprove = db.transaction(() => approvePOAtNextLevel(req.params.id, req.userId, req.userRole));
  try {
    const { isFinal, newLevel, requiredLevel } = doApprove();
    res.json({ message: isFinal ? 'PO fully approved' : `Level ${newLevel} of ${requiredLevel} approved — awaiting next level` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Generic status updater used by the frontend "Submit"/"Approve" actions on the PO list
app.put('/api/purchase/purchase-orders/:id/status', verifyToken, (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });

    if (status === 'Approved') {
      // This is the button the UI actually wires up for approval — route it
      // through the same hierarchy-enforcing logic as /approve above so a
      // Level 1 approver can't just call this endpoint to finalize a PO
      // that needs 3 levels.
      const doApprove = db.transaction(() => approvePOAtNextLevel(req.params.id, req.userId, req.userRole));
      const { isFinal, newLevel, requiredLevel } = doApprove();
      return res.json({ message: isFinal ? 'PO fully approved' : `Level ${newLevel} of ${requiredLevel} approved — awaiting next level` });
    }

    if (status === 'Submitted') {
      const po = db.prepare('SELECT grand_total FROM purchase_orders WHERE id = ?').get(req.params.id);
      const requiredLevel = computePORequiredLevel(po ? po.grand_total : 0);
      db.prepare('UPDATE purchase_orders SET status = ?, current_level = 0, required_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, requiredLevel, req.params.id);
      return res.json({ message: `PO status updated to ${status} (requires ${requiredLevel} approval level${requiredLevel > 1 ? 's' : ''})` });
    }

    db.prepare('UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    res.json({ message: `PO status updated to ${status}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== GRN ROUTES =====
app.get('/api/purchase/grn', verifyToken, (req, res) => {
  try {
    const grns = db.prepare(`
      SELECT g.*, po.po_number, v.vendor_name,
             gas.status as accounts_status,
             gas.submitted_at as accounts_submitted_at,
             gas.acknowledged_at as accounts_acknowledged_at,
             au.full_name as accounts_acknowledged_by_name
      FROM grn g
      LEFT JOIN purchase_orders po ON g.po_id = po.id
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN grn_accounts_submissions gas ON gas.grn_id = g.id
      LEFT JOIN users au ON gas.acknowledged_by = au.id
      ORDER BY g.grn_date DESC
    `).all();
    res.json(grns || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full traceability record for one GRN — GRN header, the PO it was raised
// against (with who approved it and when), the indent that PO originated
// from if any (with who approved that too), and every line item's QC
// outcome. This is what the print view is built from.
app.get('/api/purchase/grn/:id', verifyToken, (req, res) => {
  try {
    const grn = db.prepare(`
      SELECT g.*, u.full_name as created_by_name
      FROM grn g
      LEFT JOIN users u ON g.created_by = u.id
      WHERE g.id = ?
    `).get(req.params.id);
    if (!grn) return res.status(404).json({ error: 'GRN not found' });

    grn.warehouse = db.prepare('SELECT warehouse_name, warehouse_code FROM warehouses WHERE id = ?').get(grn.warehouse_id);

    grn.po = db.prepare(`
      SELECT po.*, v.vendor_name, v.vendor_code, v.gst_number,
             cu.full_name as created_by_name, au.full_name as approved_by_name
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN users cu ON po.created_by = cu.id
      LEFT JOIN users au ON po.approved_by = au.id
      WHERE po.id = ?
    `).get(grn.po_id);
    if (grn.po) {
      grn.po.approval_history = db.prepare(`
        SELECT ah.*, u.full_name as approved_by_name
        FROM approval_history ah LEFT JOIN users u ON ah.approved_by = u.id
        WHERE ah.module = 'po' AND ah.record_id = ? ORDER BY ah.level ASC
      `).all(grn.po_id);
    }

    // Was this PO generated from an indent? If so, pull the indent's own
    // approval trail too, so the print shows the whole cycle.
    const mapping = db.prepare('SELECT * FROM indent_po_mapping WHERE po_id = ? ORDER BY id DESC LIMIT 1').get(grn.po_id);
    if (mapping) {
      grn.indent = db.prepare(`
        SELECT i.*, ru.full_name as requested_by_name, au.full_name as approved_by_name
        FROM indents i
        LEFT JOIN users ru ON i.requested_by = ru.id
        LEFT JOIN users au ON i.approved_by = au.id
        WHERE i.id = ?
      `).get(mapping.indent_id);
      if (grn.indent) {
        grn.indent.approval_history = db.prepare(`
          SELECT ah.*, u.full_name as approved_by_name
          FROM approval_history ah LEFT JOIN users u ON ah.approved_by = u.id
          WHERE ah.module = 'indent' AND ah.record_id = ? ORDER BY ah.level ASC
        `).all(mapping.indent_id);
      }
    } else {
      grn.indent = null;
    }

    grn.items = db.prepare(`
      SELECT gi.*, poi.material_id, poi.unit_price, m.material_name, m.material_code, m.unit_of_measure,
             qi.quantity_passed, qi.quantity_hold, qi.quantity_rejected, qi.status as qc_status,
             qi.remarks as qc_remarks, qi.inspection_date, iu.full_name as inspected_by_name
      FROM grn_items gi
      LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
      LEFT JOIN materials m ON poi.material_id = m.id
      LEFT JOIN quality_inspections qi ON qi.grn_item_id = gi.id
      LEFT JOIN users iu ON qi.inspected_by = iu.id
      WHERE gi.grn_id = ?
    `).all(req.params.id);

    res.json(grn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchase/grn', verifyToken, (req, res) => {
  const createGRN = db.transaction((body, userId) => {
    const { po_id, warehouse_id, notes, items = [] } = body;
    const grn_number = nextSerial('grn');

    // Default to the main warehouse if the frontend didn't collect one
    let whId = warehouse_id;
    if (!whId) {
      const wh = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get();
      whId = wh ? wh.id : null;
    }
    if (!whId) throw new Error('No warehouse available to receive stock into');

    let total_amount = 0;
    let inspectionsCreated = 0;
    const result = db.prepare(
      'INSERT INTO grn (grn_number, po_id, warehouse_id, notes, status, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(grn_number, po_id, whId, notes, 'Completed', userId);
    const grnId = result.lastInsertRowid;

    const insertGRNItem = db.prepare(
      'INSERT INTO grn_items (grn_id, po_item_id, received_quantity, rejected_quantity, batch_number, heat_number, coil_number, serial_number, expiry_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const updatePOItemReceived = db.prepare(
      'UPDATE purchase_order_items SET received_quantity = received_quantity + ? WHERE id = ?'
    );
    const getPOItem = db.prepare('SELECT * FROM purchase_order_items WHERE id = ?');
    const getMaterial = db.prepare('SELECT * FROM materials WHERE id = ?');
    const insertInspection = db.prepare(
      'INSERT INTO quality_inspections (inspection_number, grn_id, grn_item_id, material_id, warehouse_id, quantity_received, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    for (const item of items) {
      const receivedQty = parseFloat(item.received_quantity) || 0;
      const rejectedQty = parseFloat(item.rejected_quantity) || 0;
      if (receivedQty <= 0 && rejectedQty <= 0) continue;

      const grnItemResult = insertGRNItem.run(
        grnId, item.po_item_id, receivedQty, rejectedQty,
        item.batch_number || null, item.heat_number || null, item.coil_number || null, item.serial_number || null,
        item.expiry_date || null, item.notes || null
      );
      updatePOItemReceived.run(receivedQty, item.po_item_id);

      const poItem = getPOItem.get(item.po_item_id);
      if (poItem && receivedQty > 0) {
        total_amount += receivedQty * poItem.unit_price;
        const material = getMaterial.get(poItem.material_id);

        // KEY CHANGE (finishing the procure-to-stock chain): received
        // quantity used to go straight into usable stock. It now goes into
        // qc_pending_stock and waits for an inspection result before it can
        // be issued to production or anywhere else — unless the material is
        // explicitly flagged as not requiring QC.
        if (material && material.qc_required === 0) {
          addStockBatch(poItem.material_id, whId, receivedQty, {
            batch_number: item.batch_number, heat_number: item.heat_number, coil_number: item.coil_number, serial_number: item.serial_number,
            unit_cost: poItem.unit_price, expiry_date: item.expiry_date, source: 'GRN', source_reference: grn_number
          });
        } else {
          addToQCPending(poItem.material_id, whId, receivedQty);
          const inspection_number = `QC-${grnId}-${grnItemResult.lastInsertRowid}`;
          insertInspection.run(inspection_number, grnId, grnItemResult.lastInsertRowid, poItem.material_id, whId, receivedQty, 'Pending');
          inspectionsCreated++;
        }
      }
    }

    db.prepare('UPDATE grn SET total_amount = ? WHERE id = ?').run(total_amount, grnId);

    // If every item on the PO has been fully received, close the PO out.
    // This tracks physical receipt from the vendor, independent of whether
    // QC has cleared the goods yet.
    const poItems = db.prepare('SELECT quantity, received_quantity FROM purchase_order_items WHERE po_id = ?').all(po_id);
    const fullyReceived = poItems.length > 0 && poItems.every(i => i.received_quantity >= i.quantity);
    db.prepare('UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(fullyReceived ? 'Received' : 'Partially Received', po_id);

    // Requested feature: as soon as goods are received, the vendor is owed
    // money for them — record that as a pending invoice automatically so
    // Accounts doesn't have to remember to create one manually, and can go
    // straight to processing a payment voucher against it.
    let autoInvoiceNumber = null;
    if (total_amount > 0) {
      const po = db.prepare('SELECT vendor_id FROM purchase_orders WHERE id = ?').get(po_id);
      const vendor = po ? db.prepare('SELECT payment_terms FROM vendors WHERE id = ?').get(po.vendor_id) : null;
      // payment_terms is free text (e.g. "Net 30", "45 days"); pull the
      // first number out of it if present, otherwise default to 30 days.
      const termsMatch = vendor && vendor.payment_terms ? vendor.payment_terms.match(/\d+/) : null;
      const daysUntilDue = termsMatch ? parseInt(termsMatch[0]) : 30;
      const invoiceDate = new Date();
      const dueDate = new Date(invoiceDate.getTime() + daysUntilDue * 24 * 60 * 60 * 1000);

      autoInvoiceNumber = nextSerial('invoice');
      db.prepare(
        'INSERT INTO vendor_invoices (invoice_number, po_id, vendor_id, invoice_date, due_date, status, total_amount, grand_total, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(autoInvoiceNumber, po_id, po.vendor_id, invoiceDate.toISOString().split('T')[0], dueDate.toISOString().split('T')[0], 'Pending', total_amount, total_amount, `Auto-generated on receipt of GRN ${grn_number}`);
    }

    return { grn_number, id: grnId, inspectionsCreated, autoInvoiceNumber };
  });

  try {
    const { grn_number, id, inspectionsCreated, autoInvoiceNumber } = createGRN(req.body, req.userId);
    const parts = [];
    if (inspectionsCreated > 0) parts.push(`${inspectionsCreated} item(s) sent to Quality Inspection before they can be used`);
    if (autoInvoiceNumber) parts.push(`Vendor invoice ${autoInvoiceNumber} recorded as pending payment`);
    res.status(201).json({
      grn_number,
      id,
      message: parts.length > 0 ? `GRN created successfully. ${parts.join('. ')}.` : 'GRN created successfully'
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function isGRNCycleComplete(grnId) {
  const items = db.prepare(`
    SELECT gi.received_quantity, gi.rejected_quantity, m.qc_required,
           qi.status as qc_status, qi.quantity_hold
    FROM grn_items gi
    LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
    LEFT JOIN materials m ON poi.material_id = m.id
    LEFT JOIN quality_inspections qi ON qi.grn_item_id = gi.id
    WHERE gi.grn_id = ?
  `).all(grnId);
  if (!items.length) return false;
  return items.every(item => {
    const netReceived = (parseFloat(item.received_quantity) || 0) - (parseFloat(item.rejected_quantity) || 0);
    if (netReceived <= 0) return true;
    if (!item.qc_required) return true;
    return item.qc_status === 'Completed' && (parseFloat(item.quantity_hold) || 0) <= 0;
  });
}

app.post('/api/purchase/grn/:id/submit-accounts', verifyToken, (req, res) => {
  try {
    const grn = db.prepare('SELECT * FROM grn WHERE id = ?').get(req.params.id);
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    if (!isGRNCycleComplete(req.params.id)) {
      return res.status(400).json({ error: 'GRN cycle is not complete yet. Finish QC and clear holds before sending to Accounts.' });
    }
    const existing = db.prepare('SELECT * FROM grn_accounts_submissions WHERE grn_id = ?').get(req.params.id);
    if (existing) return res.json({ message: 'GRN copy has already been submitted to Accounts' });
    db.prepare(`
      INSERT INTO grn_accounts_submissions (grn_id, submitted_by, remarks)
      VALUES (?, ?, ?)
    `).run(req.params.id, req.userId, req.body?.remarks || null);
    res.status(201).json({ message: 'GRN copy submitted to Accounts' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/accounts/grn-submissions', verifyToken, (req, res) => {
  try {
    const date = req.query.date || null;
    const where = date ? "WHERE date(s.submitted_at) = date(@date)" : '';
    const rows = db.prepare(`
      SELECT s.*, g.grn_number, g.grn_date, g.total_amount, po.po_number, v.vendor_name,
             su.full_name as submitted_by_name, au.full_name as acknowledged_by_name
      FROM grn_accounts_submissions s
      JOIN grn g ON s.grn_id = g.id
      LEFT JOIN purchase_orders po ON g.po_id = po.id
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN users su ON s.submitted_by = su.id
      LEFT JOIN users au ON s.acknowledged_by = au.id
      ${where}
      ORDER BY s.submitted_at DESC
    `).all({ date });
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/accounts/grn-submissions/:id/acknowledge', verifyToken, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM grn_accounts_submissions WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Submission not found' });
    if (row.status === 'Acknowledged') return res.json({ message: 'Already acknowledged' });
    db.prepare(`
      UPDATE grn_accounts_submissions
      SET status = 'Acknowledged', acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP,
          remarks = COALESCE(?, remarks)
      WHERE id = ?
    `).run(req.userId, req.body?.remarks || null, req.params.id);
    res.json({ message: 'GRN receipt acknowledged' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== INCOMING QUALITY CONTROL =====
const QC_INSPECTION_SELECT = `
  SELECT qi.*, m.material_name, m.material_code, m.unit_of_measure,
         w.warehouse_name, g.grn_number, po.po_number, v.vendor_name,
         u.full_name as inspected_by_name
  FROM quality_inspections qi
  LEFT JOIN materials m ON qi.material_id = m.id
  LEFT JOIN warehouses w ON qi.warehouse_id = w.id
  LEFT JOIN grn g ON qi.grn_id = g.id
  LEFT JOIN purchase_orders po ON g.po_id = po.id
  LEFT JOIN vendors v ON po.vendor_id = v.id
  LEFT JOIN users u ON qi.inspected_by = u.id
`;

app.get('/api/quality/pending', verifyToken, (req, res) => {
  try {
    const inspections = db.prepare(`${QC_INSPECTION_SELECT} WHERE qi.status IN ('Pending', 'Partial') ORDER BY qi.created_at ASC`).all();
    res.json(inspections || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/quality/inspections', verifyToken, (req, res) => {
  try {
    const inspections = db.prepare(`${QC_INSPECTION_SELECT} ORDER BY qi.created_at DESC`).all();
    res.json(inspections || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/quality/hold', verifyToken, (req, res) => {
  try {
    const holds = db.prepare(`
      SELECT h.*, m.material_name, m.material_code, m.unit_of_measure, w.warehouse_name
      FROM qc_hold_stock h
      LEFT JOIN materials m ON h.material_id = m.id
      LEFT JOIN warehouses w ON h.warehouse_id = w.id
      WHERE h.quantity > 0
      ORDER BY m.material_name
    `).all();
    res.json(holds || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record an inspection result against a GRN line item. Can be called more
// than once for the same line (e.g. inspecting in batches) — quantities
// accumulate and the pending bucket shrinks each time, until the full
// received quantity has been accounted for.
app.post('/api/quality/inspections/:id/result', verifyToken, (req, res) => {
  const recordResult = db.transaction((inspectionId, body, userId) => {
    const inspection = db.prepare('SELECT * FROM quality_inspections WHERE id = ?').get(inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    const passQty = parseFloat(body.quantity_passed) || 0;
    const holdQty = parseFloat(body.quantity_hold) || 0;
    const rejectQty = parseFloat(body.quantity_rejected) || 0;
    if (passQty < 0 || holdQty < 0 || rejectQty < 0) throw new Error('Quantities cannot be negative');
    const decidedNow = passQty + holdQty + rejectQty;
    if (decidedNow <= 0) throw new Error('Enter at least one of passed / hold / rejected quantity');

    const alreadyDecided = inspection.quantity_passed + inspection.quantity_hold + inspection.quantity_rejected;
    const remaining = inspection.quantity_received - alreadyDecided;
    if (decidedNow > remaining + 0.0001) {
      throw new Error(`Only ${remaining} remains to be inspected on this item`);
    }

    // Move stock out of the pending bucket into the right destination.
    addToQCPending(inspection.material_id, inspection.warehouse_id, -decidedNow);
    if (passQty > 0) {
      // Carry over the batch identifiers captured when this was received,
      // so passed stock stays traceable back to its GRN line and cost.
      const grnItem = db.prepare('SELECT * FROM grn_items WHERE id = ?').get(inspection.grn_item_id);
      const grn = db.prepare('SELECT grn_number FROM grn WHERE id = ?').get(inspection.grn_id);
      const poItem = grnItem ? db.prepare('SELECT unit_price FROM purchase_order_items WHERE id = ?').get(grnItem.po_item_id) : null;
      addStockBatch(inspection.material_id, inspection.warehouse_id, passQty, {
        batch_number: grnItem?.batch_number, heat_number: grnItem?.heat_number, coil_number: grnItem?.coil_number, serial_number: grnItem?.serial_number,
        unit_cost: poItem?.unit_price, expiry_date: grnItem?.expiry_date, source: 'GRN (QC Passed)', source_reference: grn?.grn_number
      });
    }
    if (holdQty > 0) addToQCHold(inspection.material_id, inspection.warehouse_id, holdQty);
    // Rejected quantity leaves the premises' usable/pending stock entirely;
    // it's tracked on the inspection record for traceability but isn't put
    // into any stock bucket (return-to-vendor / scrap is a separate,
    // physical follow-up process).

    const newPassed = inspection.quantity_passed + passQty;
    const newHold = inspection.quantity_hold + holdQty;
    const newRejected = inspection.quantity_rejected + rejectQty;
    const newStatus = (newPassed + newHold + newRejected) >= inspection.quantity_received ? 'Completed' : 'Partial';
    const remarks = body.remarks ? (inspection.remarks ? inspection.remarks + ' | ' + body.remarks : body.remarks) : inspection.remarks;

    db.prepare(
      'UPDATE quality_inspections SET quantity_passed = ?, quantity_hold = ?, quantity_rejected = ?, status = ?, remarks = ?, inspected_by = ?, inspection_date = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(newPassed, newHold, newRejected, newStatus, remarks, userId, inspectionId);

    return newStatus;
  });

  try {
    const status = recordResult(req.params.id, req.body, req.userId);
    res.json({ message: `Inspection result recorded (${status})` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Dispositions material sitting on hold — the rework/CAPA outcome: either it
// passes after rework (into usable stock) or is written off (rejected).
app.put('/api/quality/hold/:materialId/:warehouseId/release', verifyToken, (req, res) => {
  try {
    const { materialId, warehouseId } = req.params;
    const { quantity, disposition, remarks } = req.body;
    const qty = parseFloat(quantity) || 0;
    if (qty <= 0) return res.status(400).json({ error: 'quantity must be greater than 0' });
    if (!['pass', 'reject'].includes(disposition)) return res.status(400).json({ error: "disposition must be 'pass' or 'reject'" });

    const hold = db.prepare('SELECT * FROM qc_hold_stock WHERE material_id = ? AND warehouse_id = ?').get(materialId, warehouseId);
    if (!hold || hold.quantity < qty) return res.status(400).json({ error: 'Not enough quantity on hold' });

    addToQCHold(materialId, warehouseId, -qty);
    if (disposition === 'pass') {
      addStockBatch(materialId, warehouseId, qty, { source: 'QC Hold Release', source_reference: remarks || null });
    }
    // On reject, the quantity simply leaves the hold bucket (written off).

    // Reflect the disposition on the most recent inspection record(s) for
    // this material/warehouse that still show quantity on hold, so the
    // history stays accurate.
    const relatedInspections = db.prepare(
      `SELECT * FROM quality_inspections WHERE material_id = ? AND warehouse_id = ? AND quantity_hold > 0 ORDER BY inspection_date DESC`
    ).all(materialId, warehouseId);
    let remainingToClear = qty;
    for (const insp of relatedInspections) {
      if (remainingToClear <= 0) break;
      const clearFromThis = Math.min(insp.quantity_hold, remainingToClear);
      const newHold = insp.quantity_hold - clearFromThis;
      const newPassed = disposition === 'pass' ? insp.quantity_passed + clearFromThis : insp.quantity_passed;
      const newRejected = disposition === 'reject' ? insp.quantity_rejected + clearFromThis : insp.quantity_rejected;
      const noteAppend = `Hold released (${disposition}): ${clearFromThis} — ${remarks || ''}`.trim();
      db.prepare('UPDATE quality_inspections SET quantity_hold = ?, quantity_passed = ?, quantity_rejected = ?, remarks = ? WHERE id = ?')
        .run(newHold, newPassed, newRejected, insp.remarks ? insp.remarks + ' | ' + noteAppend : noteAppend, insp.id);
      remainingToClear -= clearFromThis;
    }

    res.json({ message: `Hold released as ${disposition === 'pass' ? 'passed' : 'rejected'}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/purchase/invoices', verifyToken, (req, res) => {
  try {
    const invoices = db.prepare(`
      SELECT vi.*, po.po_number, v.vendor_name
      FROM vendor_invoices vi
      LEFT JOIN purchase_orders po ON vi.po_id = po.id
      LEFT JOIN vendors v ON vi.vendor_id = v.id
      ORDER BY vi.created_at DESC
    `).all();
    res.json(invoices || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchase/invoices', verifyToken, (req, res) => {
  try {
    const { po_id, vendor_id, invoice_date, due_date, total_amount, tax_amount, grand_total, notes } = req.body;
    const invoice_number = nextSerial('invoice');
    const result = db.prepare(
      'INSERT INTO vendor_invoices (invoice_number, po_id, vendor_id, invoice_date, due_date, total_amount, tax_amount, grand_total, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(invoice_number, po_id, vendor_id, invoice_date, due_date, total_amount || 0, tax_amount || 0, grand_total || total_amount || 0, notes);
    res.status(201).json({ invoice_number, id: result.lastInsertRowid, message: 'Invoice created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/purchase/invoices/:id/status', verifyToken, (req, res) => {
  try {
    const { status, paid_amount } = req.body;
    if (paid_amount !== null && paid_amount !== undefined) {
      db.prepare('UPDATE vendor_invoices SET status = ?, paid_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, paid_amount, req.params.id);
    } else {
      db.prepare('UPDATE vendor_invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, req.params.id);
    }
    res.json({ message: 'Invoice status updated' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/purchase/invoices/:id', verifyToken, (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT vi.*, po.po_number, v.vendor_name, v.bank_name, v.bank_account, v.ifsc_code
      FROM vendor_invoices vi
      LEFT JOIN purchase_orders po ON vi.po_id = po.id
      LEFT JOIN vendors v ON vi.vendor_id = v.id
      WHERE vi.id = ?
    `).get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    invoice.vouchers = db.prepare(`
      SELECT pv.*, u.full_name as created_by_name
      FROM payment_vouchers pv LEFT JOIN users u ON pv.created_by = u.id
      WHERE pv.invoice_id = ? ORDER BY pv.payment_date DESC
    `).all(req.params.id);
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Processes a payment against an invoice: records the voucher and updates
// the invoice's paid_amount/status (Pending -> Partially Paid -> Paid).
app.post('/api/purchase/invoices/:id/vouchers', verifyToken, (req, res) => {
  const processPayment = db.transaction((invoiceId, body, userId) => {
    const invoice = db.prepare('SELECT * FROM vendor_invoices WHERE id = ?').get(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const amount = parseFloat(body.amount) || 0;
    if (amount <= 0) throw new Error('Payment amount must be greater than 0');
    const remaining = invoice.grand_total - invoice.paid_amount;
    if (amount > remaining + 0.01) throw new Error(`Payment exceeds the outstanding balance of ${remaining.toFixed(2)}`);
    if (!body.payment_mode) throw new Error('Payment mode is required');

    const voucher_number = nextSerial('voucher');
    db.prepare(
      'INSERT INTO payment_vouchers (voucher_number, invoice_id, amount, payment_date, payment_mode, reference_number, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(voucher_number, invoiceId, amount, body.payment_date || new Date().toISOString().split('T')[0], body.payment_mode, body.reference_number || null, body.remarks || null, userId);

    const newPaid = invoice.paid_amount + amount;
    const newStatus = newPaid >= invoice.grand_total - 0.01 ? 'Paid' : 'Partially Paid';
    db.prepare('UPDATE vendor_invoices SET paid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newPaid, newStatus, invoiceId);

    return { voucher_number, newStatus, newPaid };
  });

  try {
    const { voucher_number, newStatus, newPaid } = processPayment(req.params.id, req.body, req.userId);
    res.status(201).json({ voucher_number, message: `Payment recorded. Invoice is now ${newStatus} (₹${newPaid} paid).` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== INVENTORY - WAREHOUSES =====
app.get('/api/inventory/warehouses', verifyToken, (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM warehouses WHERE is_active = 1 ORDER BY warehouse_name').all() || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory/warehouses', verifyToken, (req, res) => {
  try {
    const { warehouse_code, warehouse_name, location } = req.body;
    const result = db.prepare('INSERT INTO warehouses (warehouse_code, warehouse_name, location) VALUES (?, ?, ?)')
      .run(warehouse_code, warehouse_name, location);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Warehouse created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== INVENTORY - STOCK LEDGER =====
app.get('/api/inventory/ledger', verifyToken, (req, res) => {
  try {
    const ledger = db.prepare(`
      SELECT sl.*, m.material_name, m.material_code, m.category, m.reorder_level, m.unit_of_measure, w.warehouse_name
      FROM stock_ledger sl
      LEFT JOIN materials m ON sl.material_id = m.id
      LEFT JOIN warehouses w ON sl.warehouse_id = w.id
      ORDER BY m.category, m.material_name
    `).all();
    res.json(ledger || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/inventory/ledger/low-stock', verifyToken, (req, res) => {
  try {
    // BUG FIX: this used to compare sl.quantity against m.reorder_level per
    // warehouse row, so a material split across two warehouses (each under
    // reorder level individually) could still total up to plenty of stock
    // and vice versa. Now compares the material's total across all
    // warehouses, which is what "low stock" should mean.
    const lowStock = db.prepare(`
      SELECT m.id as material_id, m.material_name, m.material_code, m.category, m.unit_of_measure, m.reorder_level,
             COALESCE(SUM(sl.quantity), 0) as total_quantity
      FROM materials m
      LEFT JOIN stock_ledger sl ON sl.material_id = m.id
      WHERE m.is_active = 1
      GROUP BY m.id
      HAVING total_quantity < m.reorder_level
      ORDER BY m.category, m.material_name
    `).all();
    res.json(lowStock || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// "Complete stock, category-wise" — one row per material (summed across
// warehouses) with category, plus what's still stuck in QC so the real
// picture (usable vs. in-transit-through-QC) is visible in one place.
app.get('/api/inventory/stock-summary', verifyToken, (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT m.id as material_id, m.material_code, m.material_name,
             COALESCE(m.category, 'Uncategorized') as category, m.unit_of_measure, m.reorder_level,
             COALESCE((SELECT SUM(sl.quantity) FROM stock_ledger sl WHERE sl.material_id = m.id), 0) as available_quantity,
             COALESCE((SELECT SUM(qp.quantity) FROM qc_pending_stock qp WHERE qp.material_id = m.id), 0) as qc_pending_quantity,
             COALESCE((SELECT SUM(qh.quantity) FROM qc_hold_stock qh WHERE qh.material_id = m.id), 0) as qc_hold_quantity
      FROM materials m
      WHERE m.is_active = 1
      ORDER BY category, m.material_name
    `).all();
    res.json(summary || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== INVENTORY - STOCK VALUATION =====
app.get('/api/inventory/valuation', verifyToken, (req, res) => {
  try {
    // Weighted-average unit cost per material, from stock-in history
    const valuation = db.prepare(`
      SELECT sl.material_id, m.material_name, m.material_code, w.warehouse_name, sl.quantity,
             COALESCE((
               SELECT SUM(si.quantity * si.unit_cost) / NULLIF(SUM(si.quantity), 0)
               FROM stock_in si WHERE si.material_id = sl.material_id
             ), 0) AS avg_unit_cost
      FROM stock_ledger sl
      LEFT JOIN materials m ON sl.material_id = m.id
      LEFT JOIN warehouses w ON sl.warehouse_id = w.id
    `).all().map(row => ({ ...row, total_value: row.quantity * row.avg_unit_cost }));
    res.json(valuation || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== INVENTORY - BATCH/LOT/HEAT/COIL/SERIAL TRACEABILITY =====
app.get('/api/inventory/batches', verifyToken, (req, res) => {
  try {
    const { material_id, warehouse_id } = req.query;
    let query = `
      SELECT sb.*, m.material_name, m.material_code, m.unit_of_measure, w.warehouse_name
      FROM stock_batches sb
      LEFT JOIN materials m ON sb.material_id = m.id
      LEFT JOIN warehouses w ON sb.warehouse_id = w.id
      WHERE sb.quantity_remaining > 0
    `;
    const params = [];
    if (material_id) { query += ' AND sb.material_id = ?'; params.push(material_id); }
    if (warehouse_id) { query += ' AND sb.warehouse_id = ?'; params.push(warehouse_id); }
    query += ' ORDER BY sb.received_date ASC';
    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stock aging — every batch still on hand, bucketed by how long it's sat
// in stock since receipt.
app.get('/api/inventory/aging', verifyToken, (req, res) => {
  try {
    const batches = db.prepare(`
      SELECT sb.*, m.material_name, m.material_code, m.unit_of_measure, w.warehouse_name,
             CAST(julianday('now') - julianday(sb.received_date) AS INTEGER) as age_days
      FROM stock_batches sb
      LEFT JOIN materials m ON sb.material_id = m.id
      LEFT JOIN warehouses w ON sb.warehouse_id = w.id
      WHERE sb.quantity_remaining > 0
      ORDER BY age_days DESC
    `).all();
    const bucketOf = (days) => days <= 30 ? '0-30 days' : days <= 60 ? '31-60 days' : days <= 90 ? '61-90 days' : '90+ days';
    res.json(batches.map(b => ({ ...b, age_bucket: bucketOf(b.age_days) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Slow-moving / dead stock — materials with stock on hand but no outward
// movement (stock-out, transfer-out, or production allocation) within the
// given window. ?days=90 (slow-moving default) or ?days=180 (dead stock).
app.get('/api/inventory/movement-report', verifyToken, (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const rows = db.prepare(`
      SELECT m.id as material_id, m.material_name, m.material_code, m.unit_of_measure,
             COALESCE(SUM(sl.quantity), 0) as current_stock,
             (
               SELECT MAX(x.dt) FROM (
                 SELECT MAX(issued_date) as dt FROM stock_out WHERE material_id = m.id
                 UNION ALL SELECT MAX(transfer_date) FROM stock_transfer WHERE material_id = m.id
                 UNION ALL SELECT MAX(allocation_date) FROM production_allocation WHERE material_id = m.id
               ) x
             ) as last_movement_date
      FROM materials m
      LEFT JOIN stock_ledger sl ON sl.material_id = m.id
      WHERE m.is_active = 1
      GROUP BY m.id
      HAVING current_stock > 0
    `).all();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const flagged = rows.filter(r => !r.last_movement_date || new Date(r.last_movement_date) < cutoff)
      .map(r => ({ ...r, days_since_movement: r.last_movement_date ? Math.floor((Date.now() - new Date(r.last_movement_date)) / 86400000) : null }));
    res.json(flagged);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/inventory/adjustment', verifyToken, (req, res) => {
  try {
    const adjustments = db.prepare(`
      SELECT sa.*, m.material_name, w.warehouse_name
      FROM stock_adjustment sa
      LEFT JOIN materials m ON sa.material_id = m.id
      LEFT JOIN warehouses w ON sa.warehouse_id = w.id
      ORDER BY sa.created_at DESC
    `).all();
    res.json(adjustments || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory/adjustment', verifyToken, (req, res) => {
  try {
    const { material_id, warehouse_id, quantity_after, reason } = req.body;
    const ledger = db.prepare('SELECT quantity FROM stock_ledger WHERE material_id = ? AND warehouse_id = ?').get(material_id, warehouse_id);
    const quantity_before = ledger ? ledger.quantity : 0;
    const difference = parseFloat(quantity_after) - quantity_before;
    const adjustment_number = nextSerial('adjustment');

    const result = db.prepare(
      'INSERT INTO stock_adjustment (adjustment_number, material_id, warehouse_id, quantity_before, quantity_after, difference, reason, status, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(adjustment_number, material_id, warehouse_id, quantity_before, quantity_after, difference, reason, 'Pending', req.userId);

    res.status(201).json({ adjustment_number, id: result.lastInsertRowid, message: 'Adjustment requested, pending approval' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/inventory/adjustment/:id/approve', verifyToken, (req, res) => {
  const doApprove = db.transaction((id, userId) => {
    const adj = db.prepare('SELECT * FROM stock_adjustment WHERE id = ?').get(id);
    if (!adj) throw new Error('Adjustment not found');

    if (adj.difference > 0) {
      addStockBatch(adj.material_id, adj.warehouse_id, adj.difference, { source: 'Adjustment', source_reference: adj.adjustment_number });
    } else if (adj.difference < 0) {
      consumeStock(adj.material_id, adj.warehouse_id, Math.abs(adj.difference));
    }
    db.prepare('UPDATE stock_adjustment SET status = ?, approved_by = ? WHERE id = ?').run('Approved', userId, id);
  });

  try {
    doApprove(req.params.id, req.userId);
    res.json({ message: 'Adjustment approved and applied to stock ledger' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== INVENTORY - STOCK IN =====
app.post('/api/inventory/stock-in', verifyToken, (req, res) => {
  try {
    const { material_id, warehouse_id, quantity, unit_cost, source, batch_number, heat_number, coil_number, serial_number, expiry_date } = req.body;
    const stock_in_number = nextSerial('stock_in');

    db.prepare(
      'INSERT INTO stock_in (stock_in_number, material_id, warehouse_id, quantity, unit_cost, source, batch_number, heat_number, coil_number, serial_number, expiry_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(stock_in_number, material_id, warehouse_id, quantity, unit_cost, source, batch_number, heat_number, coil_number, serial_number, expiry_date, 'Completed');

    addStockBatch(material_id, warehouse_id, parseFloat(quantity), {
      batch_number, heat_number, coil_number, serial_number, unit_cost, expiry_date, source: 'Stock In', source_reference: stock_in_number
    });

    res.status(201).json({ stock_in_number, message: 'Stock recorded successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/inventory/stock-in', verifyToken, (req, res) => {
  try {
    const stocks = db.prepare(`
      SELECT si.*, m.material_name, w.warehouse_name
      FROM stock_in si
      LEFT JOIN materials m ON si.material_id = m.id
      LEFT JOIN warehouses w ON si.warehouse_id = w.id
      ORDER BY si.received_date DESC
    `).all();
    res.json(stocks || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== INVENTORY - STOCK OUT =====
app.post('/api/inventory/stock-out', verifyToken, (req, res) => {
  const doStockOut = db.transaction((body, userId) => {
    const { material_id, warehouse_id, quantity, purpose, issued_to, remarks } = body;
    const stock_out_number = nextSerial('stock_out');
    const qty = parseFloat(quantity);

    const ledger = db.prepare('SELECT quantity FROM stock_ledger WHERE material_id = ? AND warehouse_id = ?').get(material_id, warehouse_id);
    if (!ledger || ledger.quantity < qty) {
      throw new Error('Insufficient stock available');
    }

    db.prepare(
      'INSERT INTO stock_out (stock_out_number, material_id, warehouse_id, quantity, purpose, issued_to, remarks, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(stock_out_number, material_id, warehouse_id, qty, purpose, issued_to, remarks, 'Issued');

    // Consume from traceable batches (FIFO) where they exist, or fall back
    // to a plain ledger decrement for stock that predates batch tracking.
    consumeStock(material_id, warehouse_id, qty);

    return stock_out_number;
  });

  try {
    const stock_out_number = doStockOut(req.body, req.userId);
    res.status(201).json({ stock_out_number, message: 'Stock out recorded successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/inventory/stock-out', verifyToken, (req, res) => {
  try {
    const stocks = db.prepare(`
      SELECT so.*, m.material_name, w.warehouse_name
      FROM stock_out so
      LEFT JOIN materials m ON so.material_id = m.id
      LEFT JOIN warehouses w ON so.warehouse_id = w.id
      ORDER BY so.issued_date DESC
    `).all();
    res.json(stocks || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== INVENTORY - STOCK TRANSFER =====
app.post('/api/inventory/transfer', verifyToken, (req, res) => {
  const doTransfer = db.transaction((body) => {
    const { material_id, from_warehouse_id, to_warehouse_id, quantity, remarks } = body;
    const qty = parseFloat(quantity);
    const transfer_number = nextSerial('transfer');

    const ledger = db.prepare('SELECT quantity FROM stock_ledger WHERE material_id = ? AND warehouse_id = ?').get(material_id, from_warehouse_id);
    if (!ledger || ledger.quantity < qty) {
      throw new Error('Insufficient stock in source warehouse');
    }

    // Consume from source via FIFO and remember exactly which batches were
    // drawn from, so receiving this transfer can recreate the same
    // batches (same heat/coil/serial numbers) in the destination.
    const consumedBatches = consumeStock(material_id, from_warehouse_id, qty);

    const result = db.prepare(
      'INSERT INTO stock_transfer (transfer_number, material_id, from_warehouse_id, to_warehouse_id, quantity, remarks, status, batch_details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(transfer_number, material_id, from_warehouse_id, to_warehouse_id, qty, remarks, 'In Transit', JSON.stringify(consumedBatches));

    return { transfer_number, id: result.lastInsertRowid };
  });

  try {
    const { transfer_number, id } = doTransfer(req.body);
    res.status(201).json({ transfer_number, transfer_id: id, message: 'Transfer created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/inventory/transfer', verifyToken, (req, res) => {
  try {
    const transfers = db.prepare(`
      SELECT st.*, m.material_name, w1.warehouse_name as from_warehouse_name, w2.warehouse_name as to_warehouse_name
      FROM stock_transfer st
      LEFT JOIN materials m ON st.material_id = m.id
      LEFT JOIN warehouses w1 ON st.from_warehouse_id = w1.id
      LEFT JOIN warehouses w2 ON st.to_warehouse_id = w2.id
      ORDER BY st.transfer_date DESC
    `).all();
    res.json(transfers || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/inventory/transfer/:id/receive', verifyToken, (req, res) => {
  const doReceive = db.transaction((id) => {
    const transfer = db.prepare('SELECT * FROM stock_transfer WHERE id = ?').get(id);
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.status === 'Received') throw new Error('Transfer already received');

    db.prepare('UPDATE stock_transfer SET status = ?, received_date = CURRENT_TIMESTAMP WHERE id = ?').run('Received', id);

    // Recreate the exact batches that were sent (same heat/coil/serial),
    // falling back to one generic batch if this transfer predates batch
    // tracking or drew from untracked legacy stock.
    let batchDetails = [];
    try { batchDetails = transfer.batch_details ? JSON.parse(transfer.batch_details) : []; } catch (_) { batchDetails = []; }

    if (batchDetails.length > 0) {
      for (const b of batchDetails) {
        addStockBatch(transfer.material_id, transfer.to_warehouse_id, b.quantity_taken, {
          batch_number: b.batch_number, heat_number: b.heat_number, coil_number: b.coil_number, serial_number: b.serial_number,
          source: 'Transfer In', source_reference: transfer.transfer_number
        });
      }
    } else {
      addStockBatch(transfer.material_id, transfer.to_warehouse_id, transfer.quantity, { source: 'Transfer In', source_reference: transfer.transfer_number });
    }
  });

  try {
    doReceive(req.params.id);
    res.json({ message: 'Transfer received successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== INDENT ROUTES =====

// Reusable projection: material details + a live "available in store" figure
// (summed across all warehouses) + the requester's department, since the
// approver/purchaser UIs both expect these fields.
const INDENT_SELECT = `
  SELECT i.*, u.full_name as requested_by_name, u.department as requested_from_dept,
         a.full_name as approved_by_name,
         (SELECT COUNT(*) FROM indent_items ii WHERE ii.indent_id = i.id) as item_count,
         (SELECT GROUP_CONCAT(m.material_name, ', ') FROM indent_items ii LEFT JOIN materials m ON ii.material_id = m.id WHERE ii.indent_id = i.id) as item_summary
  FROM indents i
  LEFT JOIN users u ON i.requested_by = u.id
  LEFT JOIN users a ON i.approved_by = a.id
`;

function getIndentItems(indentId) {
  return db.prepare(`
    SELECT ii.*, m.material_name, m.material_code, m.unit_of_measure as material_uom,
           COALESCE((SELECT SUM(sl.quantity) FROM stock_ledger sl WHERE sl.material_id = ii.material_id), 0) AS quantity_available
    FROM indent_items ii
    LEFT JOIN materials m ON ii.material_id = m.id
    WHERE ii.indent_id = ?
    ORDER BY ii.id
  `).all(indentId);
}

app.post('/api/indent/create', verifyToken, (req, res) => {
  const create = db.transaction((body, userId) => {
    const { area_of_use, priority, required_by_date, justification, items = [] } = body;
    if (!items.length) throw new Error('Add at least one item to the indent');
    for (const it of items) {
      if (!it.material_id) throw new Error('Every item needs a material selected');
      if (!parseFloat(it.quantity_required) || parseFloat(it.quantity_required) <= 0) throw new Error('Every item needs a quantity greater than 0');
    }
    const indent_number = nextSerial('indent');
    const result = db.prepare(
      'INSERT INTO indents (indent_number, area_of_use, priority, required_by_date, justification, status, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(indent_number, area_of_use, priority || 'Normal', required_by_date || null, justification || null, 'Draft', userId);
    const id = result.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO indent_items (indent_id, material_id, quantity_required, unit_of_measure, material_type) VALUES (?, ?, ?, ?, ?)');
    for (const it of items) {
      insertItem.run(id, it.material_id, parseFloat(it.quantity_required), it.unit_of_measure || null, it.material_type || 'Raw Material');
    }
    return { indent_number, id };
  });
  try {
    const { indent_number, id } = create(req.body, req.userId);
    // BUG FIX (kept from before): the "raise indent" page reads `result.id`
    // right after creating one to immediately submit it for approval —
    // returning both `id` and `indent_id` keeps every caller working.
    res.status(201).json({ indent_number, indent_id: id, id, message: 'Indent created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Edit a Draft indent — this genuinely didn't exist before (only status
// transitions did), so a mistake on a not-yet-submitted indent had no fix
// but deleting it and starting over. Replaces the header fields and the
// full item list in one transaction; deliberately refuses once the indent
// has moved past Draft, since a Pending/Approved indent may already have
// RFQs or approvals riding on its current contents.
app.put('/api/indent/:id', verifyToken, (req, res) => {
  const update = db.transaction((indentId, body) => {
    const indent = db.prepare('SELECT * FROM indents WHERE id = ?').get(indentId);
    if (!indent) throw new Error('Indent not found');
    if (indent.status !== 'Draft') throw new Error(`This indent is ${indent.status} and can no longer be edited — only Draft indents can be changed.`);
    const { area_of_use, priority, required_by_date, justification, items = [] } = body;
    if (!items.length) throw new Error('Add at least one item to the indent');
    for (const it of items) {
      if (!it.material_id) throw new Error('Every item needs a material selected');
      if (!parseFloat(it.quantity_required) || parseFloat(it.quantity_required) <= 0) throw new Error('Every item needs a quantity greater than 0');
    }
    db.prepare('UPDATE indents SET area_of_use = ?, priority = ?, required_by_date = ?, justification = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(area_of_use, priority || 'Normal', required_by_date || null, justification || null, indentId);
    db.prepare('DELETE FROM indent_items WHERE indent_id = ?').run(indentId);
    const insertItem = db.prepare('INSERT INTO indent_items (indent_id, material_id, quantity_required, unit_of_measure, material_type) VALUES (?, ?, ?, ?, ?)');
    for (const it of items) {
      insertItem.run(indentId, it.material_id, parseFloat(it.quantity_required), it.unit_of_measure || null, it.material_type || 'Raw Material');
    }
  });
  try {
    update(req.params.id, req.body);
    res.json({ message: 'Indent updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// BUG FIX: the "Raise Indent" page calls GET /api/indent/my-indents to
// render its Draft/Pending/Approved tabs — this route never existed, so
// that fetch 404'd and .json() threw, meaning an employee could never even
// see their own indents, let alone confirm one reached approval.
app.get('/api/indent/my-indents', verifyToken, (req, res) => {
  try {
    const indents = db.prepare(`${INDENT_SELECT} WHERE i.requested_by = ? ORDER BY i.created_at DESC`).all(req.userId);
    res.json(indents || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approved indents ready for RFQ (used by the purchaser's RFQ screen).
app.get('/api/indent/approved', verifyToken, (req, res) => {
  try {
    const indents = db.prepare(`${INDENT_SELECT} WHERE i.status = 'Approved' ORDER BY i.approval_date DESC`).all();
    res.json(indents || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/indent/approval/pending', verifyToken, (req, res) => {
  try {
    const indents = db.prepare(`${INDENT_SELECT} WHERE i.status = 'Pending' ORDER BY i.created_at DESC`).all();
    res.json(indents || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Available-in-store lookup shown live on the "Raise Indent" form.
app.get('/api/indent/inventory/material/:materialId', verifyToken, (req, res) => {
  try {
    const row = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS quantity_available FROM stock_ledger WHERE material_id = ?').get(req.params.materialId);
    res.json(row || { quantity_available: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/indent/:id', verifyToken, (req, res) => {
  try {
    const indent = db.prepare(`${INDENT_SELECT} WHERE i.id = ?`).get(req.params.id);
    if (!indent) return res.status(404).json({ error: 'Indent not found' });
    indent.items = getIndentItems(req.params.id);
    indent.approval_history = db.prepare(`
      SELECT ah.*, u.full_name as approved_by_name
      FROM approval_history ah
      LEFT JOIN users u ON ah.approved_by = u.id
      WHERE ah.module = 'indent' AND ah.record_id = ?
      ORDER BY ah.level ASC
    `).all(req.params.id);
    res.json(indent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/indent/:id/submit', verifyToken, (req, res) => {
  try {
    const itemCount = db.prepare('SELECT COUNT(*) as c FROM indent_items WHERE indent_id = ?').get(req.params.id).c;
    if (!itemCount) return res.status(400).json({ error: 'This indent has no items — add at least one before submitting.' });
    // Snapshot how many approval levels are required right now, so a later
    // change to the org-wide setting doesn't retroactively alter indents
    // that are already mid-flight.
    const setting = db.prepare("SELECT levels_required FROM approval_settings WHERE module = 'indent'").get();
    const requiredLevel = setting ? setting.levels_required : 1;
    db.prepare('UPDATE indents SET status = ?, current_level = 0, required_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('Pending', requiredLevel, req.params.id);
    res.json({ message: `Indent submitted for approval (requires ${requiredLevel} level${requiredLevel > 1 ? 's' : ''})` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/indent/:id/approve', verifyToken, (req, res) => {
  const approve = db.transaction((indentId, body, userId, userRole) => {
    const indent = db.prepare('SELECT * FROM indents WHERE id = ?').get(indentId);
    if (!indent) throw new Error('Indent not found');
    if (indent.status !== 'Pending') throw new Error(`This indent is ${indent.status}, not awaiting approval`);

    // HIERARCHY ENFORCEMENT: a user can only approve at exactly the next
    // level in the chain — a Level 1 approver can't skip ahead and a
    // Level 3 approver can't jump in before Level 1/2 have signed off.
    // Admins can approve at any level, so the chain never gets stuck if a
    // designated approver is unavailable.
    const approverUser = db.prepare('SELECT approval_level, role FROM users WHERE id = ?').get(userId);
    const nextLevel = indent.current_level + 1;
    if (userRole !== 'admin' && (!approverUser || approverUser.approval_level !== nextLevel)) {
      throw new Error(`This indent needs Level ${nextLevel} approval next. Your approval level is ${approverUser ? approverUser.approval_level : 'unknown'}.`);
    }

    const comments = body.comments ?? body.approval_comments ?? null;
    const newLevel = nextLevel;
    const isFinal = newLevel >= indent.required_level;

    db.prepare('INSERT INTO approval_history (module, record_id, level, action, approved_by, comments) VALUES (?, ?, ?, ?, ?, ?)')
      .run('indent', indentId, newLevel, 'Approved', userId, comments);

    db.prepare(
      `UPDATE indents SET current_level = ?, status = ?, approved_by = ?, approval_comments = ?, approval_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(newLevel, isFinal ? 'Approved' : 'Pending', userId, comments, indentId);

    return { isFinal, newLevel, requiredLevel: indent.required_level };
  });

  try {
    const { isFinal, newLevel, requiredLevel } = approve(req.params.id, req.body, req.userId, req.userRole);
    res.json({ message: isFinal ? 'Indent fully approved' : `Level ${newLevel} of ${requiredLevel} approved — awaiting next level` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/indent/:id/reject', verifyToken, (req, res) => {
  try {
    // Same field-name mismatch as /approve: the UI sends `rejection_reason`.
    const comments = req.body.comments ?? req.body.rejection_reason ?? null;
    const indent = db.prepare('SELECT * FROM indents WHERE id = ?').get(req.params.id);
    if (!indent) return res.status(404).json({ error: 'Indent not found' });

    db.prepare('INSERT INTO approval_history (module, record_id, level, action, approved_by, comments) VALUES (?, ?, ?, ?, ?, ?)')
      .run('indent', req.params.id, indent.current_level + 1, 'Rejected', req.userId, comments);
    db.prepare('UPDATE indents SET status = ?, approval_comments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('Rejected', comments, req.params.id);
    res.json({ message: 'Indent rejected' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ----- Vendor RFQ / quotations against an indent -----
// RFQ is maintained indent-wise: one quotation from a vendor covers every
// item on the indent, priced line by line, rather than needing a separate
// quotation per material.
app.post('/api/indent/:id/quotation', verifyToken, (req, res) => {
  const create = db.transaction((indentId, body) => {
    const { vendor_id, delivery_time_days, payment_terms, validity_days, notes, items = [] } = body;
    if (!vendor_id) throw new Error('vendor_id is required');
    if (!items.length) throw new Error('Quote at least one item');
    const indentItems = getIndentItems(indentId);
    const quotation_number = nextSerial('quotation');

    let total_price = 0;
    const preparedItems = items.map(it => {
      const indentItem = indentItems.find(ii => ii.id === parseInt(it.indent_item_id));
      if (!indentItem) throw new Error(`Item #${it.indent_item_id} is not on this indent`);
      const unitPrice = parseFloat(it.unit_price) || 0;
      const lineTotal = Number((unitPrice * indentItem.quantity_required).toFixed(2));
      total_price += lineTotal;
      return { indent_item_id: indentItem.id, material_id: indentItem.material_id, unit_price: unitPrice, quantity: indentItem.quantity_required, total_price: lineTotal, technical_specification: it.technical_specification || null };
    });

    const result = db.prepare(
      'INSERT INTO vendor_quotations (indent_id, vendor_id, quotation_number, total_price, delivery_time_days, payment_terms, validity_days, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(indentId, vendor_id, quotation_number, Number(total_price.toFixed(2)), delivery_time_days || null, payment_terms || null, validity_days || 30, notes || null);
    const quotationId = result.lastInsertRowid;

    const insertQItem = db.prepare('INSERT INTO vendor_quotation_items (quotation_id, indent_item_id, material_id, unit_price, quantity, total_price, technical_specification) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const it of preparedItems) {
      insertQItem.run(quotationId, it.indent_item_id, it.material_id, it.unit_price, it.quantity, it.total_price, it.technical_specification);
    }
    return { id: quotationId, quotation_number };
  });
  try {
    const { id, quotation_number } = create(req.params.id, req.body);
    res.status(201).json({ id, quotation_number, message: 'Quotation recorded' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/indent/:id/quotations', verifyToken, (req, res) => {
  try {
    const quotations = db.prepare(`
      SELECT vq.*, v.vendor_name
      FROM vendor_quotations vq
      LEFT JOIN vendors v ON vq.vendor_id = v.id
      WHERE vq.indent_id = ?
      ORDER BY vq.total_price ASC
    `).all(req.params.id);
    for (const q of quotations) {
      q.items = db.prepare(`
        SELECT vqi.*, m.material_name
        FROM vendor_quotation_items vqi
        LEFT JOIN materials m ON vqi.material_id = m.id
        WHERE vqi.quotation_id = ?
      `).all(q.id);
    }
    res.json(quotations || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/indent/:id/evaluate-rates', verifyToken, (req, res) => {
  try {
    const { vendor_id_1, vendor_id_2, vendor_id_3, quotation_id_1, quotation_id_2, quotation_id_3, selected_vendor_id, selected_quotation_id, selection_criteria, evaluation_comments } = req.body;
    const result = db.prepare(
      `INSERT INTO rate_evaluations
        (indent_id, vendor_id_1, vendor_id_2, vendor_id_3, quotation_id_1, quotation_id_2, quotation_id_3, selected_vendor_id, selected_quotation_id, selection_criteria, evaluation_comments, evaluated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.params.id, vendor_id_1, vendor_id_2, vendor_id_3, quotation_id_1, quotation_id_2, quotation_id_3, selected_vendor_id, selected_quotation_id, selection_criteria, evaluation_comments, req.userId);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Rate evaluation saved' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/indent/:id/generate-po', verifyToken, (req, res) => {
  const generate = db.transaction((indentId, body, userId) => {
    let { vendor_id, evaluation_id } = body;
    const indent = db.prepare('SELECT * FROM indents WHERE id = ?').get(indentId);
    if (!indent) throw new Error('Indent not found');
    const indentItems = getIndentItems(indentId);
    if (!indentItems.length) throw new Error('This indent has no items');

    // Prices come from the selected quotation's per-item pricing when an
    // evaluation was done; without one (a direct/manual PO from the
    // indent), every line goes in at ₹0 for the purchaser to fill in —
    // same as adding materials to a PO by hand.
    let quotationItemsByIndentItem = {};
    let evalRow = null;
    if (evaluation_id) {
      evalRow = db.prepare('SELECT * FROM rate_evaluations WHERE id = ?').get(evaluation_id);
      if (evalRow && evalRow.selected_quotation_id) {
        const qItems = db.prepare('SELECT * FROM vendor_quotation_items WHERE quotation_id = ?').all(evalRow.selected_quotation_id);
        quotationItemsByIndentItem = Object.fromEntries(qItems.map(qi => [qi.indent_item_id, qi]));
      }
    }
    // BUG FIX (kept from before): this used to trust `vendor_id`
    // unconditionally, and the caller wasn't always sending it — falls
    // back to the evaluation's selected vendor if one wasn't explicitly
    // passed, and fails clearly instead of a raw SQLite constraint error.
    if (!vendor_id && evalRow) vendor_id = evalRow.selected_vendor_id;
    if (!vendor_id) throw new Error('No vendor specified — select a vendor before generating the PO');

    const po_number = nextSerial('po');
    let grandTotal = 0;
    const lines = indentItems.map(ii => {
      const qItem = quotationItemsByIndentItem[ii.id];
      const unitPrice = qItem ? qItem.unit_price : 0;
      const lineTotal = Number((ii.quantity_required * unitPrice).toFixed(2));
      grandTotal += lineTotal;
      return { material_id: ii.material_id, quantity: ii.quantity_required, unit_price: unitPrice, line_total: lineTotal };
    });

    const poResult = db.prepare(
      'INSERT INTO purchase_orders (po_number, vendor_id, po_date, status, total_amount, grand_total, notes, created_by) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)'
    ).run(po_number, vendor_id, 'Draft', grandTotal, grandTotal, `Generated from Indent ${indent.indent_number}`, userId);
    const poId = poResult.lastInsertRowid;

    const insertPoItem = db.prepare('INSERT INTO purchase_order_items (po_id, material_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)');
    for (const line of lines) {
      insertPoItem.run(poId, line.material_id, line.quantity, line.unit_price, line.line_total);
    }

    db.prepare('INSERT INTO indent_po_mapping (indent_id, po_id, evaluation_id) VALUES (?, ?, ?)').run(indentId, poId, evaluation_id || null);
    if (evaluation_id) db.prepare('UPDATE rate_evaluations SET po_generated_from_evaluation = 1 WHERE id = ?').run(evaluation_id);
    db.prepare('UPDATE indents SET status = ? WHERE id = ?').run('PO Generated', indentId);

    return { po_number, id: poId };
  });

  try {
    const { po_number, id } = generate(req.params.id, req.body, req.userId);
    res.status(201).json({ po_number, id, message: 'PO generated from indent' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== PRODUCTION ROUTES =====
function getRecipeWithItems(recipeId) {
  const recipe = db.prepare('SELECT * FROM production_recipes WHERE id = ?').get(recipeId);
  if (!recipe) return null;
  recipe.items = db.prepare(`
    SELECT pri.*, m.material_name, m.material_code, m.unit_of_measure
    FROM production_recipe_items pri
    LEFT JOIN materials m ON pri.material_id = m.id
    WHERE pri.recipe_id = ?
    ORDER BY pri.id
  `).all(recipeId);
  recipe.byproducts = db.prepare(`
    SELECT rb.*, m.material_name, m.material_code FROM production_recipe_byproducts rb
    LEFT JOIN materials m ON rb.material_id = m.id
    WHERE rb.recipe_id = ? ORDER BY rb.id
  `).all(recipeId);
  recipe.total_input_quantity = recipe.items.reduce((sum, item) => sum + (parseFloat(item.input_quantity) || 0), 0);
  // Kg-equivalent of the batch output, regardless of what unit the
  // finished item is counted in (Nos/Mtr/CBM/Kg) — this is what makes RM
  // consumption in Kg comparable to output in any unit.
  recipe.total_output_weight_kg = Number(((parseFloat(recipe.output_quantity) || 0) * (parseFloat(recipe.weight_per_output_unit) || 1)).toFixed(3));
  return recipe;
}

app.get('/api/production/recipes', verifyToken, (req, res) => {
  try {
    const recipes = db.prepare(`
      SELECT r.*, u.full_name as created_by_name, om.material_name as output_material_name,
             rt.routing_name,
             COALESCE(SUM(ri.input_quantity), 0) as total_input_quantity,
             COUNT(ri.id) as material_count
      FROM production_recipes r
      LEFT JOIN production_recipe_items ri ON r.id = ri.recipe_id
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN materials om ON r.output_material_id = om.id
      LEFT JOIN routing_master rt ON r.routing_id = rt.id
      WHERE r.is_active = 1
      GROUP BY r.id
      ORDER BY r.product_name
    `).all();
    // Group alternates under their primary recipe so the BOM screen can
    // show "Product X — 2 alternate BOMs" instead of a flat, confusing list.
    const primaries = recipes.filter(r => !r.is_alternate);
    for (const p of primaries) {
      p.alternates = recipes.filter(r => r.is_alternate && r.primary_recipe_id === p.id);
    }
    res.json(primaries || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/production/recipes/:id', verifyToken, (req, res) => {
  try {
    const recipe = getRecipeWithItems(req.params.id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const insertRecipeByproducts = db.prepare('INSERT INTO production_recipe_byproducts (recipe_id, material_id, quantity, unit) VALUES (?, ?, ?, ?)');
function saveByproducts(recipeId, byproducts = []) {
  for (const bp of byproducts) {
    if (!bp.material_id) continue;
    insertRecipeByproducts.run(recipeId, bp.material_id, parseFloat(bp.quantity) || 0, bp.unit || 'Kg');
  }
}

app.post('/api/production/recipes', verifyToken, (req, res) => {
  const createRecipe = db.transaction((body, userId) => {
    const { product_name, output_quantity, output_unit, process_notes, items = [], output_material_id, routing_id, primary_recipe_id, alternate_label,
            alias, weight_per_output_unit, expenses_per_unit, default_machine_id, byproducts = [] } = body;
    if (!product_name) throw new Error('Product name is required');
    if (!items.length) throw new Error('Add at least one raw material');
    const isAlternate = !!primary_recipe_id;
    if (isAlternate) {
      const primary = db.prepare('SELECT * FROM production_recipes WHERE id = ?').get(primary_recipe_id);
      if (!primary) throw new Error('Primary BOM not found');
    }
    const product_code = nextSerial('product');
    const result = db.prepare(`
      INSERT INTO production_recipes (product_code, product_name, output_quantity, output_unit, process_notes, created_by, output_material_id, routing_id, is_alternate, primary_recipe_id, alternate_label, alias, weight_per_output_unit, expenses_per_unit, default_machine_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(product_code, product_name, parseFloat(output_quantity) || 1, output_unit || 'Kg', process_notes || null, userId, output_material_id || null, routing_id || null, isAlternate ? 1 : 0, primary_recipe_id || null, alternate_label || null,
      alias || null, parseFloat(weight_per_output_unit) || 1, parseFloat(expenses_per_unit) || 0, default_machine_id || null);
    const recipeId = result.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO production_recipe_items (recipe_id, material_id, input_quantity, input_unit, scrap_percent, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      if (!item.material_id) continue;
      insertItem.run(recipeId, item.material_id, parseFloat(item.input_quantity) || 0, item.input_unit || 'Kg', parseFloat(item.scrap_percent) || 0, item.notes || null);
    }
    saveByproducts(recipeId, byproducts);
    return { id: recipeId, product_code };
  });
  try {
    const result = createRecipe(req.body, req.userId);
    res.status(201).json({ ...result, message: 'Product recipe created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Convenience wrapper: create an alternate BOM for an existing product in
// one call, without the caller needing to know the primary's product_name/
// output_quantity/unit ahead of time — it's copied from the primary.
app.post('/api/production/recipes/:id/alternates', verifyToken, (req, res) => {
  const createAlternate = db.transaction((primaryId, body, userId) => {
    const primary = db.prepare('SELECT * FROM production_recipes WHERE id = ?').get(primaryId);
    if (!primary) throw new Error('Primary BOM not found');
    const { items = [], output_quantity, output_unit, process_notes, alternate_label, output_material_id, routing_id,
            alias, weight_per_output_unit, expenses_per_unit, default_machine_id, byproducts = [] } = body;
    if (!items.length) throw new Error('Add at least one raw material');
    const product_code = nextSerial('product');
    const result = db.prepare(`
      INSERT INTO production_recipes (product_code, product_name, output_quantity, output_unit, process_notes, created_by, output_material_id, routing_id, is_alternate, primary_recipe_id, alternate_label, alias, weight_per_output_unit, expenses_per_unit, default_machine_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
    `).run(product_code, primary.product_name, parseFloat(output_quantity) || primary.output_quantity, output_unit || primary.output_unit,
      process_notes || null, userId, output_material_id || primary.output_material_id || null, routing_id || primary.routing_id || null,
      primaryId, alternate_label || 'Alternate BOM', alias || null, parseFloat(weight_per_output_unit) || primary.weight_per_output_unit || 1,
      parseFloat(expenses_per_unit) || 0, default_machine_id || null);
    const recipeId = result.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO production_recipe_items (recipe_id, material_id, input_quantity, input_unit, scrap_percent, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      if (!item.material_id) continue;
      insertItem.run(recipeId, item.material_id, parseFloat(item.input_quantity) || 0, item.input_unit || 'Kg', parseFloat(item.scrap_percent) || 0, item.notes || null);
    }
    saveByproducts(recipeId, byproducts);
    return { id: recipeId, product_code };
  });
  try {
    const result = createAlternate(req.params.id, req.body, req.userId);
    res.status(201).json({ ...result, message: 'Alternate BOM created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/production/recipes/:id', verifyToken, (req, res) => {
  const updateRecipe = db.transaction((recipeId, body) => {
    const existing = db.prepare('SELECT * FROM production_recipes WHERE id = ?').get(recipeId);
    if (!existing) throw new Error('Recipe not found');
    const { product_name, output_quantity, output_unit, process_notes, items = [], output_material_id, routing_id, alternate_label,
            alias, weight_per_output_unit, expenses_per_unit, default_machine_id, byproducts = [] } = body;
    if (!product_name) throw new Error('Product name is required');
    if (!items.length) throw new Error('Add at least one raw material');
    db.prepare(`
      UPDATE production_recipes
      SET product_name = ?, output_quantity = ?, output_unit = ?, process_notes = ?, output_material_id = ?, routing_id = ?, alternate_label = ?,
          alias = ?, weight_per_output_unit = ?, expenses_per_unit = ?, default_machine_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(product_name, parseFloat(output_quantity) || 1, output_unit || 'Kg', process_notes || null, output_material_id ?? existing.output_material_id,
      routing_id ?? existing.routing_id, alternate_label ?? existing.alternate_label, alias ?? existing.alias,
      weight_per_output_unit !== undefined ? parseFloat(weight_per_output_unit) || 1 : existing.weight_per_output_unit,
      expenses_per_unit !== undefined ? parseFloat(expenses_per_unit) || 0 : existing.expenses_per_unit,
      default_machine_id !== undefined ? default_machine_id : existing.default_machine_id, recipeId);
    db.prepare('DELETE FROM production_recipe_items WHERE recipe_id = ?').run(recipeId);
    const insertItem = db.prepare(`
      INSERT INTO production_recipe_items (recipe_id, material_id, input_quantity, input_unit, scrap_percent, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      if (!item.material_id) continue;
      insertItem.run(recipeId, item.material_id, parseFloat(item.input_quantity) || 0, item.input_unit || 'Kg', parseFloat(item.scrap_percent) || 0, item.notes || null);
    }
    db.prepare('DELETE FROM production_recipe_byproducts WHERE recipe_id = ?').run(recipeId);
    saveByproducts(recipeId, byproducts);
  });
  try {
    updateRecipe(req.params.id, req.body);
    res.json({ message: 'Product recipe updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/production/orders', verifyToken, (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT po.*, r.product_code, r.output_quantity as recipe_output_quantity,
             r.output_unit as recipe_output_unit, r.output_material_id,
             m.machine_name, e.full_name as operator_name, rt.routing_name,
             sw.warehouse_name as source_warehouse_name, ow.warehouse_name as output_warehouse_name
      FROM production_orders po
      LEFT JOIN production_recipes r ON po.recipe_id = r.id
      LEFT JOIN machines m ON po.machine_id = m.id
      LEFT JOIN employees e ON po.operator_id = e.id
      LEFT JOIN routing_master rt ON po.routing_id = rt.id
      LEFT JOIN warehouses sw ON po.source_warehouse_id = sw.id
      LEFT JOIN warehouses ow ON po.output_warehouse_id = ow.id
      ORDER BY po.created_at DESC
    `).all() || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/production/orders', verifyToken, (req, res) => {
  const createOrder = db.transaction((body, userId) => {
    const { recipe_id, product_name, quantity, unit_of_measure, start_date, end_date, priority,
            routing_id, machine_id, shift, operator_id, source_warehouse_id, output_warehouse_id } = body;
    const recipe = recipe_id ? getRecipeWithItems(recipe_id) : null;
    const finalProductName = recipe ? recipe.product_name : product_name;
    const finalUnit = recipe ? recipe.output_unit : unit_of_measure;
    const orderQty = parseFloat(quantity) || 0;
    const multiplier = recipe && recipe.output_quantity ? orderQty / parseFloat(recipe.output_quantity) : 1;
    const expectedInput = recipe ? recipe.total_input_quantity * multiplier : 0;
    // A routing can be picked explicitly, or defaults to whatever routing
    // is linked on the chosen BOM (this is the "connect BOM + routing" link).
    const finalRoutingId = routing_id || (recipe ? recipe.routing_id : null) || null;
    const po_number = nextSerial('production_order');
    const result = db.prepare(
      `INSERT INTO production_orders
        (po_number, recipe_id, product_name, quantity, unit_of_measure, expected_input_quantity, expected_output_quantity,
         start_date, end_date, priority, status, created_by, routing_id, machine_id, shift, operator_id, source_warehouse_id, output_warehouse_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(po_number, recipe_id || null, finalProductName, orderQty, finalUnit || null, expectedInput, orderQty, start_date, end_date,
      priority || 'Normal', 'Planned', userId, finalRoutingId, machine_id || null, shift || null, operator_id || null,
      source_warehouse_id || null, output_warehouse_id || null);
    const orderId = result.lastInsertRowid;

    // Auto-generate a work order / job card per routing operation, in
    // sequence, so BOM + routing + work order creation are connected in
    // one action instead of three separate manual steps.
    if (finalRoutingId) {
      const steps = db.prepare('SELECT * FROM routing_steps WHERE routing_id = ? ORDER BY sequence_no').all(finalRoutingId);
      const insertWO = db.prepare(`
        INSERT INTO work_orders (work_order_number, production_order_id, operation_number, operation_name, routing_step_id, machine_id, shift, operator_id, planned_hours, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Started')
      `);
      for (const step of steps) {
        const wo_number = nextSerial('work_order');
        const plannedHours = step.standard_time_minutes ? (parseFloat(step.standard_time_minutes) * orderQty) / 60 : null;
        insertWO.run(wo_number, orderId, step.sequence_no, step.operation_name, step.id, step.work_center_id ? null : (machine_id || null), shift || null, operator_id || null, plannedHours);
      }
    }
    return { po_number, id: orderId };
  });
  try {
    const result = createOrder(req.body, req.userId);
    res.status(201).json({ ...result, message: 'Production order created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/production/orders/:id', verifyToken, (req, res) => {
  try {
    const fields = ['product_name', 'quantity', 'unit_of_measure', 'start_date', 'end_date', 'priority', 'status',
      'routing_id', 'machine_id', 'shift', 'operator_id', 'source_warehouse_id', 'output_warehouse_id'];
    const updates = fields.filter(f => req.body[f] !== undefined);
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const setClause = updates.map(f => `${f} = ?`).join(', ');
    const values = updates.map(f => req.body[f]);
    db.prepare(`UPDATE production_orders SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, req.params.id);
    res.json({ message: 'Production order updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Dedicated scheduling endpoint for the planning board (drag/reschedule a
// card without touching the rest of the order).
app.put('/api/production/orders/:id/schedule', verifyToken, (req, res) => {
  try {
    const { start_date, end_date, machine_id, shift, operator_id, priority, status } = req.body;
    const fields = { start_date, end_date, machine_id, shift, operator_id, priority, status };
    const updates = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const setClause = updates.map(([f]) => `${f} = ?`).join(', ');
    const values = updates.map(([, v]) => v);
    db.prepare(`UPDATE production_orders SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, req.params.id);
    res.json({ message: 'Schedule updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Scheduling board: every non-cancelled order with everything the board
// needs to render as cards, grouped by status (Planned / In Progress /
// Completed lanes) or plotted by start/end date.
app.get('/api/production/scheduling-board', verifyToken, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT po.id, po.po_number, po.product_name, po.quantity, po.unit_of_measure, po.status, po.priority,
             po.start_date, po.end_date, po.machine_id, po.shift, po.operator_id,
             m.machine_name, e.full_name as operator_name,
             (SELECT COUNT(*) FROM work_orders wo WHERE wo.production_order_id = po.id) as total_operations,
             (SELECT COUNT(*) FROM work_orders wo WHERE wo.production_order_id = po.id AND wo.status = 'Completed') as completed_operations
      FROM production_orders po
      LEFT JOIN machines m ON po.machine_id = m.id
      LEFT JOIN employees e ON po.operator_id = e.id
      WHERE po.status != 'Cancelled'
      ORDER BY po.start_date ASC
    `).all();
    const board = { Planned: [], 'In Progress': [], 'On Hold': [], Completed: [] };
    for (const o of orders) {
      const lane = board[o.status] ? o.status : 'Planned';
      board[lane].push(o);
    }
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/production/work-orders', verifyToken, (req, res) => {
  try {
    const workOrders = db.prepare(`
      SELECT wo.*, po.po_number, po.product_name, m.machine_name, e.full_name as operator_name
      FROM work_orders wo
      LEFT JOIN production_orders po ON wo.production_order_id = po.id
      LEFT JOIN machines m ON wo.machine_id = m.id
      LEFT JOIN employees e ON wo.operator_id = e.id
      ${req.query.production_order_id ? 'WHERE wo.production_order_id = ?' : ''}
      ORDER BY wo.operation_number ASC, wo.created_at ASC
    `).all(...(req.query.production_order_id ? [req.query.production_order_id] : []));
    res.json(workOrders || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/production/work-orders', verifyToken, (req, res) => {
  try {
    const { production_order_id, operation_number, operation_name, assigned_to, planned_hours, machine_id, shift, operator_id } = req.body;
    const work_order_number = nextSerial('work_order');
    const result = db.prepare(
      'INSERT INTO work_orders (work_order_number, production_order_id, operation_number, operation_name, assigned_to, planned_hours, machine_id, shift, operator_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(work_order_number, production_order_id, operation_number || null, operation_name, assigned_to || null, planned_hours || null, machine_id || null, shift || null, operator_id || null, 'Not Started');
    res.status(201).json({ work_order_number, id: result.lastInsertRowid, message: 'Work order created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/production/work-orders/:id', verifyToken, (req, res) => {
  const updateWO = db.transaction((id, body) => {
    const fields = ['status', 'actual_hours', 'quantity_produced', 'defects', 'start_time', 'end_time', 'notes',
      'machine_id', 'shift', 'operator_id', 'scrap_quantity', 'rework_quantity', 'rejection_quantity'];
    const updates = fields.filter(f => body[f] !== undefined);
    if (updates.length === 0) throw new Error('No fields to update');
    const setClause = updates.map(f => `${f} = ?`).join(', ');
    const values = updates.map(f => body[f]);
    db.prepare(`UPDATE work_orders SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id);
    // Roll this operation's scrap/rejection up onto the parent production
    // order's running totals, so the order-level variance report doesn't
    // need to re-sum every work order every time it's viewed.
    if (body.scrap_quantity !== undefined || body.rejection_quantity !== undefined) {
      const wo = db.prepare('SELECT production_order_id FROM work_orders WHERE id = ?').get(id);
      const totals = db.prepare('SELECT COALESCE(SUM(scrap_quantity),0) as scrap, COALESCE(SUM(rejection_quantity),0) as rej FROM work_orders WHERE production_order_id = ?').get(wo.production_order_id);
      db.prepare('UPDATE production_orders SET total_scrap_quantity = ?, total_rejection_quantity = ? WHERE id = ?').run(totals.scrap, totals.rej, wo.production_order_id);
    }
  });
  try {
    updateWO(req.params.id, req.body);
    res.json({ message: 'Work order updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/production/allocations', verifyToken, (req, res) => {
  try {
    const allocations = db.prepare(`
      SELECT pa.*, m.material_name, po.po_number
      FROM production_allocation pa
      LEFT JOIN materials m ON pa.material_id = m.id
      LEFT JOIN production_orders po ON pa.production_order_id = po.id
      ORDER BY pa.created_at DESC
    `).all();
    res.json(allocations || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/production/allocations', verifyToken, (req, res) => {
  const doAllocate = db.transaction((body, userId) => {
    const { production_order_id, material_id, quantity_allocated, warehouse_id } = body;
    const allocation_number = nextSerial('allocation');

    if (warehouse_id) {
      const ledger = db.prepare('SELECT quantity FROM stock_ledger WHERE material_id = ? AND warehouse_id = ?').get(material_id, warehouse_id);
      if (!ledger || ledger.quantity < quantity_allocated) {
        throw new Error('Insufficient stock to allocate');
      }
      consumeStock(material_id, warehouse_id, parseFloat(quantity_allocated));
    }

    const result = db.prepare(
      'INSERT INTO production_allocation (allocation_number, production_order_id, material_id, quantity_allocated, warehouse_id, allocated_by, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(allocation_number, production_order_id, material_id, quantity_allocated, warehouse_id || null, userId, 'Allocated');

    // Raw material issue to production: keep a running total of everything
    // issued against the order, for the variance report (planned vs actual).
    if (production_order_id) {
      db.prepare('UPDATE production_orders SET actual_input_quantity = actual_input_quantity + ?, status = CASE WHEN status = \'Planned\' THEN \'In Progress\' ELSE status END WHERE id = ?')
        .run(parseFloat(quantity_allocated) || 0, production_order_id);
    }

    return { allocation_number, id: result.lastInsertRowid };
  });

  try {
    const { allocation_number, id } = doAllocate(req.body, req.userId);
    res.status(201).json({ allocation_number, id, message: 'Material issued to production successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== Return of unused material (production -> store) =====
app.get('/api/production/returns', verifyToken, (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT pmr.*, m.material_name, m.unit_of_measure, po.po_number, w.warehouse_name, u.full_name as returned_by_name
      FROM production_material_returns pmr
      LEFT JOIN materials m ON pmr.material_id = m.id
      LEFT JOIN production_orders po ON pmr.production_order_id = po.id
      LEFT JOIN warehouses w ON pmr.warehouse_id = w.id
      LEFT JOIN users u ON pmr.returned_by = u.id
      ORDER BY pmr.created_at DESC
    `).all() || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/production/returns', verifyToken, (req, res) => {
  const doReturn = db.transaction((body, userId) => {
    const { production_order_id, material_id, quantity_returned, warehouse_id, reason } = body;
    if (!production_order_id || !material_id || !warehouse_id) throw new Error('production_order_id, material_id and warehouse_id are required');
    const qty = parseFloat(quantity_returned) || 0;
    if (qty <= 0) throw new Error('quantity_returned must be greater than 0');
    const return_number = nextSerial('production_return');
    const result = db.prepare(
      'INSERT INTO production_material_returns (return_number, production_order_id, material_id, quantity_returned, warehouse_id, reason, returned_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(return_number, production_order_id, material_id, qty, warehouse_id, reason || null, userId);
    // Goes back into usable stock as its own traceable batch.
    addStockBatch(material_id, warehouse_id, qty, { source: 'Production Return', source_reference: return_number });
    // Reduces the order's "actual consumed" figure, since it wasn't actually used.
    db.prepare('UPDATE production_orders SET actual_input_quantity = MAX(0, actual_input_quantity - ?) WHERE id = ?').run(qty, production_order_id);
    return { return_number, id: result.lastInsertRowid };
  });
  try {
    const result = doReturn(req.body, req.userId);
    res.status(201).json({ ...result, message: 'Material returned to store successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== WIP tracking by stage / operation =====
app.get('/api/production/wip', verifyToken, (req, res) => {
  try {
    const where = req.query.production_order_id ? 'WHERE wl.production_order_id = ?' : '';
    const params = req.query.production_order_id ? [req.query.production_order_id] : [];
    const rows = db.prepare(`
      SELECT wl.*, po.po_number, po.product_name, m.machine_name, e.full_name as operator_name, u.full_name as logged_by_name
      FROM production_wip_log wl
      LEFT JOIN production_orders po ON wl.production_order_id = po.id
      LEFT JOIN machines m ON wl.machine_id = m.id
      LEFT JOIN employees e ON wl.operator_id = e.id
      LEFT JOIN users u ON wl.logged_by = u.id
      ${where}
      ORDER BY wl.created_at DESC
    `).all(...params);
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Current WIP sitting at each stage for an order = cumulative qty_in minus
// cumulative qty_out/scrap/rework/rejection logged at that stage so far.
app.get('/api/production/wip/summary/:productionOrderId', verifyToken, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT stage_name, MIN(sequence_no) as sequence_no,
             COALESCE(SUM(quantity_in),0) as total_in,
             COALESCE(SUM(quantity_out),0) as total_out,
             COALESCE(SUM(scrap_quantity),0) as total_scrap,
             COALESCE(SUM(rework_quantity),0) as total_rework,
             COALESCE(SUM(rejection_quantity),0) as total_rejection
      FROM production_wip_log
      WHERE production_order_id = ?
      GROUP BY stage_name
      ORDER BY sequence_no ASC
    `).all(req.params.productionOrderId);
    for (const r of rows) {
      r.wip_balance = r.total_in - r.total_out - r.total_scrap - r.total_rework - r.total_rejection;
    }
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/production/wip', verifyToken, (req, res) => {
  const logWip = db.transaction((body, userId) => {
    const { production_order_id, work_order_id, stage_name, sequence_no, quantity_in, quantity_out,
            scrap_quantity, rework_quantity, rejection_quantity, by_product_quantity, machine_id, shift, operator_id, status, remarks } = body;
    if (!production_order_id || !stage_name) throw new Error('production_order_id and stage_name are required');
    const wip_number = nextSerial('wip_entry');
    const result = db.prepare(`
      INSERT INTO production_wip_log
        (wip_number, production_order_id, work_order_id, stage_name, sequence_no, quantity_in, quantity_out, scrap_quantity, rework_quantity, rejection_quantity, by_product_quantity, machine_id, shift, operator_id, status, remarks, logged_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(wip_number, production_order_id, work_order_id || null, stage_name, sequence_no || null,
      parseFloat(quantity_in) || 0, parseFloat(quantity_out) || 0, parseFloat(scrap_quantity) || 0, parseFloat(rework_quantity) || 0,
      parseFloat(rejection_quantity) || 0, parseFloat(by_product_quantity) || 0, machine_id || null, shift || null, operator_id || null,
      status || 'In Progress', remarks || null, userId);

    if (work_order_id) {
      db.prepare('UPDATE work_orders SET scrap_quantity = scrap_quantity + ?, rejection_quantity = rejection_quantity + ?, quantity_produced = quantity_produced + ? WHERE id = ?')
        .run(parseFloat(scrap_quantity) || 0, parseFloat(rejection_quantity) || 0, parseFloat(quantity_out) || 0, work_order_id);
    }
    const totals = db.prepare('SELECT COALESCE(SUM(scrap_quantity),0) as scrap, COALESCE(SUM(rejection_quantity),0) as rej FROM production_wip_log WHERE production_order_id = ?').get(production_order_id);
    db.prepare('UPDATE production_orders SET total_scrap_quantity = ?, total_rejection_quantity = ? WHERE id = ?').run(totals.scrap, totals.rej, production_order_id);
    return { wip_number, id: result.lastInsertRowid };
  });
  try {
    const result = logWip(req.body, req.userId);
    res.status(201).json({ ...result, message: 'WIP movement logged successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== Production receipt / finished-goods receipt =====
app.get('/api/production/receipts', verifyToken, (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT pr.*, po.po_number, po.product_name, w.warehouse_name, u.full_name as received_by_name, bm.material_name as by_product_name
      FROM production_receipts pr
      LEFT JOIN production_orders po ON pr.production_order_id = po.id
      LEFT JOIN warehouses w ON pr.warehouse_id = w.id
      LEFT JOIN users u ON pr.received_by = u.id
      LEFT JOIN materials bm ON pr.by_product_material_id = bm.id
      ORDER BY pr.created_at DESC
    `).all() || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/production/receipts', verifyToken, (req, res) => {
  const doReceipt = db.transaction((body, userId) => {
    const { production_order_id, warehouse_id, quantity_received, batch_number, scrap_quantity, rework_quantity,
            rejection_quantity, by_product_material_id, by_product_quantity, is_final, remarks } = body;
    if (!production_order_id || !warehouse_id) throw new Error('production_order_id and warehouse_id are required');
    const order = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(production_order_id);
    if (!order) throw new Error('Production order not found');
    const recipe = order.recipe_id ? db.prepare('SELECT * FROM production_recipes WHERE id = ?').get(order.recipe_id) : null;
    const outputMaterialId = recipe ? recipe.output_material_id : null;
    if (!outputMaterialId) throw new Error('This production order\'s BOM has no finished-good material linked — set "Output Material" on the BOM first so receipt can post real stock.');

    const qty = parseFloat(quantity_received) || 0;
    const receipt_number = nextSerial('production_receipt');
    const result = db.prepare(`
      INSERT INTO production_receipts
        (receipt_number, production_order_id, warehouse_id, quantity_received, batch_number, scrap_quantity, rework_quantity, rejection_quantity, by_product_material_id, by_product_quantity, is_final, remarks, received_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receipt_number, production_order_id, warehouse_id, qty, batch_number || receipt_number, parseFloat(scrap_quantity) || 0,
      parseFloat(rework_quantity) || 0, parseFloat(rejection_quantity) || 0, by_product_material_id || null, parseFloat(by_product_quantity) || 0,
      is_final ? 1 : 0, remarks || null, userId);

    // Post finished-goods quantity into real, usable, traceable stock.
    if (qty > 0) {
      addStockBatch(outputMaterialId, warehouse_id, qty, { batch_number: batch_number || receipt_number, source: 'Production Receipt', source_reference: receipt_number });
    }
    // A by-product (e.g. slitting offcuts sellable separately) posts too.
    if (by_product_material_id && parseFloat(by_product_quantity) > 0) {
      addStockBatch(by_product_material_id, warehouse_id, parseFloat(by_product_quantity), { source: 'Production By-Product', source_reference: receipt_number });
    }

    const totals = db.prepare('SELECT COALESCE(SUM(quantity_received),0) as out_qty, COALESCE(SUM(scrap_quantity),0) as scrap, COALESCE(SUM(rejection_quantity),0) as rej FROM production_receipts WHERE production_order_id = ?').get(production_order_id);
    const newStatus = is_final ? 'Completed' : (order.status === 'Planned' ? 'In Progress' : order.status);
    db.prepare('UPDATE production_orders SET actual_output_quantity = ?, total_scrap_quantity = total_scrap_quantity + ?, total_rejection_quantity = total_rejection_quantity + ?, status = ? WHERE id = ?')
      .run(totals.out_qty, parseFloat(scrap_quantity) || 0, parseFloat(rejection_quantity) || 0, newStatus, production_order_id);

    return { receipt_number, id: result.lastInsertRowid };
  });
  try {
    const result = doReceipt(req.body, req.userId);
    res.status(201).json({ ...result, message: 'Production / finished-goods receipt recorded successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== Production variance report (actual vs BOM) =====
function buildVarianceReport(order) {
  const recipe = order.recipe_id ? getRecipeWithItems(order.recipe_id) : null;
  const multiplier = recipe && recipe.output_quantity ? (order.quantity / parseFloat(recipe.output_quantity)) : 1;
  const materialVariance = (recipe ? recipe.items : []).map(item => {
    const plannedQty = (parseFloat(item.input_quantity) || 0) * multiplier;
    const actualIssued = db.prepare(`
      SELECT COALESCE(SUM(quantity_allocated),0) as qty FROM production_allocation
      WHERE production_order_id = ? AND material_id = ?
    `).get(order.id, item.material_id).qty;
    const actualReturned = db.prepare(`
      SELECT COALESCE(SUM(quantity_returned),0) as qty FROM production_material_returns
      WHERE production_order_id = ? AND material_id = ?
    `).get(order.id, item.material_id).qty;
    const netConsumed = actualIssued - actualReturned;
    return {
      material_id: item.material_id,
      material_name: item.material_name,
      unit: item.input_unit,
      planned_quantity: Number(plannedQty.toFixed(2)),
      issued_quantity: Number(actualIssued.toFixed(2)),
      returned_quantity: Number(actualReturned.toFixed(2)),
      net_consumed: Number(netConsumed.toFixed(2)),
      variance: Number((netConsumed - plannedQty).toFixed(2)),
      variance_percent: plannedQty ? Number((((netConsumed - plannedQty) / plannedQty) * 100).toFixed(1)) : null
    };
  });

  const plannedOutput = parseFloat(order.expected_output_quantity) || parseFloat(order.quantity) || 0;
  const actualOutput = parseFloat(order.actual_output_quantity) || 0;
  return {
    production_order_id: order.id,
    po_number: order.po_number,
    product_name: order.product_name,
    planned_output: plannedOutput,
    actual_output: actualOutput,
    output_variance: Number((actualOutput - plannedOutput).toFixed(2)),
    yield_percent: plannedOutput ? Number(((actualOutput / plannedOutput) * 100).toFixed(1)) : null,
    total_scrap: parseFloat(order.total_scrap_quantity) || 0,
    total_rejection: parseFloat(order.total_rejection_quantity) || 0,
    materials: materialVariance
  };
}

app.get('/api/production/variance/:id', verifyToken, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Production order not found' });
    res.json(buildVarianceReport(order));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/production/variance', verifyToken, (req, res) => {
  try {
    const orders = db.prepare("SELECT * FROM production_orders WHERE status IN ('In Progress', 'Completed') ORDER BY created_at DESC LIMIT 100").all();
    res.json(orders.map(buildVarianceReport));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Printable job card: everything needed for one operation's shop-floor paperwork =====
app.get('/api/production/job-card/:workOrderId', verifyToken, (req, res) => {
  try {
    const wo = db.prepare(`
      SELECT wo.*, po.po_number, po.product_name, po.quantity as order_quantity, po.unit_of_measure, po.priority, po.start_date, po.end_date,
             m.machine_name, e.full_name as operator_name, u.full_name as assigned_to_name
      FROM work_orders wo
      LEFT JOIN production_orders po ON wo.production_order_id = po.id
      LEFT JOIN machines m ON wo.machine_id = m.id
      LEFT JOIN employees e ON wo.operator_id = e.id
      LEFT JOIN users u ON wo.assigned_to = u.id
      WHERE wo.id = ?
    `).get(req.params.workOrderId);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    const allOperations = db.prepare(`
      SELECT wo.operation_number, wo.operation_name, wo.status, wo.quantity_produced
      FROM work_orders wo WHERE wo.production_order_id = ? ORDER BY wo.operation_number ASC
    `).all(wo.production_order_id);
    const materials = db.prepare(`
      SELECT pa.*, m.material_name, m.unit_of_measure FROM production_allocation pa
      LEFT JOIN materials m ON pa.material_id = m.id WHERE pa.production_order_id = ?
    `).all(wo.production_order_id);
    const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();
    res.json({ work_order: wo, all_operations: allOperations, materials_issued: materials, company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== SALES & DISPATCH ROUTES =====
function getQuotationWithItems(id) {
  const q = db.prepare(`
    SELECT sq.*, c.customer_name, c.gst_number as customer_gstin, c.address as customer_address, c.city as customer_city, c.state as customer_state
    FROM sales_quotations sq LEFT JOIN customers c ON sq.customer_id = c.id WHERE sq.id = ?
  `).get(id);
  if (!q) return null;
  q.items = db.prepare(`
    SELECT sqi.*, m.material_name, m.material_code, m.unit_of_measure as material_unit
    FROM sales_quotation_items sqi LEFT JOIN materials m ON sqi.material_id = m.id
    WHERE sqi.quotation_id = ? ORDER BY sqi.id
  `).all(id);
  return q;
}

function getSalesOrderWithItems(id) {
  const so = db.prepare(`
    SELECT so.*, c.customer_name, c.gst_number as customer_gstin, c.address as customer_address, c.city as customer_city,
           c.state as customer_state, c.phone as customer_phone, c.credit_limit,
           u1.full_name as created_by_name, u2.full_name as approved_by_name
    FROM sales_orders so
    LEFT JOIN customers c ON so.customer_id = c.id
    LEFT JOIN users u1 ON so.created_by = u1.id
    LEFT JOIN users u2 ON so.approved_by = u2.id
    WHERE so.id = ?
  `).get(id);
  if (!so) return null;
  so.items = db.prepare(`
    SELECT soi.*, m.material_name, m.material_code, m.unit_of_measure as material_unit
    FROM sales_order_items soi LEFT JOIN materials m ON soi.material_id = m.id
    WHERE soi.so_id = ? ORDER BY soi.id
  `).all(id);
  return so;
}

function computeLineTotals(items) {
  let total = 0, tax = 0;
  const priced = items.map(i => {
    const qty = parseFloat(i.quantity) || 0;
    const price = parseFloat(i.unit_price) || 0;
    const taxRate = parseFloat(i.tax_rate) || 0;
    const base = qty * price;
    const taxAmt = base * (taxRate / 100);
    total += base;
    tax += taxAmt;
    return { ...i, line_total: Number((base + taxAmt).toFixed(2)) };
  });
  return { items: priced, total_amount: Number(total.toFixed(2)), tax_amount: Number(tax.toFixed(2)), grand_total: Number((total + tax).toFixed(2)) };
}

// --- Quotations ---
app.get('/api/sales/quotations', verifyToken, (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT sq.*, c.customer_name FROM sales_quotations sq LEFT JOIN customers c ON sq.customer_id = c.id ORDER BY sq.created_at DESC
    `).all() || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sales/quotations/:id', verifyToken, (req, res) => {
  try {
    const q = getQuotationWithItems(req.params.id);
    if (!q) return res.status(404).json({ error: 'Quotation not found' });
    res.json(q);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sales/quotations', verifyToken, (req, res) => {
  const create = db.transaction((body, userId) => {
    const { customer_id, valid_until, notes, items = [] } = body;
    if (!customer_id) throw new Error('customer_id is required');
    if (!items.length) throw new Error('Add at least one item');
    const { items: priced, total_amount, tax_amount, grand_total } = computeLineTotals(items);
    const quotation_number = nextSerial('sales_quotation');
    const result = db.prepare(`
      INSERT INTO sales_quotations (quotation_number, customer_id, valid_until, notes, total_amount, tax_amount, grand_total, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(quotation_number, customer_id, valid_until || null, notes || null, total_amount, tax_amount, grand_total, userId);
    const qId = result.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO sales_quotation_items (quotation_id, material_id, quantity, unit_of_measure, unit_price, tax_rate, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const item of priced) {
      if (!item.material_id) continue;
      insertItem.run(qId, item.material_id, parseFloat(item.quantity) || 0, item.unit_of_measure || 'Nos', parseFloat(item.unit_price) || 0, parseFloat(item.tax_rate) || 0, item.line_total);
    }
    return { id: qId, quotation_number };
  });
  try {
    const result = create(req.body, req.userId);
    res.status(201).json({ ...result, message: 'Quotation created successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/sales/quotations/:id/status', verifyToken, (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    db.prepare('UPDATE sales_quotations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    res.json({ message: `Quotation marked ${status}` });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Converts an accepted quotation straight into a sales order, copying its
// items across so the sales team doesn't have to re-key everything.
app.post('/api/sales/quotations/:id/convert', verifyToken, (req, res) => {
  const convert = db.transaction((quotationId, body, userId) => {
    const q = getQuotationWithItems(quotationId);
    if (!q) throw new Error('Quotation not found');
    if (!q.items.length) throw new Error('Quotation has no items');
    const so_number = nextSerial('sales_order');
    const { expected_delivery_date, payment_term, transporter, destination, special_remarks } = body;
    const result = db.prepare(`
      INSERT INTO sales_orders (so_number, customer_id, quotation_id, expected_delivery_date, payment_term, transporter, destination, special_remarks, total_amount, tax_amount, grand_total, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(so_number, q.customer_id, quotationId, expected_delivery_date || null, payment_term || null, transporter || null, destination || null, special_remarks || null,
      q.total_amount, q.tax_amount, q.grand_total, userId);
    const soId = result.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO sales_order_items (so_id, material_id, quantity, unit_of_measure, unit_price, tax_rate, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const item of q.items) {
      insertItem.run(soId, item.material_id, item.quantity, item.unit_of_measure, item.unit_price, item.tax_rate, item.line_total);
    }
    db.prepare("UPDATE sales_quotations SET status = 'Converted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(quotationId);
    return { id: soId, so_number };
  });
  try {
    const result = convert(req.params.id, req.body, req.userId);
    res.status(201).json({ ...result, message: 'Quotation converted to sales order successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- Sales Orders ---
app.get('/api/sales/orders', verifyToken, (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT so.*, c.customer_name,
        (SELECT COALESCE(SUM(quantity),0) FROM sales_order_items WHERE so_id = so.id) as total_ordered_qty,
        (SELECT COALESCE(SUM(dispatched_quantity),0) FROM sales_order_items WHERE so_id = so.id) as total_dispatched_qty
      FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id
      ORDER BY so.created_at DESC
    `).all() || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sales/orders/:id', verifyToken, (req, res) => {
  try {
    const so = getSalesOrderWithItems(req.params.id);
    if (!so) return res.status(404).json({ error: 'Sales order not found' });
    res.json(so);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sales/orders', verifyToken, (req, res) => {
  const create = db.transaction((body, userId) => {
    const { customer_id, expected_delivery_date, payment_term, transporter, destination, special_remarks, items = [] } = body;
    if (!customer_id) throw new Error('customer_id is required');
    if (!items.length) throw new Error('Add at least one item');
    const { items: priced, total_amount, tax_amount, grand_total } = computeLineTotals(items);
    const so_number = nextSerial('sales_order');
    const result = db.prepare(`
      INSERT INTO sales_orders (so_number, customer_id, expected_delivery_date, payment_term, transporter, destination, special_remarks, status, total_amount, tax_amount, grand_total, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, ?, ?, ?)
    `).run(so_number, customer_id, expected_delivery_date || null, payment_term || null, transporter || null, destination || null, special_remarks || null,
      total_amount, tax_amount, grand_total, userId);
    const soId = result.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO sales_order_items (so_id, material_id, quantity, unit_of_measure, unit_price, tax_rate, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const item of priced) {
      if (!item.material_id) continue;
      insertItem.run(soId, item.material_id, parseFloat(item.quantity) || 0, item.unit_of_measure || 'Nos', parseFloat(item.unit_price) || 0, parseFloat(item.tax_rate) || 0, item.line_total);
    }
    return { id: soId, so_number };
  });
  try {
    const result = create(req.body, req.userId);
    res.status(201).json({ ...result, message: 'Sales order created successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/sales/orders/:id/status', verifyToken, (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const fields = status === 'Confirmed' ? ', approved_by = ?' : '';
    if (fields) {
      db.prepare(`UPDATE sales_orders SET status = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(status, req.userId, req.params.id);
    } else {
      db.prepare('UPDATE sales_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    }
    res.json({ message: `Sales order marked ${status}` });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- Dispatch Planning ---
app.get('/api/sales/dispatch-plans', verifyToken, (req, res) => {
  try {
    const plans = db.prepare(`
      SELECT dp.*, so.so_number, c.customer_name, w.warehouse_name
      FROM dispatch_plans dp
      LEFT JOIN sales_orders so ON dp.so_id = so.id
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN warehouses w ON dp.warehouse_id = w.id
      ORDER BY dp.planned_date ASC, dp.created_at DESC
    `).all();
    for (const p of plans) {
      p.items = db.prepare(`
        SELECT dpi.*, m.material_name, m.unit_of_measure FROM dispatch_plan_items dpi
        LEFT JOIN materials m ON dpi.material_id = m.id WHERE dpi.plan_id = ?
      `).all(p.id);
    }
    res.json(plans || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sales/dispatch-plans', verifyToken, (req, res) => {
  const create = db.transaction((body, userId) => {
    const { so_id, warehouse_id, planned_date, vehicle_number, transporter, notes, items = [] } = body;
    if (!so_id) throw new Error('so_id is required');
    if (!items.length) throw new Error('Add at least one item to plan');
    const plan_number = nextSerial('dispatch_plan');
    const result = db.prepare(`
      INSERT INTO dispatch_plans (plan_number, so_id, warehouse_id, planned_date, vehicle_number, transporter, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(plan_number, so_id, warehouse_id || null, planned_date || null, vehicle_number || null, transporter || null, notes || null, userId);
    const planId = result.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO dispatch_plan_items (plan_id, so_item_id, material_id, planned_quantity) VALUES (?, ?, ?, ?)');
    for (const item of items) {
      if (!item.so_item_id || !item.material_id) continue;
      insertItem.run(planId, item.so_item_id, item.material_id, parseFloat(item.planned_quantity) || 0);
    }
    // Status tracking: an order with an active dispatch plan is on its way,
    // even before the challan actually moves stock.
    db.prepare("UPDATE sales_orders SET status = CASE WHEN status = 'Confirmed' THEN 'Ready to Dispatch' ELSE status END, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(so_id);
    return { id: planId, plan_number };
  });
  try {
    const result = create(req.body, req.userId);
    res.status(201).json({ ...result, message: 'Dispatch plan created successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/sales/dispatch-plans/:id/status', verifyToken, (req, res) => {
  try {
    const { status } = req.body;
    db.prepare('UPDATE dispatch_plans SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ message: `Dispatch plan marked ${status}` });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- Delivery Challans (dispatch note) ---
app.get('/api/sales/challans', verifyToken, (req, res) => {
  try {
    const challans = db.prepare(`
      SELECT dc.*, so.so_number, so.customer_id, c.customer_name, w.warehouse_name, u.full_name as created_by_name
      FROM delivery_challans dc
      LEFT JOIN sales_orders so ON dc.so_id = so.id
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN warehouses w ON dc.warehouse_id = w.id
      LEFT JOIN users u ON dc.created_by = u.id
      ORDER BY dc.created_at DESC
    `).all();
    for (const c of challans) {
      c.items = db.prepare(`
        SELECT dci.*, m.material_name FROM delivery_challan_items dci LEFT JOIN materials m ON dci.material_id = m.id WHERE dci.challan_id = ?
      `).all(c.id);
    }
    res.json(challans || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sales/challans/:id', verifyToken, (req, res) => {
  try {
    const c = db.prepare(`
      SELECT dc.*, so.so_number, so.destination as so_destination, cu.customer_name, cu.address as customer_address,
             cu.city as customer_city, cu.state as customer_state, cu.gst_number as customer_gstin, cu.phone as customer_phone,
             w.warehouse_name, u.full_name as created_by_name
      FROM delivery_challans dc
      LEFT JOIN sales_orders so ON dc.so_id = so.id
      LEFT JOIN customers cu ON so.customer_id = cu.id
      LEFT JOIN warehouses w ON dc.warehouse_id = w.id
      LEFT JOIN users u ON dc.created_by = u.id
      WHERE dc.id = ?
    `).get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Challan not found' });
    c.items = db.prepare(`
      SELECT dci.*, m.material_name, m.hsn_code FROM delivery_challan_items dci LEFT JOIN materials m ON dci.material_id = m.id WHERE dci.challan_id = ?
    `).all(c.id);
    res.json(c);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sales/challans', verifyToken, (req, res) => {
  const create = db.transaction((body, userId) => {
    const { so_id, dispatch_plan_id, warehouse_id, vehicle_number, transporter, driver_name, driver_phone, destination, eway_bill_number, items = [] } = body;
    if (!so_id || !warehouse_id) throw new Error('so_id and warehouse_id are required');
    if (!items.length) throw new Error('Add at least one item to dispatch');

    // Verify + deduct real stock (FIFO) before committing the challan.
    for (const item of items) {
      const ledger = db.prepare('SELECT quantity FROM stock_ledger WHERE material_id = ? AND warehouse_id = ?').get(item.material_id, warehouse_id);
      if (!ledger || ledger.quantity < parseFloat(item.quantity)) {
        const mat = db.prepare('SELECT material_name FROM materials WHERE id = ?').get(item.material_id);
        throw new Error(`Insufficient stock for ${mat ? mat.material_name : 'material #' + item.material_id}: need ${item.quantity}, have ${ledger ? ledger.quantity : 0}`);
      }
    }
    const challan_number = nextSerial('challan');
    const result = db.prepare(`
      INSERT INTO delivery_challans (challan_number, so_id, dispatch_plan_id, warehouse_id, vehicle_number, transporter, driver_name, driver_phone, destination, eway_bill_number, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(challan_number, so_id, dispatch_plan_id || null, warehouse_id, vehicle_number || null, transporter || null, driver_name || null, driver_phone || null, destination || null, eway_bill_number || null, userId);
    const challanId = result.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO delivery_challan_items (challan_id, so_item_id, material_id, quantity, unit_of_measure, batch_number) VALUES (?, ?, ?, ?, ?, ?)');
    for (const item of items) {
      const qty = parseFloat(item.quantity) || 0;
      const consumed = consumeStock(item.material_id, warehouse_id, qty);
      const batchNumbers = consumed.map(b => b.batch_number).filter(Boolean).join(', ');
      insertItem.run(challanId, item.so_item_id || null, item.material_id, qty, item.unit_of_measure || null, batchNumbers || null);
      if (item.so_item_id) {
        db.prepare('UPDATE sales_order_items SET dispatched_quantity = dispatched_quantity + ? WHERE id = ?').run(qty, item.so_item_id);
      }
    }
    if (dispatch_plan_id) db.prepare("UPDATE dispatch_plans SET status = 'Completed' WHERE id = ?").run(dispatch_plan_id);

    // Order status tracking: fully dispatched vs partially dispatched,
    // based on ordered vs dispatched quantity across all line items.
    const totals = db.prepare('SELECT COALESCE(SUM(quantity),0) as ordered, COALESCE(SUM(dispatched_quantity),0) as dispatched FROM sales_order_items WHERE so_id = ?').get(so_id);
    const newStatus = totals.dispatched >= totals.ordered - 0.0001 ? 'Dispatched' : 'Partially Dispatched';
    db.prepare('UPDATE sales_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, so_id);

    return { id: challanId, challan_number };
  });
  try {
    const result = create(req.body, req.userId);
    res.status(201).json({ ...result, message: 'Delivery challan created and stock dispatched successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/sales/challans/:id/status', verifyToken, (req, res) => {
  try {
    const { status } = req.body;
    db.prepare('UPDATE delivery_challans SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ message: `Challan marked ${status}` });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- Packing List ---
app.get('/api/sales/packing-lists', verifyToken, (req, res) => {
  try {
    const lists = db.prepare(`
      SELECT pl.*, dc.challan_number FROM packing_lists pl LEFT JOIN delivery_challans dc ON pl.challan_id = dc.id ORDER BY pl.created_at DESC
    `).all();
    for (const l of lists) {
      l.items = db.prepare('SELECT * FROM packing_list_items WHERE packing_list_id = ?').all(l.id);
    }
    res.json(lists || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sales/packing-lists', verifyToken, (req, res) => {
  const create = db.transaction((body, userId) => {
    const { challan_id, gross_weight, net_weight, notes, items = [] } = body;
    if (!challan_id) throw new Error('challan_id is required');
    const packing_list_number = nextSerial('packing_list');
    const result = db.prepare(`
      INSERT INTO packing_lists (packing_list_number, challan_id, total_packages, gross_weight, net_weight, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(packing_list_number, challan_id, items.length, gross_weight || null, net_weight || null, notes || null, userId);
    const listId = result.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO packing_list_items (packing_list_id, package_no, material_id, description, quantity, weight, dimensions) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const item of items) {
      insertItem.run(listId, item.package_no || '', item.material_id || null, item.description || null, parseFloat(item.quantity) || null, parseFloat(item.weight) || null, item.dimensions || null);
    }
    return { id: listId, packing_list_number };
  });
  try {
    const result = create(req.body, req.userId);
    res.status(201).json({ ...result, message: 'Packing list created successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- Sales Returns ---
app.get('/api/sales/returns', verifyToken, (req, res) => {
  try {
    const returns = db.prepare(`
      SELECT sr.*, c.customer_name, so.so_number, w.warehouse_name
      FROM sales_returns sr
      LEFT JOIN customers c ON sr.customer_id = c.id
      LEFT JOIN sales_orders so ON sr.so_id = so.id
      LEFT JOIN warehouses w ON sr.warehouse_id = w.id
      ORDER BY sr.created_at DESC
    `).all();
    for (const r of returns) {
      r.items = db.prepare(`SELECT sri.*, m.material_name FROM sales_return_items sri LEFT JOIN materials m ON sri.material_id = m.id WHERE sri.return_id = ?`).all(r.id);
    }
    res.json(returns || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sales/returns', verifyToken, (req, res) => {
  const create = db.transaction((body, userId) => {
    const { customer_id, so_id, challan_id, warehouse_id, reason, items = [] } = body;
    if (!customer_id || !warehouse_id) throw new Error('customer_id and warehouse_id are required');
    if (!items.length) throw new Error('Add at least one item');
    const return_number = nextSerial('sales_return');
    const result = db.prepare(`
      INSERT INTO sales_returns (return_number, so_id, customer_id, challan_id, warehouse_id, reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(return_number, so_id || null, customer_id, challan_id || null, warehouse_id, reason || null, userId);
    const returnId = result.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO sales_return_items (return_id, material_id, quantity, unit_of_measure, item_condition, remarks) VALUES (?, ?, ?, ?, ?, ?)');
    for (const item of items) {
      if (!item.material_id) continue;
      insertItem.run(returnId, item.material_id, parseFloat(item.quantity) || 0, item.unit_of_measure || null, item.item_condition || 'Good', item.remarks || null);
    }
    return { id: returnId, return_number };
  });
  try {
    const result = create(req.body, req.userId);
    res.status(201).json({ ...result, message: 'Sales return recorded — pending inspection/decision' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Accepting a return posts "Good" condition items back into usable, traceable
// stock; "Damaged"/"Rework" items are logged but deliberately NOT auto-added
// to usable stock (they need a QC/rework decision first — same gate the
// Quality module applies to incoming GRN stock).
app.put('/api/sales/returns/:id/decision', verifyToken, (req, res) => {
  const decide = db.transaction((id, status, userId) => {
    const ret = db.prepare('SELECT * FROM sales_returns WHERE id = ?').get(id);
    if (!ret) throw new Error('Return not found');
    if (ret.status !== 'Pending') throw new Error('This return has already been decided');
    db.prepare('UPDATE sales_returns SET status = ?, decided_by = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, userId, id);
    if (status === 'Accepted') {
      const items = db.prepare('SELECT * FROM sales_return_items WHERE return_id = ?').all(id);
      for (const item of items) {
        if (item.item_condition === 'Good') {
          addStockBatch(item.material_id, ret.warehouse_id, parseFloat(item.quantity), { source: 'Sales Return', source_reference: ret.return_number });
        }
      }
    }
  });
  try {
    decide(req.params.id, req.body.status, req.userId);
    res.json({ message: `Return ${req.body.status.toLowerCase()}` });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- Sales Invoices: real GST invoicing, consolidating multiple orders ---
app.get('/api/sales/invoices', verifyToken, (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT si.*, c.customer_name, so.so_number, dc.challan_number,
        (SELECT COUNT(DISTINCT so_id) FROM sales_invoice_items WHERE invoice_id = si.id) as order_count
      FROM sales_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN sales_orders so ON si.so_id = so.id
      LEFT JOIN delivery_challans dc ON si.challan_id = dc.id
      ORDER BY si.created_at DESC
    `).all() || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function getInvoiceWithItems(id) {
  const invoice = db.prepare(`
    SELECT si.*, c.customer_name, c.address as customer_address, c.city as customer_city, c.state as customer_state,
           c.gst_number as customer_gstin, c.phone as customer_phone
    FROM sales_invoices si LEFT JOIN customers c ON si.customer_id = c.id WHERE si.id = ?
  `).get(id);
  if (!invoice) return null;
  invoice.items = db.prepare(`
    SELECT sii.*, so.so_number, m.material_name
    FROM sales_invoice_items sii
    LEFT JOIN sales_orders so ON sii.so_id = so.id
    LEFT JOIN materials m ON sii.material_id = m.id
    WHERE sii.invoice_id = ? ORDER BY sii.id
  `).all(id);
  return invoice;
}

app.get('/api/sales/invoices/:id', verifyToken, (req, res) => {
  try {
    const invoice = getInvoiceWithItems(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Everything for this customer that's been dispatched but not yet fully
// invoiced — across every one of their sales orders. This is what "add
// multiple SO items from the same customer onto one invoice" is built on:
// the frontend shows this list, the user ticks what to bill, one invoice
// consolidates all of it.
app.get('/api/sales/customers/:id/billable-items', verifyToken, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT soi.id as so_item_id, soi.so_id, so.so_number, soi.material_id, m.material_name, m.hsn_code, m.gst_rate,
             soi.unit_of_measure, soi.unit_price, soi.tax_rate,
             soi.dispatched_quantity, soi.invoiced_quantity,
             (soi.dispatched_quantity - soi.invoiced_quantity) as billable_quantity
      FROM sales_order_items soi
      JOIN sales_orders so ON soi.so_id = so.id
      LEFT JOIN materials m ON soi.material_id = m.id
      WHERE so.customer_id = ? AND (soi.dispatched_quantity - soi.invoiced_quantity) > 0.001
      ORDER BY so.order_date ASC, soi.id ASC
    `).all(req.params.id);
    res.json(rows || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sales/invoices', verifyToken, (req, res) => {
  const create = db.transaction((body, userId) => {
    const { customer_id, invoice_date, due_date, items = [], external_reference, notes } = body;
    if (!customer_id) throw new Error('customer_id is required');
    if (!items.length) throw new Error('Add at least one billable line item');

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
    if (!customer) throw new Error('Customer not found');
    const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();
    // Standard Indian GST rule: same state as the seller → CGST+SGST split
    // (half the rate each); different state → IGST at the full rate.
    const isInterstate = !!(company && company.state && customer.state && company.state.trim().toLowerCase() !== customer.state.trim().toLowerCase());

    let taxable_value = 0, cgst_total = 0, sgst_total = 0, igst_total = 0;
    const preparedItems = items.map(it => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.unit_price) || 0;
      const rate = parseFloat(it.tax_rate) || 0;
      if (qty <= 0) throw new Error('Every line item needs a quantity greater than 0');
      const lineTaxable = Number((qty * price).toFixed(2));
      let cgst = 0, sgst = 0, igst = 0;
      if (isInterstate) {
        igst = Number((lineTaxable * rate / 100).toFixed(2));
      } else {
        cgst = Number((lineTaxable * rate / 200).toFixed(2));
        sgst = Number((lineTaxable * rate / 200).toFixed(2));
      }
      const lineTotal = Number((lineTaxable + cgst + sgst + igst).toFixed(2));
      taxable_value += lineTaxable; cgst_total += cgst; sgst_total += sgst; igst_total += igst;
      return {
        so_id: it.so_id || null, so_item_id: it.so_item_id || null, challan_id: it.challan_id || null,
        material_id: it.material_id || null, description: it.description || null, hsn_code: it.hsn_code || null,
        quantity: qty, unit_of_measure: it.unit_of_measure || null, unit_price: price, tax_rate: rate,
        taxable_value: lineTaxable, cgst_amount: cgst, sgst_amount: sgst, igst_amount: igst, line_total: lineTotal
      };
    });
    const tax_amount = Number((cgst_total + sgst_total + igst_total).toFixed(2));
    const grand_total = Number((taxable_value + tax_amount).toFixed(2));

    const invoice_number = nextSerial('sales_invoice');
    const firstItem = preparedItems[0];
    const result = db.prepare(`
      INSERT INTO sales_invoices
        (invoice_number, so_id, challan_id, customer_id, invoice_date, due_date, taxable_value, tax_amount, cgst_total, sgst_total, igst_total, is_interstate, place_of_supply, grand_total, external_reference, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoice_number, firstItem.so_id, firstItem.challan_id, customer_id, invoice_date || new Date().toISOString().split('T')[0], due_date || null,
      Number(taxable_value.toFixed(2)), tax_amount, cgst_total, sgst_total, igst_total, isInterstate ? 1 : 0, customer.state || null,
      grand_total, external_reference || null, notes || null, userId);
    const invoiceId = result.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO sales_invoice_items (invoice_id, so_id, so_item_id, challan_id, material_id, description, hsn_code, quantity, unit_of_measure, unit_price, tax_rate, taxable_value, cgst_amount, sgst_amount, igst_amount, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const it of preparedItems) {
      // Description always carries the SO reference, so a printed invoice
      // line is never ambiguous about which order it was billing.
      const so = it.so_id ? db.prepare('SELECT so_number FROM sales_orders WHERE id = ?').get(it.so_id) : null;
      const finalDescription = so ? `${it.description || ''}${it.description ? ' — ' : ''}Ref: SO ${so.so_number}`.trim() : (it.description || '');
      insertItem.run(invoiceId, it.so_id, it.so_item_id, it.challan_id, it.material_id, finalDescription, it.hsn_code,
        it.quantity, it.unit_of_measure, it.unit_price, it.tax_rate, it.taxable_value, it.cgst_amount, it.sgst_amount, it.igst_amount, it.line_total);

      // Mark exactly this much of the source SO line as now invoiced, so
      // the same dispatched goods can't be billed twice on a later invoice.
      if (it.so_item_id) {
        db.prepare('UPDATE sales_order_items SET invoiced_quantity = invoiced_quantity + ? WHERE id = ?').run(it.quantity, it.so_item_id);
      }
    }

    // If every item on the source challan(s) is now fully invoiced, tag
    // the challan itself so the dispatch list shows it as billed.
    const challanIds = [...new Set(preparedItems.map(it => it.challan_id).filter(Boolean))];
    for (const cId of challanIds) {
      db.prepare("UPDATE delivery_challans SET invoice_id = ? WHERE id = ? AND invoice_id IS NULL").run(invoiceId, cId);
    }

    return { id: invoiceId, invoice_number };
  });
  try {
    const result = create(req.body, req.userId);
    res.status(201).json({ ...result, message: 'Invoice generated successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/sales/invoices/:id/record-payment', verifyToken, (req, res) => {
  const record = db.transaction((invoiceId, body, userId) => {
    const invoice = db.prepare('SELECT * FROM sales_invoices WHERE id = ?').get(invoiceId);
    if (!invoice) throw new Error('Invoice not found');
    const amount = parseFloat(body.amount) || 0;
    if (amount <= 0) throw new Error('amount must be greater than 0');
    const newPaid = parseFloat(invoice.paid_amount) + amount;
    const status = newPaid >= invoice.grand_total - 0.0001 ? 'Paid' : 'Partially Paid';
    db.prepare('UPDATE sales_invoices SET paid_amount = ?, status = ? WHERE id = ?').run(newPaid, status, invoiceId);
    // Same auditable payment trail the vendor/payable side already has
    // (payment_vouchers) — every receipt against an invoice is logged,
    // not just the running total.
    const receipt_number = nextSerial('customer_receipt');
    db.prepare(`
      INSERT INTO customer_payment_receipts (receipt_number, invoice_id, amount, payment_mode, reference_number, remarks, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(receipt_number, invoiceId, amount, body.payment_mode || null, body.reference_number || null, body.remarks || null, userId);
    return { status, receipt_number };
  });
  try {
    const { status, receipt_number } = record(req.params.id, req.body, req.userId);
    res.json({ message: `Payment of ₹${req.body.amount} recorded (${receipt_number})`, status });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- Dashboard: pending orders + customer dispatch history ---
app.get('/api/sales/dashboard', verifyToken, (req, res) => {
  try {
    const pendingOrders = db.prepare(`
      SELECT so.id, so.so_number, so.status, so.expected_delivery_date, c.customer_name,
        (SELECT COALESCE(SUM(quantity),0) FROM sales_order_items WHERE so_id = so.id) as ordered_qty,
        (SELECT COALESCE(SUM(dispatched_quantity),0) FROM sales_order_items WHERE so_id = so.id) as dispatched_qty
      FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id
      WHERE so.status NOT IN ('Dispatched', 'Completed', 'Cancelled')
      ORDER BY so.expected_delivery_date ASC
    `).all();
    const upcomingDispatch = db.prepare(`
      SELECT dp.plan_number, dp.planned_date, dp.status, so.so_number, c.customer_name
      FROM dispatch_plans dp LEFT JOIN sales_orders so ON dp.so_id = so.id LEFT JOIN customers c ON so.customer_id = c.id
      WHERE dp.status IN ('Planned', 'In Progress') ORDER BY dp.planned_date ASC LIMIT 20
    `).all();
    const counts = {
      total_quotations: db.prepare("SELECT COUNT(*) as c FROM sales_quotations").get().c,
      pending_orders: pendingOrders.length,
      dispatched_this_month: db.prepare("SELECT COUNT(*) as c FROM delivery_challans WHERE challan_date >= date('now','start of month')").get().c,
      pending_returns: db.prepare("SELECT COUNT(*) as c FROM sales_returns WHERE status = 'Pending'").get().c,
      unpaid_invoices_value: db.prepare("SELECT COALESCE(SUM(grand_total - paid_amount),0) as v FROM sales_invoices WHERE status != 'Paid'").get().v
    };
    res.json({ counts, pending_orders: pendingOrders, upcoming_dispatch: upcomingDispatch });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== Round 24: POS / Counter Billing (Trading Edition) =====
// A POS sale deliberately skips Sales Order -> Dispatch Planning ->
// Delivery Challan -> Invoice (the B2B flow) and goes straight to a
// finished invoice in one atomic step — a shop counter doesn't have five
// minutes per customer. It still lands in the exact same `sales_invoices`
// /`sales_invoice_items` tables as a consolidated B2B invoice, tagged
// `channel = 'POS'`, so it shows up in GST Summary, Receivables, and
// Tally/Busy staging automatically — no separate reporting path to keep
// in sync.

// Ensures every SAKAAR ERP install always has a valid "walk-in" customer
// row to bill against when nobody bothers picking a real customer at the
// counter — created once, reused forever.
function getOrCreateWalkInCustomer() {
  let customer = db.prepare("SELECT * FROM customers WHERE customer_code = 'WALKIN'").get();
  if (customer) return customer;
  const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();
  db.prepare(`
    INSERT INTO customers (customer_code, customer_name, state, is_active) VALUES ('WALKIN', 'Walk-in Customer', ?, 1)
  `).run(company ? company.state : null);
  return db.prepare("SELECT * FROM customers WHERE customer_code = 'WALKIN'").get();
}

// Shared GST + discount math: line-level discounts reduce that line's own
// taxable value directly; a bill-level discount (e.g. "₹50 off, loyalty")
// is prorated across lines by their share of the post-line-discount
// subtotal, so every line's tax stays mathematically consistent with
// exactly what it contributed to the final bill — not just lumped onto
// one line or applied after tax (which GST doesn't allow).
function computePosLines(items, isInterstate, billDiscount) {
  const lines = items.map(it => {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.unit_price) || 0;
    const rate = parseFloat(it.tax_rate) || 0;
    const lineDiscount = Math.max(0, parseFloat(it.discount_amount) || 0);
    if (qty <= 0) throw new Error('Every line needs a quantity greater than 0');
    const grossBase = qty * price;
    const netBase = Math.max(0, grossBase - lineDiscount);
    return { ...it, qty, price, rate, lineDiscount, netBase };
  });
  const subtotal = lines.reduce((s, l) => s + l.netBase, 0);
  const billDiscountAmt = Math.min(Math.max(0, parseFloat(billDiscount) || 0), subtotal);

  let taxable_value = 0, cgst_total = 0, sgst_total = 0, igst_total = 0;
  const preparedItems = lines.map(l => {
    const share = subtotal > 0 ? l.netBase / subtotal : 0;
    const proratedBillDiscount = Number((billDiscountAmt * share).toFixed(2));
    const finalTaxable = Number(Math.max(0, l.netBase - proratedBillDiscount).toFixed(2));
    let cgst = 0, sgst = 0, igst = 0;
    if (isInterstate) {
      igst = Number((finalTaxable * l.rate / 100).toFixed(2));
    } else {
      cgst = Number((finalTaxable * l.rate / 200).toFixed(2));
      sgst = cgst;
    }
    const lineTotal = Number((finalTaxable + cgst + sgst + igst).toFixed(2));
    taxable_value += finalTaxable; cgst_total += cgst; sgst_total += sgst; igst_total += igst;
    return {
      material_id: l.material_id, description: l.description, hsn_code: l.hsn_code, quantity: l.qty,
      unit_of_measure: l.unit_of_measure, unit_price: l.price, tax_rate: l.rate,
      discount_amount: Number((l.lineDiscount + proratedBillDiscount).toFixed(2)),
      taxable_value: finalTaxable, cgst_amount: cgst, sgst_amount: sgst, igst_amount: igst, line_total: lineTotal
    };
  });
  const tax_amount = Number((cgst_total + sgst_total + igst_total).toFixed(2));
  const grand_total = Number((taxable_value + tax_amount).toFixed(2));
  return { preparedItems, taxable_value: Number(taxable_value.toFixed(2)), tax_amount, cgst_total, sgst_total, igst_total, grand_total, discount_amount: billDiscountAmt };
}

// Search-as-you-type for the billing screen: exact barcode match first
// (a scanner sends the code and hits Enter), else a name/code partial
// match. Includes current free stock in the chosen warehouse so a cashier
// sees availability before adding a line.
app.get('/api/pos/search', verifyToken, (req, res) => {
  try {
    const { q, warehouse_id } = req.query;
    if (!q || !q.trim()) return res.json([]);
    const term = q.trim();
    const byBarcode = db.prepare('SELECT * FROM materials WHERE barcode = ? AND is_active = 1').all(term);
    const byName = db.prepare(`
      SELECT * FROM materials WHERE is_active = 1 AND (material_name LIKE ? OR material_code LIKE ?)
      ORDER BY material_name LIMIT 15
    `).all(`%${term}%`, `%${term}%`);
    const seen = new Set();
    const results = [...byBarcode, ...byName].filter(m => (seen.has(m.id) ? false : (seen.add(m.id), true)));
    const withStock = results.map(m => {
      const stock = warehouse_id
        ? db.prepare('SELECT quantity FROM stock_ledger WHERE material_id = ? AND warehouse_id = ?').get(m.id, warehouse_id)
        : null;
      return {
        id: m.id, material_name: m.material_name, material_code: m.material_code, barcode: m.barcode,
        unit_of_measure: m.unit_of_measure, hsn_code: m.hsn_code, gst_rate: m.gst_rate,
        default_sale_price: m.default_sale_price, stock_available: stock ? stock.quantity : null
      };
    });
    res.json(withStock);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/pos/today-summary', verifyToken, (req, res) => {
  try {
    const { warehouse_id } = req.query;
    const params = [];
    let where = "WHERE channel = 'POS' AND date(created_at) = date('now')";
    if (warehouse_id) { where += ' AND warehouse_id = ?'; params.push(warehouse_id); }
    const rows = db.prepare(`SELECT payment_mode, grand_total FROM sales_invoices ${where}`).all(...params);
    const byMode = {};
    let total = 0;
    for (const r of rows) {
      byMode[r.payment_mode || 'Unspecified'] = (byMode[r.payment_mode || 'Unspecified'] || 0) + parseFloat(r.grand_total);
      total += parseFloat(r.grand_total);
    }
    res.json({ bill_count: rows.length, total_revenue: Number(total.toFixed(2)), by_payment_mode: byMode });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/pos/invoice/:id', verifyToken, (req, res) => {
  try {
    const invoice = getInvoiceWithItems(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bill history for the "reprint an old bill" screen — searchable by
// invoice number, customer name, or the phone number captured at sale
// time, with an optional date range and outlet filter.
app.get('/api/pos/sales', verifyToken, (req, res) => {
  try {
    const { from, to, warehouse_id, search } = req.query;
    const conditions = ["si.channel = 'POS'"];
    const params = [];
    if (from) { conditions.push('date(si.invoice_date) >= date(?)'); params.push(from); }
    if (to) { conditions.push('date(si.invoice_date) <= date(?)'); params.push(to); }
    if (warehouse_id) { conditions.push('si.warehouse_id = ?'); params.push(warehouse_id); }
    if (search && search.trim()) {
      conditions.push('(si.invoice_number LIKE ? OR c.customer_name LIKE ? OR si.customer_mobile LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }
    const rows = db.prepare(`
      SELECT si.id, si.invoice_number, si.invoice_date, si.grand_total, si.payment_mode, si.status,
             si.customer_mobile, c.customer_name, w.warehouse_name
      FROM sales_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN warehouses w ON si.warehouse_id = w.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY si.created_at DESC LIMIT 200
    `).all(...params);
    res.json(rows || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/pos/sale', verifyToken, (req, res) => {
  const create = db.transaction((body, userId) => {
    const { warehouse_id, customer_id, customer_mobile, payment_mode, discount_amount, items = [] } = body;
    if (!warehouse_id) throw new Error('warehouse_id is required');
    if (!items.length) throw new Error('The cart is empty');
    if (!['Cash', 'UPI', 'Card', 'Credit'].includes(payment_mode)) throw new Error('payment_mode must be Cash, UPI, Card, or Credit');

    const mobile = customer_mobile ? customer_mobile.trim() : null;
    let customer;
    if (customer_id) {
      customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
    } else if (mobile) {
      // A phone number was typed but no customer picked from the list —
      // if it matches someone already on file, link the sale to them
      // automatically (better repeat-customer history); otherwise it's
      // still captured as a plain phone number on the invoice below,
      // without forcing a full customer record into existence.
      customer = db.prepare('SELECT * FROM customers WHERE phone = ? AND is_active = 1').get(mobile) || getOrCreateWalkInCustomer();
    } else {
      customer = getOrCreateWalkInCustomer();
    }
    if (!customer) throw new Error('Customer not found');
    if (payment_mode === 'Credit' && customer.customer_code === 'WALKIN') {
      throw new Error('Credit sales need a real customer on file — pick one instead of Walk-in, so there is someone to collect payment from.');
    }
    const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();
    const isInterstate = !!(company && company.state && customer.state && company.state.trim().toLowerCase() !== customer.state.trim().toLowerCase());

    // Enrich each line with the material's HSN/description before running
    // the GST/discount math, and confirm stock up front so a mid-sale
    // failure never leaves half a bill partially deducted.
    const enrichedItems = items.map(it => {
      const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(it.material_id);
      if (!material) throw new Error(`Material #${it.material_id} not found`);
      const qty = parseFloat(it.quantity) || 0;
      const ledger = db.prepare('SELECT quantity FROM stock_ledger WHERE material_id = ? AND warehouse_id = ?').get(it.material_id, warehouse_id);
      if (!ledger || ledger.quantity < qty - 0.001) {
        throw new Error(`Insufficient stock for ${material.material_name}: need ${qty}, have ${ledger ? ledger.quantity : 0}`);
      }
      return {
        material_id: it.material_id, description: material.material_name, hsn_code: material.hsn_code,
        quantity: qty, unit_of_measure: material.unit_of_measure, unit_price: parseFloat(it.unit_price) || 0,
        tax_rate: it.tax_rate !== undefined ? parseFloat(it.tax_rate) : parseFloat(material.gst_rate) || 0,
        discount_amount: it.discount_amount || 0
      };
    });

    const { preparedItems, taxable_value, tax_amount, cgst_total, sgst_total, igst_total, grand_total, discount_amount: billDiscountFinal }
      = computePosLines(enrichedItems, isInterstate, discount_amount);

    const invoice_number = nextSerial('sales_invoice');
    const isPaidNow = payment_mode !== 'Credit';
    const result = db.prepare(`
      INSERT INTO sales_invoices
        (invoice_number, customer_id, customer_mobile, invoice_date, taxable_value, tax_amount, cgst_total, sgst_total, igst_total, is_interstate,
         place_of_supply, discount_amount, grand_total, paid_amount, status, channel, payment_mode, warehouse_id, created_by)
      VALUES (?, ?, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'POS', ?, ?, ?)
    `).run(invoice_number, customer.id, mobile, taxable_value, tax_amount, cgst_total, sgst_total, igst_total, isInterstate ? 1 : 0,
      customer.state || null, billDiscountFinal, grand_total, isPaidNow ? grand_total : 0, isPaidNow ? 'Paid' : 'Pending', payment_mode, warehouse_id, userId);
    const invoiceId = result.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO sales_invoice_items (invoice_id, material_id, description, hsn_code, quantity, unit_of_measure, unit_price, tax_rate, discount_amount, taxable_value, cgst_amount, sgst_amount, igst_amount, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const it of preparedItems) {
      insertItem.run(invoiceId, it.material_id, it.description, it.hsn_code, it.quantity, it.unit_of_measure, it.unit_price,
        it.tax_rate, it.discount_amount, it.taxable_value, it.cgst_amount, it.sgst_amount, it.igst_amount, it.line_total);
      consumeStock(it.material_id, warehouse_id, it.quantity);
    }

    if (isPaidNow) {
      const receipt_number = nextSerial('customer_receipt');
      db.prepare(`
        INSERT INTO customer_payment_receipts (receipt_number, invoice_id, amount, payment_mode, remarks, created_by)
        VALUES (?, ?, ?, ?, 'POS counter sale', ?)
      `).run(receipt_number, invoiceId, grand_total, payment_mode, userId);
    }

    return { id: invoiceId, invoice_number, grand_total };
  });
  try {
    const result = create(req.body, req.userId);
    res.status(201).json({ ...result, message: `Sale completed — ${result.invoice_number}` });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/sales/customers/:id/dispatch-history', verifyToken, (req, res) => {
  try {
    const history = db.prepare(`
      SELECT dc.*, so.so_number FROM delivery_challans dc
      LEFT JOIN sales_orders so ON dc.so_id = so.id
      WHERE so.customer_id = ? ORDER BY dc.created_at DESC
    `).all(req.params.id);
    for (const c of history) {
      c.items = db.prepare('SELECT dci.*, m.material_name FROM delivery_challan_items dci LEFT JOIN materials m ON dci.material_id = m.id WHERE dci.challan_id = ?').all(c.id);
    }
    res.json(history || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== Round 17: Available-to-Promise / Order Fulfillment Check =====
// The core question this answers: "for this order, can we ship straight
// from free finished-goods stock, or do we need to produce — and if we
// need to produce, do we have the raw material, or do we need to raise a
// purchase order?" It's read-only (a report), it never reserves or moves
// anything by itself.

// Total usable finished stock for a material across all warehouses, minus
// whatever is already committed (ordered-but-not-yet-dispatched) to every
// OTHER active sales order. What's left is genuinely free / unlinked.
function getFreeFinishedStock(materialId, excludeSoId) {
  const totalStock = db.prepare('SELECT COALESCE(SUM(quantity),0) as qty FROM stock_ledger WHERE material_id = ?').get(materialId).qty;
  const committed = db.prepare(`
    SELECT COALESCE(SUM(soi.quantity - soi.dispatched_quantity),0) as qty
    FROM sales_order_items soi
    JOIN sales_orders so ON soi.so_id = so.id
    WHERE soi.material_id = ? AND so.id != ? AND so.status NOT IN ('Draft','Cancelled','Completed','Dispatched')
  `).get(materialId, excludeSoId || 0).qty;
  return Math.max(0, Number((totalStock - committed).toFixed(2)));
}

// Raw-material-side picture for one material: what's free & usable, what's
// sitting in QC (pending inspection or on hold), and what's still open on
// a purchase order (ordered but not yet received).
function getMaterialSupplyBreakdown(materialId) {
  const free = db.prepare('SELECT COALESCE(SUM(quantity),0) as qty FROM stock_ledger WHERE material_id = ?').get(materialId).qty;
  const qcPending = db.prepare('SELECT COALESCE(SUM(quantity),0) as qty FROM qc_pending_stock WHERE material_id = ?').get(materialId).qty;
  const qcHold = db.prepare('SELECT COALESCE(SUM(quantity),0) as qty FROM qc_hold_stock WHERE material_id = ?').get(materialId).qty;
  const onOrder = db.prepare(`
    SELECT COALESCE(SUM(poi.quantity - poi.received_quantity),0) as qty
    FROM purchase_order_items poi JOIN purchase_orders po ON poi.po_id = po.id
    WHERE poi.material_id = ? AND po.status NOT IN ('Draft','Rejected','Cancelled') AND poi.quantity > poi.received_quantity
  `).get(materialId).qty;
  return {
    free_stock: Number(free.toFixed(2)),
    qc_pending: Number(qcPending.toFixed(2)),
    qc_hold: Number(qcHold.toFixed(2)),
    on_order: Number(onOrder.toFixed(2))
  };
}

// Explodes the primary BOM for a finished material by `shortfallQty` and
// returns per-RM requirement vs. supply. Returns null if no BOM/output
// link exists, so the caller can say "can't compute — no BOM" honestly
// instead of pretending.
function explodeRawMaterialNeed(outputMaterialId, shortfallQty) {
  const recipe = db.prepare(`
    SELECT * FROM production_recipes WHERE output_material_id = ? AND is_alternate = 0 AND is_active = 1 ORDER BY id LIMIT 1
  `).get(outputMaterialId);
  if (!recipe) return null;
  const items = db.prepare(`
    SELECT pri.*, m.material_name, m.material_code FROM production_recipe_items pri
    LEFT JOIN materials m ON pri.material_id = m.id WHERE pri.recipe_id = ?
  `).all(recipe.id);
  const multiplier = recipe.output_quantity ? shortfallQty / parseFloat(recipe.output_quantity) : 0;
  const materials = items.map(item => {
    const required = (parseFloat(item.input_quantity) || 0) * multiplier * (1 + (parseFloat(item.scrap_percent) || 0) / 100);
    const supply = getMaterialSupplyBreakdown(item.material_id);
    const shortage = Math.max(0, Number((required - supply.free_stock).toFixed(2)));
    let status;
    if (shortage <= 0.001) status = 'Available';
    else if (shortage <= supply.on_order + 0.001) status = 'Shortage — covered by open PO';
    else status = 'Shortage — raise indent/PO';
    return {
      material_id: item.material_id, material_name: item.material_name, material_code: item.material_code,
      required_quantity: Number(required.toFixed(2)), unit: item.input_unit, ...supply, shortage_after_stock: shortage, status
    };
  });
  const requiredOutputWeightKg = Number((shortfallQty * (parseFloat(recipe.weight_per_output_unit) || 1)).toFixed(2));
  return {
    bom_id: recipe.id, bom_name: recipe.product_name, bom_alias: recipe.alias,
    shortfall_quantity: Number(shortfallQty.toFixed(2)), output_unit: recipe.output_unit,
    required_output_weight_kg: requiredOutputWeightKg,
    materials,
    can_produce_now: materials.every(m => m.status === 'Available'),
    materials_needing_purchase: materials.filter(m => m.status === 'Shortage — raise indent/PO').length
  };
}

function buildOrderAvailability(soId) {
  const so = getSalesOrderWithItems(soId);
  if (!so) return null;
  const lines = so.items.map(item => {
    const pendingQty = Number((parseFloat(item.quantity) - parseFloat(item.dispatched_quantity || 0)).toFixed(2));
    if (pendingQty <= 0) {
      return { so_item_id: item.id, material_id: item.material_id, material_name: item.material_name, pending_quantity: 0, decision: 'Fully Dispatched' };
    }
    const freeStock = getFreeFinishedStock(item.material_id, soId);
    const shippableNow = Math.min(freeStock, pendingQty);
    const shortfall = Number((pendingQty - shippableNow).toFixed(2));
    const line = {
      so_item_id: item.id, material_id: item.material_id, material_name: item.material_name, material_code: item.material_code,
      pending_quantity: pendingQty, free_finished_stock: freeStock, shippable_now: Number(shippableNow.toFixed(2)), shortfall
    };
    if (shortfall <= 0.001) {
      line.decision = 'Ship Now — Fully Available in Stock';
    } else {
      const rmPlan = explodeRawMaterialNeed(item.material_id, shortfall);
      line.production_plan = rmPlan;
      if (!rmPlan) {
        line.decision = shippableNow > 0 ? 'Partial Ship Now — remainder has no BOM linked, cannot plan production' : 'No BOM linked — cannot compute raw material requirement';
      } else if (rmPlan.can_produce_now) {
        line.decision = shippableNow > 0 ? 'Partial Ship Now + Produce Remainder (RM Available)' : 'Produce — Raw Material Available';
      } else {
        line.decision = shippableNow > 0 ? 'Partial Ship Now + Produce Remainder (RM Shortage)' : 'Produce — Raw Material Shortage, Raise Purchase';
      }
    }
    return line;
  });
  const overall = lines.some(l => l.decision && l.decision.includes('Shortage') && !l.decision.includes('covered'))
    ? 'Raw Material Shortage — Purchase Required'
    : lines.some(l => l.decision && (l.decision.includes('Produce') || l.decision.includes('No BOM')))
      ? 'Production Required'
      : 'Ready to Ship';
  return { so_id: so.id, so_number: so.so_number, customer_name: so.customer_name, overall_status: overall, lines };
}

app.get('/api/sales/orders/:id/availability', verifyToken, (req, res) => {
  try {
    const result = buildOrderAvailability(req.params.id);
    if (!result) return res.status(404).json({ error: 'Sales order not found' });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Same check for a single material/quantity, without needing a sales
// order to exist yet (useful for a quick "can we take this order?" check
// while quoting).
app.get('/api/sales/availability-check', verifyToken, (req, res) => {
  try {
    const { material_id, quantity } = req.query;
    if (!material_id || !quantity) return res.status(400).json({ error: 'material_id and quantity query params are required' });
    const qty = parseFloat(quantity);
    const freeStock = getFreeFinishedStock(material_id, 0);
    const shippableNow = Math.min(freeStock, qty);
    const shortfall = Number((qty - shippableNow).toFixed(2));
    const result = { material_id: Number(material_id), requested_quantity: qty, free_finished_stock: freeStock, shippable_now: shippableNow, shortfall };
    if (shortfall > 0.001) result.production_plan = explodeRawMaterialNeed(material_id, shortfall);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== FINANCE & COMMERCIAL CONTROLS =====

// --- Expenses (generic capture, not tied to a PO) ---
app.get('/api/finance/expenses', verifyToken, (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT e.*, v.vendor_name, u.full_name as created_by_name
      FROM expense_entries e
      LEFT JOIN vendors v ON e.vendor_id = v.id
      LEFT JOIN users u ON e.created_by = u.id
      ORDER BY e.created_at DESC
    `).all() || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/finance/expenses', verifyToken, (req, res) => {
  try {
    const { expense_date, category, vendor_id, department, taxable_value, tax_amount, hsn_sac_code, gst_class, paid_through, payment_reference, remarks } = req.body;
    if (!category) return res.status(400).json({ error: 'category is required' });
    const taxable = parseFloat(taxable_value) || 0;
    const tax = parseFloat(tax_amount) || 0;
    const grand_total = taxable + tax;
    const expense_number = nextSerial('expense');
    const result = db.prepare(`
      INSERT INTO expense_entries (expense_number, expense_date, category, vendor_id, department, taxable_value, tax_amount, grand_total, hsn_sac_code, gst_class, paid_through, payment_reference, paid_amount, status, remarks, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(expense_number, expense_date || new Date().toISOString().split('T')[0], category, vendor_id || null, department || null, taxable, tax, grand_total,
      hsn_sac_code || null, gst_class || null, paid_through || null, payment_reference || null,
      paid_through ? grand_total : 0, paid_through ? 'Paid' : 'Recorded', remarks || null, req.userId);
    res.status(201).json({ id: result.lastInsertRowid, expense_number, message: 'Expense recorded successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/finance/expenses/:id/record-payment', verifyToken, (req, res) => {
  try {
    const expense = db.prepare('SELECT * FROM expense_entries WHERE id = ?').get(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    const amount = parseFloat(req.body.amount) || 0;
    if (amount <= 0) return res.status(400).json({ error: 'amount must be greater than 0' });
    const newPaid = parseFloat(expense.paid_amount) + amount;
    const status = newPaid >= expense.grand_total - 0.0001 ? 'Paid' : 'Partially Paid';
    db.prepare('UPDATE expense_entries SET paid_amount = ?, status = ?, paid_through = ?, payment_reference = ? WHERE id = ?')
      .run(newPaid, status, req.body.paid_through || expense.paid_through, req.body.payment_reference || expense.payment_reference, req.params.id);
    res.json({ message: `Payment of ₹${amount} recorded against ${expense.expense_number}`, status });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- Accounts Payable summary (vendor side) ---
function agingBucket(dueDate) {
  if (!dueDate) return '0-30';
  const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

app.get('/api/finance/payables-summary', verifyToken, (req, res) => {
  try {
    const openInvoices = db.prepare(`
      SELECT vi.*, v.vendor_name FROM vendor_invoices vi LEFT JOIN vendors v ON vi.vendor_id = v.id
      WHERE vi.status != 'Paid'
    `).all();
    const openExpenses = db.prepare(`
      SELECT e.*, v.vendor_name FROM expense_entries e LEFT JOIN vendors v ON e.vendor_id = v.id
      WHERE e.status != 'Paid'
    `).all();
    const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    let totalOutstanding = 0;
    const vendorMap = {};
    for (const inv of openInvoices) {
      const outstanding = parseFloat(inv.grand_total) - parseFloat(inv.paid_amount);
      totalOutstanding += outstanding;
      aging[agingBucket(inv.due_date)] += outstanding;
      const key = inv.vendor_id || 'unknown';
      vendorMap[key] = vendorMap[key] || { vendor_id: inv.vendor_id, vendor_name: inv.vendor_name, outstanding: 0, invoice_count: 0 };
      vendorMap[key].outstanding += outstanding;
      vendorMap[key].invoice_count += 1;
    }
    for (const exp of openExpenses) {
      const outstanding = parseFloat(exp.grand_total) - parseFloat(exp.paid_amount);
      totalOutstanding += outstanding;
      aging[agingBucket(exp.expense_date)] += outstanding;
      if (exp.vendor_id) {
        const key = exp.vendor_id;
        vendorMap[key] = vendorMap[key] || { vendor_id: exp.vendor_id, vendor_name: exp.vendor_name, outstanding: 0, invoice_count: 0 };
        vendorMap[key].outstanding += outstanding;
        vendorMap[key].invoice_count += 1;
      }
    }
    Object.values(aging).forEach((_, k) => {});
    for (const k in aging) aging[k] = Number(aging[k].toFixed(2));
    res.json({
      total_outstanding: Number(totalOutstanding.toFixed(2)),
      aging,
      by_vendor: Object.values(vendorMap).sort((a, b) => b.outstanding - a.outstanding).map(v => ({ ...v, outstanding: Number(v.outstanding.toFixed(2)) }))
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/finance/vendor-outstanding', verifyToken, (req, res) => {
  try {
    const invoices = db.prepare(`
      SELECT vi.*, v.vendor_name, po.po_number FROM vendor_invoices vi
      LEFT JOIN vendors v ON vi.vendor_id = v.id
      LEFT JOIN purchase_orders po ON vi.po_id = po.id
      WHERE vi.status != 'Paid' ORDER BY v.vendor_name, vi.due_date ASC
    `).all();
    res.json(invoices.map(i => ({ ...i, outstanding: Number((parseFloat(i.grand_total) - parseFloat(i.paid_amount)).toFixed(2)), aging_bucket: agingBucket(i.due_date) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Accounts Receivable summary (customer side) ---
app.get('/api/finance/receivables-summary', verifyToken, (req, res) => {
  try {
    const openInvoices = db.prepare(`
      SELECT si.*, c.customer_name FROM sales_invoices si LEFT JOIN customers c ON si.customer_id = c.id
      WHERE si.status != 'Paid'
    `).all();
    const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    let totalOutstanding = 0;
    const customerMap = {};
    for (const inv of openInvoices) {
      const outstanding = parseFloat(inv.grand_total) - parseFloat(inv.paid_amount);
      totalOutstanding += outstanding;
      aging[agingBucket(inv.due_date)] += outstanding;
      const key = inv.customer_id;
      customerMap[key] = customerMap[key] || { customer_id: inv.customer_id, customer_name: inv.customer_name, outstanding: 0, invoice_count: 0 };
      customerMap[key].outstanding += outstanding;
      customerMap[key].invoice_count += 1;
    }
    for (const k in aging) aging[k] = Number(aging[k].toFixed(2));

    // Goods already dispatched to a customer but not yet pulled onto an
    // invoice — a real amount owed, even before the paperwork catches up.
    // Kept separate from `total_outstanding` (which is only what's been
    // formally invoiced) so the two never get confused with each other,
    // but surfaced right here in Receivables per your request.
    const dispatchedRows = db.prepare(`
      SELECT so.customer_id, c.customer_name, so.id as so_id, so.so_number,
             SUM((soi.dispatched_quantity - soi.invoiced_quantity) * soi.unit_price * (1 + COALESCE(soi.tax_rate,0)/100.0)) as accrued_value
      FROM sales_order_items soi
      JOIN sales_orders so ON soi.so_id = so.id
      JOIN customers c ON so.customer_id = c.id
      WHERE (soi.dispatched_quantity - soi.invoiced_quantity) > 0.001
      GROUP BY so.id
      ORDER BY accrued_value DESC
    `).all();
    let dispatchedNotInvoicedTotal = 0;
    const dispatchedByCustomerMap = {};
    for (const r of dispatchedRows) {
      const val = parseFloat(r.accrued_value) || 0;
      dispatchedNotInvoicedTotal += val;
      dispatchedByCustomerMap[r.customer_id] = dispatchedByCustomerMap[r.customer_id] || { customer_id: r.customer_id, customer_name: r.customer_name, accrued_value: 0, orders: [] };
      dispatchedByCustomerMap[r.customer_id].accrued_value += val;
      dispatchedByCustomerMap[r.customer_id].orders.push({ so_id: r.so_id, so_number: r.so_number, value: Number(val.toFixed(2)) });
    }

    res.json({
      total_outstanding: Number(totalOutstanding.toFixed(2)),
      aging,
      by_customer: Object.values(customerMap).sort((a, b) => b.outstanding - a.outstanding).map(c => ({ ...c, outstanding: Number(c.outstanding.toFixed(2)) })),
      dispatched_awaiting_invoice: {
        total: Number(dispatchedNotInvoicedTotal.toFixed(2)),
        by_customer: Object.values(dispatchedByCustomerMap).sort((a, b) => b.accrued_value - a.accrued_value).map(c => ({ ...c, accrued_value: Number(c.accrued_value.toFixed(2)) }))
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/finance/customer-outstanding', verifyToken, (req, res) => {
  try {
    const invoices = db.prepare(`
      SELECT si.*, c.customer_name, so.so_number FROM sales_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN sales_orders so ON si.so_id = so.id
      WHERE si.status != 'Paid' ORDER BY c.customer_name, si.due_date ASC
    `).all();
    res.json(invoices.map(i => ({ ...i, outstanding: Number((parseFloat(i.grand_total) - parseFloat(i.paid_amount)).toFixed(2)), aging_bucket: agingBucket(i.due_date) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Basic cost & margin report ---
// Revenue is the real, invoiced/ordered figure. Cost is an ESTIMATE: for
// items with a BOM, it's the BOM's raw material requirement priced at
// each material's current weighted-average stock cost (same averaging
// the Inventory valuation report already uses) plus the BOM's
// Expenses/Unit; for items with no BOM (e.g. straight resale), it falls
// back to the item's own average stock cost. This is a standard-cost-style
// placeholder, not a true actual-cost/FIFO-traced number — good enough for
// a first-pass margin view, not for statutory costing.
function avgMaterialCost(materialId) {
  const row = db.prepare(`
    SELECT SUM(quantity_remaining * unit_cost) / NULLIF(SUM(CASE WHEN unit_cost IS NOT NULL THEN quantity_remaining ELSE 0 END), 0) as avg_cost
    FROM stock_batches WHERE material_id = ? AND quantity_remaining > 0
  `).get(materialId);
  return row && row.avg_cost ? parseFloat(row.avg_cost) : 0;
}

function estimateUnitCost(materialId) {
  const recipe = db.prepare(`SELECT * FROM production_recipes WHERE output_material_id = ? AND is_alternate = 0 AND is_active = 1 ORDER BY id LIMIT 1`).get(materialId);
  if (!recipe || !recipe.output_quantity) return avgMaterialCost(materialId);
  const items = db.prepare('SELECT * FROM production_recipe_items WHERE recipe_id = ?').all(recipe.id);
  const materialCost = items.reduce((sum, item) => {
    const qtyPerOutputUnit = (parseFloat(item.input_quantity) || 0) / parseFloat(recipe.output_quantity) * (1 + (parseFloat(item.scrap_percent) || 0) / 100);
    return sum + qtyPerOutputUnit * avgMaterialCost(item.material_id);
  }, 0);
  return materialCost + (parseFloat(recipe.expenses_per_unit) || 0);
}

app.get('/api/finance/margin-report', verifyToken, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT so.id, so.so_number, so.order_date, c.customer_name, so.grand_total, so.total_amount
      FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id
      WHERE so.status NOT IN ('Draft', 'Cancelled') ORDER BY so.order_date DESC LIMIT 200
    `).all();
    const report = orders.map(o => {
      const items = db.prepare('SELECT * FROM sales_order_items WHERE so_id = ?').all(o.id);
      let estimatedCost = 0;
      for (const item of items) {
        estimatedCost += estimateUnitCost(item.material_id) * parseFloat(item.quantity);
      }
      const revenue = parseFloat(o.total_amount) || 0; // pre-tax, so margin isn't distorted by GST
      const margin = revenue - estimatedCost;
      return {
        so_id: o.id, so_number: o.so_number, order_date: o.order_date, customer_name: o.customer_name,
        revenue: Number(revenue.toFixed(2)), estimated_cost: Number(estimatedCost.toFixed(2)),
        margin: Number(margin.toFixed(2)), margin_percent: revenue ? Number(((margin / revenue) * 100).toFixed(1)) : null
      };
    });
    const totals = report.reduce((acc, r) => ({ revenue: acc.revenue + r.revenue, cost: acc.cost + r.estimated_cost, margin: acc.margin + r.margin }), { revenue: 0, cost: 0, margin: 0 });
    res.json({
      orders: report,
      totals: { revenue: Number(totals.revenue.toFixed(2)), estimated_cost: Number(totals.cost.toFixed(2)), margin: Number(totals.margin.toFixed(2)), margin_percent: totals.revenue ? Number(((totals.margin / totals.revenue) * 100).toFixed(1)) : null }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- GST summary (output tax from sales, input tax from purchases/expenses) ---
app.get('/api/finance/gst-summary', verifyToken, (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = (col) => from && to ? `AND ${col} BETWEEN '${from}' AND '${to}'` : '';
    const outputTax = db.prepare(`SELECT COALESCE(SUM(taxable_value),0) as taxable, COALESCE(SUM(tax_amount),0) as tax FROM sales_invoices WHERE 1=1 ${dateFilter('invoice_date')}`).get();
    const inputTaxPurchase = db.prepare(`SELECT COALESCE(SUM(total_amount),0) as taxable, COALESCE(SUM(tax_amount),0) as tax FROM vendor_invoices WHERE 1=1 ${dateFilter('invoice_date')}`).get();
    const inputTaxExpense = db.prepare(`SELECT COALESCE(SUM(taxable_value),0) as taxable, COALESCE(SUM(tax_amount),0) as tax FROM expense_entries WHERE 1=1 ${dateFilter('expense_date')}`).get();
    const totalInputTax = inputTaxPurchase.tax + inputTaxExpense.tax;
    res.json({
      period: { from: from || null, to: to || null },
      output_tax: { taxable_value: outputTax.taxable, tax_collected: outputTax.tax },
      input_tax: {
        taxable_value: inputTaxPurchase.taxable + inputTaxExpense.taxable,
        tax_paid: Number(totalInputTax.toFixed(2)),
        from_purchases: inputTaxPurchase.tax, from_expenses: inputTaxExpense.tax
      },
      net_gst_payable: Number((outputTax.tax - totalInputTax).toFixed(2))
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Tally/Busy integration staging ---
app.get('/api/finance/staging', verifyToken, (req, res) => {
  try {
    const where = req.query.status ? 'WHERE export_status = ?' : '';
    const params = req.query.status ? [req.query.status] : [];
    res.json(db.prepare(`SELECT * FROM accounting_staging ${where} ORDER BY voucher_date DESC, id DESC`).all(...params) || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pulls every transaction not yet staged into a flat voucher row. Safe to
// run repeatedly — UNIQUE(source_table, source_id) means a transaction
// already staged is never duplicated.
app.post('/api/finance/staging/sync', verifyToken, (req, res) => {
  const sync = db.transaction(() => {
    const insertStaging = db.prepare(`
      INSERT OR IGNORE INTO accounting_staging (staging_number, voucher_type, voucher_date, reference_number, party_type, party_name, taxable_value, tax_amount, grand_total, narration, source_table, source_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    let count = 0;

    const vendorInvoices = db.prepare(`SELECT vi.*, v.vendor_name FROM vendor_invoices vi LEFT JOIN vendors v ON vi.vendor_id = v.id`).all();
    for (const inv of vendorInvoices) {
      const r = insertStaging.run(nextSerial('staging'), 'Purchase', inv.invoice_date, inv.invoice_number, 'Vendor', inv.vendor_name,
        inv.total_amount, inv.tax_amount, inv.grand_total, `Vendor invoice ${inv.invoice_number}`, 'vendor_invoices', inv.id);
      if (r.changes) count++;
    }
    const vouchers = db.prepare(`SELECT pv.*, vi.vendor_id, v.vendor_name FROM payment_vouchers pv LEFT JOIN vendor_invoices vi ON pv.invoice_id = vi.id LEFT JOIN vendors v ON vi.vendor_id = v.id`).all();
    for (const v of vouchers) {
      const r = insertStaging.run(nextSerial('staging'), 'Payment', v.payment_date, v.voucher_number, 'Vendor', v.vendor_name,
        v.amount, 0, v.amount, `Payment ${v.voucher_number} (${v.payment_mode})`, 'payment_vouchers', v.id);
      if (r.changes) count++;
    }
    const salesInvoices = db.prepare(`SELECT si.*, c.customer_name FROM sales_invoices si LEFT JOIN customers c ON si.customer_id = c.id`).all();
    for (const inv of salesInvoices) {
      const r = insertStaging.run(nextSerial('staging'), 'Sales', inv.invoice_date, inv.invoice_number, 'Customer', inv.customer_name,
        inv.taxable_value, inv.tax_amount, inv.grand_total, `Sales invoice ${inv.invoice_number}`, 'sales_invoices', inv.id);
      if (r.changes) count++;
    }
    const receipts = db.prepare(`SELECT cr.*, si.customer_id, c.customer_name FROM customer_payment_receipts cr LEFT JOIN sales_invoices si ON cr.invoice_id = si.id LEFT JOIN customers c ON si.customer_id = c.id`).all();
    for (const r2 of receipts) {
      const r = insertStaging.run(nextSerial('staging'), 'Receipt', r2.receipt_date, r2.receipt_number, 'Customer', r2.customer_name,
        r2.amount, 0, r2.amount, `Receipt ${r2.receipt_number} (${r2.payment_mode || 'N/A'})`, 'customer_payment_receipts', r2.id);
      if (r.changes) count++;
    }
    const expenses = db.prepare(`SELECT e.*, v.vendor_name FROM expense_entries e LEFT JOIN vendors v ON e.vendor_id = v.id`).all();
    for (const e of expenses) {
      const r = insertStaging.run(nextSerial('staging'), 'Expense', e.expense_date, e.expense_number, e.vendor_id ? 'Vendor' : 'Other', e.vendor_name || e.category,
        e.taxable_value, e.tax_amount, e.grand_total, `Expense ${e.expense_number} (${e.category})`, 'expense_entries', e.id);
      if (r.changes) count++;
    }
    return count;
  });
  try {
    const newCount = sync();
    res.json({ message: `${newCount} new voucher(s) staged for export`, new_count: newCount });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// CSV export (Tally/Busy typically accept a CSV/XML import) of everything
// still Pending, and marks it Exported so a re-export doesn't duplicate.
app.get('/api/finance/staging/export', verifyToken, (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM accounting_staging WHERE export_status = 'Pending' ORDER BY voucher_date ASC").all();
    const header = 'Voucher Number,Voucher Type,Date,Reference,Party Type,Party Name,Taxable Value,Tax Amount,Grand Total,Narration\n';
    const escapeCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const body = rows.map(r => [r.staging_number, r.voucher_type, r.voucher_date, r.reference_number, r.party_type, r.party_name, r.taxable_value, r.tax_amount, r.grand_total, r.narration].map(escapeCsv).join(',')).join('\n');
    if (rows.length) {
      const ids = rows.map(r => r.id);
      db.prepare(`UPDATE accounting_staging SET export_status = 'Exported', exported_at = CURRENT_TIMESTAMP WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="accounting_export.csv"');
    res.send(header + body);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== EMPLOYEE ADVANCE & EXPENSE CLAIMS =====
function getClaimWithItems(id) {
  const claim = db.prepare(`
    SELECT ec.*, e.full_name as employee_full_name, m.full_name as manager_full_name,
           sb.full_name as settled_by_name, mb.full_name as manager_action_by_name,
           c.customer_name, adv.claim_number as linked_advance_number
    FROM expense_claims ec
    LEFT JOIN users e ON ec.employee_id = e.id
    LEFT JOIN users m ON ec.manager_id = m.id
    LEFT JOIN users sb ON ec.settled_by = sb.id
    LEFT JOIN users mb ON ec.manager_action_by = mb.id
    LEFT JOIN customers c ON ec.customer_id = c.id
    LEFT JOIN expense_claims adv ON ec.linked_advance_claim_id = adv.id
    WHERE ec.id = ?
  `).get(id);
  if (!claim) return null;
  claim.items = db.prepare('SELECT * FROM expense_claim_items WHERE claim_id = ? ORDER BY item_date, id').all(id);
  return claim;
}

// Employee submits an Advance request or an Expense Bill. The reporting
// manager is taken from the employee's own user record (users.approver_id
// — the same "fixed approver" relationship Indents already use) and
// snapshotted onto the claim so it stays accurate even if the org chart
// changes later.
app.post('/api/expenses/claims', verifyToken, (req, res) => {
  const create = db.transaction((body, userId) => {
    const { claim_type, category, purpose, customer_id, from_date, to_date, amount, linked_advance_claim_id, items = [], remarks } = body;
    if (!claim_type || !['Advance', 'Expense Bill'].includes(claim_type)) throw new Error('claim_type must be Advance or Expense Bill');
    if (!category) throw new Error('category is required');

    const employee = db.prepare('SELECT id, full_name, department, approver_id FROM users WHERE id = ?').get(userId);
    if (!employee) throw new Error('Employee not found');
    if (!employee.approver_id) throw new Error('You have no reporting manager configured — ask an admin to set one on your user profile before submitting a claim.');
    const manager = db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(employee.approver_id);

    const itemsTotal = items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
    const finalAmount = claim_type === 'Expense Bill' && items.length ? itemsTotal : (parseFloat(amount) || 0);
    if (finalAmount <= 0) throw new Error('Amount must be greater than 0');

    const claim_number = nextSerial('expense_claim');
    const result = db.prepare(`
      INSERT INTO expense_claims
        (claim_number, claim_type, category, purpose, customer_id, from_date, to_date, amount, linked_advance_claim_id, employee_id, employee_name, department, manager_id, manager_name, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(claim_number, claim_type, category, purpose || null, customer_id || null, from_date || null, to_date || null, finalAmount,
      linked_advance_claim_id || null, employee.id, employee.full_name, employee.department || null, manager.id, manager.full_name, remarks || null);

    const claimId = result.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO expense_claim_items (claim_id, item_date, category, description, amount) VALUES (?, ?, ?, ?, ?)');
    for (const item of items) {
      if (!item.amount) continue;
      insertItem.run(claimId, item.item_date || null, item.category || null, item.description || null, parseFloat(item.amount) || 0);
    }
    return { id: claimId, claim_number };
  });
  try {
    const result = create(req.body, req.userId);
    res.status(201).json({ ...result, message: `${req.body.claim_type} claim submitted to your reporting manager for approval` });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// My own claims (any employee).
app.get('/api/expenses/claims/my', verifyToken, (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT ec.*, c.customer_name FROM expense_claims ec LEFT JOIN customers c ON ec.customer_id = c.id
      WHERE ec.employee_id = ? ORDER BY ec.created_at DESC
    `).all(req.userId) || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Claims waiting on the logged-in user's approval, as someone's reporting manager.
app.get('/api/expenses/claims/pending-approval', verifyToken, (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT ec.*, c.customer_name FROM expense_claims ec LEFT JOIN customers c ON ec.customer_id = c.id
      WHERE ec.manager_id = ? AND ec.status = 'Pending Approval' ORDER BY ec.created_at ASC
    `).all(req.userId) || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/expenses/claims/:id/manager-decision', verifyToken, (req, res) => {
  try {
    const claim = db.prepare('SELECT * FROM expense_claims WHERE id = ?').get(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.manager_id !== req.userId) return res.status(403).json({ error: 'Only this claim\'s reporting manager can approve or reject it' });
    if (claim.status !== 'Pending Approval') return res.status(400).json({ error: 'This claim has already been decided' });
    const { decision, comments } = req.body;
    if (!['Approved', 'Rejected'].includes(decision)) return res.status(400).json({ error: 'decision must be Approved or Rejected' });
    db.prepare(`
      UPDATE expense_claims SET status = ?, manager_action_by = ?, manager_action_at = CURRENT_TIMESTAMP, manager_comments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(decision, req.userId, comments || null, req.params.id);
    res.json({ message: `Claim ${decision.toLowerCase()}` });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Finance/Accounts view: everything a manager has approved and is now
// waiting on payment/settlement.
app.get('/api/expenses/claims/for-settlement', verifyToken, (req, res) => {
  try {
    const requester = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
    if (!requester || !['admin', 'accounts'].includes(requester.role)) {
      return res.status(403).json({ error: 'Only Accounts or an Administrator can view the settlement queue' });
    }
    res.json(db.prepare(`
      SELECT ec.*, c.customer_name FROM expense_claims ec LEFT JOIN customers c ON ec.customer_id = c.id
      WHERE ec.status = 'Approved' ORDER BY ec.manager_action_at ASC
    `).all() || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/expenses/claims/:id/settle', verifyToken, (req, res) => {
  try {
    const requester = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
    if (!requester || !['admin', 'accounts'].includes(requester.role)) {
      return res.status(403).json({ error: 'Only Accounts or an Administrator can settle a claim' });
    }
    const claim = db.prepare('SELECT * FROM expense_claims WHERE id = ?').get(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.status !== 'Approved') return res.status(400).json({ error: 'Only manager-approved claims can be settled' });
    const { settlement_reference, settlement_mode } = req.body;
    db.prepare(`
      UPDATE expense_claims SET status = 'Settled', settled_by = ?, settled_at = CURRENT_TIMESTAMP, settlement_reference = ?, settlement_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.userId, settlement_reference || null, settlement_mode || null, req.params.id);
    res.json({ message: 'Claim marked as settled' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Full history with filters — for admin/finance oversight, and for the
// employee-wise / department-wise views.
app.get('/api/expenses/claims', verifyToken, (req, res) => {
  try {
    const requester = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
    if (!requester || !['admin', 'accounts'].includes(requester.role)) {
      return res.status(403).json({ error: 'Only Accounts or an Administrator can view all claims — use My Claims or Pending Approval instead' });
    }
    const { employee_id, department, status, claim_type } = req.query;
    const conditions = [];
    const params = [];
    if (employee_id) { conditions.push('ec.employee_id = ?'); params.push(employee_id); }
    if (department) { conditions.push('ec.department = ?'); params.push(department); }
    if (status) { conditions.push('ec.status = ?'); params.push(status); }
    if (claim_type) { conditions.push('ec.claim_type = ?'); params.push(claim_type); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    res.json(db.prepare(`
      SELECT ec.*, c.customer_name FROM expense_claims ec LEFT JOIN customers c ON ec.customer_id = c.id
      ${where} ORDER BY ec.created_at DESC
    `).all(...params) || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/expenses/claims/:id', verifyToken, (req, res) => {
  try {
    const claim = getClaimWithItems(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    // Anyone can view their own claim, its manager, or Finance/Accounts/Admin oversight;
    // otherwise this is someone else's private expense record.
    const requester = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
    const isPrivileged = requester && ['admin', 'accounts'].includes(requester.role);
    if (claim.employee_id !== req.userId && claim.manager_id !== req.userId && !isPrivileged) {
      return res.status(403).json({ error: 'You do not have access to this claim' });
    }
    res.json(claim);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Employee-wise and department-wise history/summary for reporting.
app.get('/api/expenses/summary', verifyToken, (req, res) => {
  try {
    const requester = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
    if (!requester || !['admin', 'accounts'].includes(requester.role)) {
      return res.status(403).json({ error: 'Only Accounts or an Administrator can view this summary' });
    }
    const byEmployee = db.prepare(`
      SELECT employee_id, employee_name, department,
             COUNT(*) as claim_count,
             COALESCE(SUM(amount),0) as total_amount,
             COALESCE(SUM(CASE WHEN status = 'Settled' THEN amount ELSE 0 END),0) as settled_amount,
             COALESCE(SUM(CASE WHEN status IN ('Pending Approval','Approved') THEN amount ELSE 0 END),0) as outstanding_amount
      FROM expense_claims GROUP BY employee_id ORDER BY total_amount DESC
    `).all();
    const byDepartment = db.prepare(`
      SELECT COALESCE(department, 'Unassigned') as department,
             COUNT(*) as claim_count,
             COALESCE(SUM(amount),0) as total_amount,
             COALESCE(SUM(CASE WHEN status = 'Settled' THEN amount ELSE 0 END),0) as settled_amount,
             COALESCE(SUM(CASE WHEN status IN ('Pending Approval','Approved') THEN amount ELSE 0 END),0) as outstanding_amount
      FROM expense_claims GROUP BY department ORDER BY total_amount DESC
    `).all();
    res.json({ by_employee: byEmployee, by_department: byDepartment });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== Round 26: MIS Reports — one place for every module's reports =====
// Most of the actual report data already exists behind other modules'
// endpoints (Inventory valuation/movement/aging, Production variance,
// Finance payables/receivables/margin/GST, Expense summary, POS sales) —
// the MIS hub calls those directly rather than duplicating them. What's
// added here are the reports that genuinely didn't exist anywhere yet:
// date-ranged registers and cross-party summaries for Purchase, Sales,
// Quality, and Production.

app.get('/api/mis/purchase-register', verifyToken, (req, res) => {
  try {
    const { from, to, vendor_id, status } = req.query;
    const conditions = [];
    const params = [];
    if (from) { conditions.push('date(po.order_date) >= date(?)'); params.push(from); }
    if (to) { conditions.push('date(po.order_date) <= date(?)'); params.push(to); }
    if (vendor_id) { conditions.push('po.vendor_id = ?'); params.push(vendor_id); }
    if (status) { conditions.push('po.status = ?'); params.push(status); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`
      SELECT po.id, po.po_number, po.order_date, v.vendor_name, po.status, po.grand_total,
        (SELECT COUNT(*) FROM purchase_order_items WHERE po_id = po.id) as item_count
      FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id
      ${where} ORDER BY po.order_date DESC LIMIT 500
    `).all(...params);
    res.json(rows || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mis/vendor-purchase-summary', verifyToken, (req, res) => {
  try {
    const { from, to } = req.query;
    const conditions = [];
    const params = [];
    if (from) { conditions.push('date(po.order_date) >= date(?)'); params.push(from); }
    if (to) { conditions.push('date(po.order_date) <= date(?)'); params.push(to); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`
      SELECT v.vendor_name, COUNT(po.id) as po_count, COALESCE(SUM(po.grand_total),0) as total_value
      FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id
      ${where} GROUP BY po.vendor_id ORDER BY total_value DESC
    `).all(...params);
    res.json(rows || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mis/sales-register', verifyToken, (req, res) => {
  try {
    const { from, to, channel, customer_id } = req.query;
    const conditions = [];
    const params = [];
    if (from) { conditions.push('date(si.invoice_date) >= date(?)'); params.push(from); }
    if (to) { conditions.push('date(si.invoice_date) <= date(?)'); params.push(to); }
    if (channel) { conditions.push('si.channel = ?'); params.push(channel); }
    if (customer_id) { conditions.push('si.customer_id = ?'); params.push(customer_id); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`
      SELECT si.id, si.invoice_number, si.invoice_date, si.channel, c.customer_name, si.taxable_value,
             si.tax_amount, si.grand_total, si.status, si.payment_mode
      FROM sales_invoices si LEFT JOIN customers c ON si.customer_id = c.id
      ${where} ORDER BY si.invoice_date DESC LIMIT 500
    `).all(...params);
    res.json(rows || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mis/customer-sales-summary', verifyToken, (req, res) => {
  try {
    const { from, to } = req.query;
    const conditions = [];
    const params = [];
    if (from) { conditions.push('date(si.invoice_date) >= date(?)'); params.push(from); }
    if (to) { conditions.push('date(si.invoice_date) <= date(?)'); params.push(to); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`
      SELECT c.customer_name, COUNT(si.id) as invoice_count, COALESCE(SUM(si.grand_total),0) as total_value
      FROM sales_invoices si LEFT JOIN customers c ON si.customer_id = c.id
      ${where} GROUP BY si.customer_id ORDER BY total_value DESC
    `).all(...params);
    res.json(rows || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mis/quality-summary', verifyToken, (req, res) => {
  try {
    const { from, to } = req.query;
    const conditions = [];
    const params = [];
    if (from) { conditions.push('date(qi.created_at) >= date(?)'); params.push(from); }
    if (to) { conditions.push('date(qi.created_at) <= date(?)'); params.push(to); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`
      SELECT qi.inspection_number, qi.inspection_date, qi.created_at, m.material_name, w.warehouse_name,
             qi.quantity_received, qi.quantity_passed, qi.quantity_hold, qi.quantity_rejected, qi.status
      FROM quality_inspections qi
      LEFT JOIN materials m ON qi.material_id = m.id
      LEFT JOIN warehouses w ON qi.warehouse_id = w.id
      ${where} ORDER BY qi.created_at DESC LIMIT 500
    `).all(...params);
    const totals = rows.reduce((acc, r) => ({
      received: acc.received + parseFloat(r.quantity_received || 0),
      passed: acc.passed + parseFloat(r.quantity_passed || 0),
      hold: acc.hold + parseFloat(r.quantity_hold || 0),
      rejected: acc.rejected + parseFloat(r.quantity_rejected || 0)
    }), { received: 0, passed: 0, hold: 0, rejected: 0 });
    res.json({ rows: rows || [], totals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mis/production-register', verifyToken, (req, res) => {
  try {
    const { from, to, status } = req.query;
    const conditions = [];
    const params = [];
    if (from) { conditions.push('date(po.start_date) >= date(?)'); params.push(from); }
    if (to) { conditions.push('date(po.start_date) <= date(?)'); params.push(to); }
    if (status) { conditions.push('po.status = ?'); params.push(status); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`
      SELECT po.id, po.po_number, po.product_name, po.start_date, po.end_date, po.status,
             po.quantity as planned_output, po.actual_output_quantity, po.total_scrap_quantity, po.total_rejection_quantity
      FROM production_orders po
      ${where} ORDER BY po.start_date DESC LIMIT 500
    `).all(...params);
    res.json(rows || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SAKAAR ERP is running' });
});

// SPA fallback
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  log('ERROR', 'Unhandled error: ' + err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  log('INFO', `SAKAAR ERP Server running on port ${PORT}`);
  log('INFO', `Access the application at http://localhost:${PORT}`);
  // Checks once a minute whether it's time for the configured auto-backup —
  // cheap enough (a couple of indexed SQLite reads) to just always run,
  // rather than build a separate scheduler process for something this small.
  setInterval(runScheduledBackupIfDue, 60 * 1000);
  runScheduledBackupIfDue();
});
