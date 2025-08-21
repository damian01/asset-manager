function $(s){return document.querySelector(s)}
function nav(which){ render(which); return false }
async function fetchJSON(url, opts){ const r = await fetch(url, opts); if(!r.ok) throw new Error(await r.text()); return r.json() }

function assetsView(){
  $('#app').innerHTML = `
    <div class="toolbar">
      <input id="q" placeholder="Search by name/model/hostname/MARAD/SP9..."/>
      <button class="btn" id="btnSearch">Search</button>
      <button class="btn alt" id="btnNew">New Asset</button>
    </div>
    <div class="card" style="overflow:auto">
      <table><thead><tr>
        ${['Name','Model','SP9 Serial','Hostname','Marad #','Department'].map(x=>`<th>${x}</th>`).join('')}
      </tr></thead><tbody id="rows"></tbody></table>
    </div>`;
  $('#btnSearch').onclick = load;
  $('#btnNew').onclick = () => render('form');
  load();
  async function load(){
    const q = encodeURIComponent($('#q').value||'');
    const data = await fetchJSON(`/api/assets?q=${q}`);
    $('#rows').innerHTML = data.map(a=>`<tr>
      <td>${a.name}</td><td>${a.model}</td><td>${a.sp9_serial}</td>
      <td>${a.hostname}</td><td>${a.marad_number}</td><td>${a.department}</td>
    </tr>`).join('');
  }
}

const FIELD_MAP = [
  ['name','Name'],['federal_or_mn','Originally Federal or MN SP9'],['model','Model'],
  ['sp9_serial','Serial # of SP9 Tablet'],['hostname','Hostname'],['marad_number','Marad #'],
  ['wireless_mac','Wireless MAC'],['docking_model','Surface Pro Docking Station Model'],
  ['docking_serial','Serial Number of Docking Station'],['docking_mac','Docking Station Mac'],
  ['keyboard_serial','Serial Number of Type Cover / Keyboard'],['stylus_serial','Serial Number of Stylus Pen'],
  ['case_serial','Serial Number of Case with built in PIV Card Reader'],['date_issued','Date Issued'],
  ['department','Department'],['returned_model','Returned Model'],['returned_serial','Returned Serial #'],
  ['returned_marad','Returned MARAD'],['returned_old_computer','Returned Old Computer'],
  ['ticket_number','Ticket Number'],['configured_by','Configured by'],
];

function formView(){
  $('#app').innerHTML = `
    <div class="card">
      <h3>Create Asset</h3>
      <div class="grid">
        ${FIELD_MAP.map(([k,l])=>`<label><div>${l}</div><input data-k="${k}" value="N/A"/></label>`).join('')}
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="btn" id="save">Save</button>
        <button class="btn alt" id="cancel">Cancel</button>
      </div>
    </div>`;
  $('#cancel').onclick = () => render('assets');
  $('#save').onclick = async () => {
    const payload = {};
    document.querySelectorAll('input[data-k]').forEach(i => payload[i.dataset.k] = i.value.trim() || 'N/A');
    await fetchJSON('/api/assets', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    alert('Saved'); render('assets');
  }
}

function importView(){
  $('#app').innerHTML = `
    <div class="card">
      <h3>Import from Excel/CSV</h3>
      <p>Use the template at <a href="/public/sample_assets.xlsx" target="_blank">/public/sample_assets.xlsx</a></p>
      <input type="file" id="f"/>
      <button class="btn" id="upload">Upload</button>
    </div>`;
  $('#upload').onclick = async () => {
    const f = document.getElementById('f').files[0]; if(!f) return alert('Choose a file');
    const fd = new FormData(); fd.append('file', f);
    const r = await fetchJSON('/api/import', { method:'POST', body: fd });
    alert(`Imported ${r.inserted} rows`); render('assets');
  }
}

function exportsView(){
  $('#app').innerHTML = `
    <div class="card">
      <h3>Exports</h3>
      <button class="btn" onclick="window.location='/api/export.xlsx'">Download Excel</button>
      <button class="btn alt" style="margin-left:8px" onclick="window.location='/api/export.pdf'">Download PDF</button>
    </div>`;
}

function render(which){
  if(which==='form') return formView();
  if(which==='import') return importView();
  if(which==='exports') return exportsView();
  return assetsView();
}

render('assets');