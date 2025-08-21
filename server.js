const path = require('path');
const baseDir = __dirname; // use script directory for portable bundle
// Replace any previous uses of process.cwd() with baseDir:
const DB_DIR = path.join(baseDir, 'db');

// Static assets:
app.use('/public', express.static(path.join(baseDir, 'public')));

// sql.js wasm path:
const wasmBinaryFile = require.resolve('sql.js/dist/sql-wasm.wasm');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ---------- SQL.js (SQLite WASM) ----------
const initSqlJs = require('sql.js');
let SQL, db;
const DB_DIR = path.join(process.cwd(), 'db');
const DB_FILE = path.join(DB_DIR, 'assets.sqlite');
const ensureDir = p => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };
ensureDir(DB_DIR);

const wasmBinaryFile = require.resolve('sql.js/dist/sql-wasm.wasm');

async function loadDB() {
  if (!SQL) SQL = await initSqlJs({ locateFile: () => wasmBinaryFile });
  if (fs.existsSync(DB_FILE)) {
    const filebuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(new Uint8Array(filebuffer));
  } else {
    db = new SQL.Database();
    db.run(`
      CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL DEFAULT 'N/A',
        federal_or_mn TEXT NOT NULL DEFAULT 'N/A',
        model TEXT NOT NULL DEFAULT 'N/A',
        sp9_serial TEXT NOT NULL DEFAULT 'N/A',
        hostname TEXT NOT NULL DEFAULT 'N/A',
        marad_number TEXT NOT NULL DEFAULT 'N/A',
        wireless_mac TEXT NOT NULL DEFAULT 'N/A',
        docking_model TEXT NOT NULL DEFAULT 'N/A',
        docking_serial TEXT NOT NULL DEFAULT 'N/A',
        docking_mac TEXT NOT NULL DEFAULT 'N/A',
        keyboard_serial TEXT NOT NULL DEFAULT 'N/A',
        stylus_serial TEXT NOT NULL DEFAULT 'N/A',
        case_serial TEXT NOT NULL DEFAULT 'N/A',
        date_issued TEXT NOT NULL DEFAULT 'N/A',
        department TEXT NOT NULL DEFAULT 'N/A',
        returned_model TEXT NOT NULL DEFAULT 'N/A',
        returned_serial TEXT NOT NULL DEFAULT 'N/A',
        returned_marad TEXT NOT NULL DEFAULT 'N/A',
        returned_old_computer TEXT NOT NULL DEFAULT 'N/A',
        ticket_number TEXT NOT NULL DEFAULT 'N/A',
        configured_by TEXT NOT NULL DEFAULT 'N/A',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
    // seed 3 rows
    const seed = db.prepare(`
      INSERT INTO assets
      (name,federal_or_mn,model,sp9_serial,hostname,marad_number,wireless_mac,
       docking_model,docking_serial,docking_mac,keyboard_serial,stylus_serial,case_serial,
       date_issued,department,returned_model,returned_serial,returned_marad,returned_old_computer,
       ticket_number,configured_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
    `);
    const rows = [
      ['John Smith','Federal','Surface Pro 9','SP9-12345','MARAD-LT-001','M001','00:1A:2B:3C:4D:5E','Dock-101','D-98765','00:1A:2B:3C:4D:5F','KB-55555','STY-11111','CASE-22222','2024-06-01','IT','N/A','N/A','N/A','N/A','T-1001','AdminUser'],
      ['Mary Johnson','MN SP9','Surface Pro 9','SP9-54321','MARAD-LT-002','M002','00:1A:2B:3C:4D:6A','N/A','N/A','N/A','KB-66666','STY-22222','CASE-33333','2024-07-15','Finance','N/A','N/A','N/A','DELL-OLD-001','T-1002','TechSupport1'],
      ['Robert Brown','Federal','Surface Pro 9','SP9-67890','MARAD-LT-003','M003','00:1A:2B:3C:4D:7B','Dock-202','D-12345','00:1A:2B:3C:4D:7C','KB-77777','STY-33333','CASE-44444','2024-08-10','HR','Surface Pro 7','SP7-33333','M099','HP-OLD-002','T-1003','ITAdmin2']
    ];
    rows.forEach(r => seed.run(r));
    persist();
  }
}
function persist() {
  const data = db.export();
  ensureDir(DB_DIR);
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

// ---------- App ----------
const app = express();
const upload = multer({ dest: path.join(process.cwd(), 'uploads') });
app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// util
const requiredMap = [
  ['name','Name'],
  ['federal_or_mn','Originally Federal or MN SP9'],
  ['model','Model'],
  ['sp9_serial','Serial # of SP9 Tablet'],
  ['hostname','Hostname'],
  ['marad_number','Marad #'],
  ['wireless_mac','Wireless MAC'],
  ['docking_model','Surface Pro Docking Station Model'],
  ['docking_serial','Serial Number of Docking Station'],
  ['docking_mac','Docking Station Mac'],
  ['keyboard_serial','Serial Number of Type Cover / Keyboard'],
  ['stylus_serial','Serial Number of Stylus Pen'],
  ['case_serial','Serial Number of Case with built in PIV Card Reader'],
  ['date_issued','Date Issued'],
  ['department','Department'],
  ['returned_model','Returned Model'],
  ['returned_serial','Returned Serial #'],
  ['returned_marad','Returned MARAD'],
  ['returned_old_computer','Returned Old Computer'],
  ['ticket_number','Ticket Number'],
  ['configured_by','Configured by'],
];

function fillNA(obj) {
  const out = {};
  requiredMap.forEach(([k]) => out[k] = (obj[k] ?? 'N/A') === '' ? 'N/A' : (obj[k] ?? 'N/A'));
  return out;
}
function toHuman(r) {
  return Object.fromEntries(requiredMap.map(([k,h]) => [h, r[k]]));
}
function rowsFromResult(rs){
  if(!rs.length) return [];
  const { columns, values } = rs[0];
  return values.map(v => Object.fromEntries(columns.map((c,i)=>[c, v[i]])));
}

// CRUD
app.get('/api/assets', (req, res) => {
  const { q } = req.query;
  let sql = "SELECT * FROM assets";
  if (q) {
    const safe = String(q).replace(/'/g,"''");
    sql += ` WHERE name LIKE '%${safe}%' OR model LIKE '%${safe}%' OR hostname LIKE '%${safe}%' OR marad_number LIKE '%${safe}%' OR sp9_serial LIKE '%${safe}%'`;
  }
  sql += " ORDER BY id DESC";
  const rows = rowsFromResult(db.exec(sql));
  res.json(rows);
});

app.post('/api/assets', (req, res) => {
  const r = fillNA(req.body || {});
  const stmt = db.prepare(`
    INSERT INTO assets
      (name,federal_or_mn,model,sp9_serial,hostname,marad_number,wireless_mac,
       docking_model,docking_serial,docking_mac,keyboard_serial,stylus_serial,case_serial,
       date_issued,department,returned_model,returned_serial,returned_marad,returned_old_computer,
       ticket_number,configured_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
  `);
  stmt.run(Object.values(r));
  persist();
  res.status(201).json({ ok: true });
});

app.put('/api/assets/:id', (req, res) => {
  const r = fillNA(req.body || {});
  const stmt = db.prepare(`
    UPDATE assets SET
      name=?,federal_or_mn=?,model=?,sp9_serial=?,hostname=?,marad_number=?,wireless_mac=?,
      docking_model=?,docking_serial=?,docking_mac=?,keyboard_serial=?,stylus_serial=?,case_serial=?,
      date_issued=?,department=?,returned_model=?,returned_serial=?,returned_marad=?,returned_old_computer=?,
      ticket_number=?,configured_by=?,updated_at=datetime('now')
    WHERE id=?`);
  stmt.run([...Object.values(r), req.params.id]);
  persist();
  res.json({ ok: true });
});

app.delete('/api/assets/:id', (req, res) => {
  db.run(`DELETE FROM assets WHERE id=${Number(req.params.id)}`);
  persist();
  res.json({ ok: true });
});

// Import
app.post('/api/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const wb = XLSX.readFile(req.file.path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: 'N/A' });
  const stmt = db.prepare(`
    INSERT INTO assets
      (name,federal_or_mn,model,sp9_serial,hostname,marad_number,wireless_mac,
       docking_model,docking_serial,docking_mac,keyboard_serial,stylus_serial,case_serial,
       date_issued,department,returned_model,returned_serial,returned_marad,returned_old_computer,
       ticket_number,configured_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
  `);
  let inserted = 0;
  rows.forEach(row => {
    const r = fillNA(Object.fromEntries(requiredMap.map(([k,h]) => [k, row[h]])));
    stmt.run(Object.values(r)); inserted++;
  });
  fs.unlinkSync(req.file.path);
  persist();
  res.json({ success: true, inserted });
});

// Exports
app.get('/api/export.xlsx', (req, res) => {
  const rows = rowsFromResult(db.exec("SELECT * FROM assets ORDER BY id DESC"));
  const human = rows.map(toHuman);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(human);
  XLSX.utils.book_append_sheet(wb, ws, 'Assets');
  const tmp = path.join(process.cwd(), `export_${Date.now()}.xlsx`);
  XLSX.writeFile(wb, tmp);
  res.download(tmp, 'assets_export.xlsx', err => { if (err) console.error(err); fs.unlink(tmp, ()=>{}); });
});

app.get('/api/export.pdf', (req, res) => {
  const rows = rowsFromResult(db.exec("SELECT * FROM assets ORDER BY id DESC"));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=\"assets_report.pdf\"');
  const doc = new PDFDocument({ margin: 36 });
  doc.pipe(res);
  doc.fontSize(18).text('IT Assets Report', { align:'center' }).moveDown();
  rows.forEach((r,i) => {
    doc.fontSize(11).text(`${i+1}. ${r.name} — ${r.model} — Host: ${r.hostname}`);
    doc.fontSize(9).text(`SP9: ${r.sp9_serial} | MARAD: ${r.marad_number} | MAC: ${r.wireless_mac}`);
    doc.text(`Dock: ${r.docking_model} (${r.docking_serial}) MAC: ${r.docking_mac}`);
    doc.text(`KB: ${r.keyboard_serial} | Stylus: ${r.stylus_serial} | Case: ${r.case_serial}`);
    doc.text(`Issued: ${r.date_issued} | Dept: ${r.department} | Config by: ${r.configured_by}`);
    doc.text(`Returned -> Model: ${r.returned_model} Serial: ${r.returned_serial} MARAD: ${r.returned_marad} Old: ${r.returned_old_computer}`);
    doc.moveDown(0.5);
  });
  doc.end();
});

// Static UI files
app.use(express.static(path.join(process.cwd(), 'public')));
app.get('*', (req,res) => res.sendFile(path.join(process.cwd(), 'public', 'index.html')));

(async () => {
  await loadDB();
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`IT Asset Manager running at http://localhost:${PORT}`));
})();
