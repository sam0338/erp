const ProductionRecipesPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-flask me-2"></i>Bill of Materials (Product Recipes)</h2>
          <p class="text-muted">Define what raw materials go into each finished product, in what quantity, and what it weighs — before planning production or checking order availability against it. A product can have more than one BOM (an <strong>alternate BOM</strong>).</p>
        </div>
        <div class="col-md-4 text-end">
          <button class="btn btn-primary" onclick="RecipeModal.show()">
            <i class="fas fa-plus me-2"></i>New BOM
          </button>
        </div>
      </div>

      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Code</th>
                <th>BOM Name / Alias</th>
                <th>Item to Produce</th>
                <th>Qty / Unit</th>
                <th>Wt per Unit (Kg)</th>
                <th>Total Batch Wt (Kg)</th>
                <th>Routing</th>
                <th>Materials</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="recipesList">
              <tr><td colspan="9" class="text-center text-muted py-4">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recipe Modal — styled like a Tally-type "Add Bill of Material Master" entry screen -->
      <div class="modal fade" id="recipeModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header bg-danger text-white">
              <h5 class="modal-title" id="recipeModalTitle">Add Bill of Material Master</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <form id="recipeForm" onsubmit="RecipeModal.submit(event)">
              <div class="modal-body" style="background:#eef7ee">
                <input type="hidden" id="recipeId">
                <input type="hidden" id="recipePrimaryId">
                <div id="alternateBanner" class="alert alert-info small" style="display:none"></div>

                <table class="table table-borderless table-sm mb-2">
                  <tr>
                    <td style="width:180px" class="fw-bold">BOM Name</td>
                    <td><input type="text" class="form-control form-control-sm" id="recipeProductName" required></td>
                    <td style="width:120px" class="fw-bold">Alias</td>
                    <td><input type="text" class="form-control form-control-sm" id="recipeAlias" placeholder="Short code"></td>
                  </tr>
                  <tr>
                    <td class="fw-bold">Item to Produce</td>
                    <td colspan="3"><select class="form-control form-control-sm" id="recipeOutputMaterial" required></select>
                      <div class="form-text">Must be a Finished Good / Semi-Finished / By-Product material — mark it on the Materials page. Required so Production Receipt can post real stock and Order Availability Check can trace it.</div>
                    </td>
                  </tr>
                  <tr>
                    <td class="fw-bold">Quantity</td>
                    <td><div class="input-group input-group-sm">
                      <input type="number" class="form-control" id="recipeOutputQty" step="0.001" value="1" required>
                      <input type="text" class="form-control" id="recipeOutputUnit" value="Kg" style="max-width:90px" placeholder="Unit">
                    </div></td>
                    <td class="fw-bold">Wt / Unit (Kg)</td>
                    <td><input type="number" class="form-control form-control-sm" id="recipeWeightPerUnit" step="0.0001" value="1">
                      <div class="form-text">Kg equivalent of ONE output unit. If output unit is already Kg, leave at 1. If output is e.g. "Nos" and each piece weighs 0.25 Kg, enter 0.25 — this is what lets RM consumption (always in Kg) be checked against output counted in Nos/Mtr/CBM.</div>
                    </td>
                  </tr>
                  <tr>
                    <td class="fw-bold">Expenses/Unit</td>
                    <td><input type="number" class="form-control form-control-sm" id="recipeExpensesPerUnit" step="0.01" value="0"></td>
                    <td class="fw-bold">Default Machine</td>
                    <td><select class="form-control form-control-sm" id="recipeDefaultMachine"><option value="">— None —</option></select></td>
                  </tr>
                  <tr>
                    <td class="fw-bold">Routing</td>
                    <td colspan="3"><select class="form-control form-control-sm" id="recipeRouting"><option value="">— None —</option></select></td>
                  </tr>
                  <tr id="alternateLabelRow" style="display:none">
                    <td class="fw-bold">Alternate Label</td>
                    <td colspan="3"><input type="text" class="form-control form-control-sm" id="recipeAlternateLabel" placeholder="e.g. Substitute grade 304 in place of 316"></td>
                  </tr>
                </table>

                <div class="d-flex justify-content-between align-items-center bg-danger text-white px-2 py-1 mt-3">
                  <strong>Raw Material Consumed</strong>
                  <span id="rmTotalWeight" class="small">0.00 Kg</span>
                </div>
                <div style="max-height:260px; overflow-y:auto; border:1px solid #ccc; border-top:none;">
                  <table class="table table-sm mb-0 bg-white">
                    <thead class="table-light" style="position:sticky; top:0;">
                      <tr><th style="width:40px">S No</th><th>Item Name</th><th style="width:110px">Qty</th><th style="width:90px">Unit</th><th style="width:90px">Scrap %</th><th style="width:40px"></th></tr>
                    </thead>
                    <tbody id="recipeItemsContainer"></tbody>
                  </table>
                </div>
                <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="RecipeModal.addItem()">
                  <i class="fas fa-plus me-1"></i>Add Raw Material Row
                </button>

                <div class="d-flex justify-content-between align-items-center bg-secondary text-white px-2 py-1 mt-4">
                  <strong>By-Product Generated (expected, per batch)</strong>
                </div>
                <div style="max-height:180px; overflow-y:auto; border:1px solid #ccc; border-top:none;">
                  <table class="table table-sm mb-0 bg-white">
                    <thead class="table-light" style="position:sticky; top:0;">
                      <tr><th style="width:40px">S No</th><th>Item Name</th><th style="width:110px">Qty</th><th style="width:90px">Unit</th><th style="width:40px"></th></tr>
                    </thead>
                    <tbody id="recipeByproductsContainer"></tbody>
                  </table>
                </div>
                <button type="button" class="btn btn-sm btn-outline-secondary mt-2" onclick="RecipeModal.addByproduct()">
                  <i class="fas fa-plus me-1"></i>Add By-Product Row
                </button>

                <div class="mb-2 mt-3">
                  <label class="form-label">Process Notes</label>
                  <textarea class="form-control" id="recipeNotes" rows="2"></textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Save BOM</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    const materialsResult = await API.getMaterials();
    RecipeModal.materials = Array.isArray(materialsResult) ? materialsResult : [];
    const routingsResult = await API.getRoutings();
    RecipeModal.routings = Array.isArray(routingsResult) ? routingsResult : [];
    const machinesResult = await API.getMachines();
    RecipeModal.machines = Array.isArray(machinesResult) ? machinesResult : [];
    await RecipeModal.loadRecipes();
  }
};

const RecipeModal = {
  modal: null,
  materials: [],
  routings: [],
  machines: [],
  itemCount: 0,
  bpCount: 0,

  outputMaterialOptions: (selectedId) => {
    const fgMaterials = RecipeModal.materials.filter(m => m.item_type && m.item_type !== 'Raw Material');
    const list = fgMaterials.length ? fgMaterials : RecipeModal.materials; // fall back so it's never empty pre-migration
    return '<option value="">— Select finished/semi-finished item —</option>' +
      list.map(m => `<option value="${m.id}" ${selectedId == m.id ? 'selected' : ''}>${m.material_name} (${m.material_code})${m.item_type ? ` — ${m.item_type}` : ''}</option>`).join('');
  },

  routingOptions: (selectedId) => {
    return '<option value="">— None —</option>' +
      RecipeModal.routings.map(r => `<option value="${r.id}" ${selectedId == r.id ? 'selected' : ''}>${r.routing_name} (${(r.steps || []).length} ops)</option>`).join('');
  },

  machineOptions: (selectedId) => {
    return '<option value="">— None —</option>' +
      RecipeModal.machines.map(m => `<option value="${m.id}" ${selectedId == m.id ? 'selected' : ''}>${m.machine_name}</option>`).join('');
  },

  show: (primaryRecipe = null) => {
    document.getElementById('recipeForm').reset();
    document.getElementById('recipeId').value = '';
    document.getElementById('recipePrimaryId').value = primaryRecipe ? primaryRecipe.id : '';
    document.getElementById('recipeModalTitle').textContent = primaryRecipe ? `Add Alternate BOM — ${primaryRecipe.product_name}` : 'Add Bill of Material Master';
    document.getElementById('alternateBanner').style.display = primaryRecipe ? 'block' : 'none';
    document.getElementById('alternateLabelRow').style.display = primaryRecipe ? 'table-row' : 'none';
    document.getElementById('recipeAlias').value = '';
    document.getElementById('recipeExpensesPerUnit').value = 0;
    document.getElementById('recipeWeightPerUnit').value = 1;
    if (primaryRecipe) {
      document.getElementById('alternateBanner').innerHTML = `Creating an <strong>alternate BOM</strong> for <strong>${primaryRecipe.product_name}</strong> — a different set of raw materials that produces the same product.`;
      document.getElementById('recipeProductName').value = primaryRecipe.product_name;
      document.getElementById('recipeProductName').disabled = true;
      document.getElementById('recipeOutputQty').value = primaryRecipe.output_quantity;
      document.getElementById('recipeOutputUnit').value = primaryRecipe.output_unit || 'Kg';
      document.getElementById('recipeWeightPerUnit').value = primaryRecipe.weight_per_output_unit || 1;
    } else {
      document.getElementById('recipeProductName').disabled = false;
    }
    document.getElementById('recipeOutputMaterial').innerHTML = RecipeModal.outputMaterialOptions(primaryRecipe ? primaryRecipe.output_material_id : null);
    document.getElementById('recipeRouting').innerHTML = RecipeModal.routingOptions(primaryRecipe ? primaryRecipe.routing_id : null);
    document.getElementById('recipeDefaultMachine').innerHTML = RecipeModal.machineOptions(primaryRecipe ? primaryRecipe.default_machine_id : null);
    document.getElementById('recipeItemsContainer').innerHTML = '';
    document.getElementById('recipeByproductsContainer').innerHTML = '';
    RecipeModal.itemCount = 0;
    RecipeModal.bpCount = 0;
    RecipeModal.addItem();
    RecipeModal.modal = new bootstrap.Modal(document.getElementById('recipeModal'));
    RecipeModal.modal.show();
  },

  addItem: (existing = null) => {
    const idx = ++RecipeModal.itemCount;
    const materialOptions = RecipeModal.materials.map(m =>
      `<option value="${m.id}" ${existing && existing.material_id === m.id ? 'selected' : ''}>${m.material_name} (${m.material_code})</option>`
    ).join('');

    const tr = document.createElement('tr');
    tr.className = 'recipe-item';
    tr.innerHTML = `
      <td class="align-middle text-muted sno-cell">${idx}</td>
      <td>
        <select class="form-control form-control-sm material-select" required>
          <option value="">Select Material</option>
          ${materialOptions}
        </select>
      </td>
      <td><input type="number" class="form-control form-control-sm qty-input" step="0.001" value="${existing ? existing.input_quantity : ''}" required oninput="RecipeModal.recalcWeight()"></td>
      <td><input type="text" class="form-control form-control-sm unit-input" value="${existing ? existing.input_unit : 'Kg'}"></td>
      <td><input type="number" class="form-control form-control-sm scrap-input" step="0.001" value="${existing ? existing.scrap_percent : 0}" oninput="RecipeModal.recalcWeight()"></td>
      <td><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove(); RecipeModal.renumber(); RecipeModal.recalcWeight()"><i class="fas fa-trash"></i></button></td>
    `;
    document.getElementById('recipeItemsContainer').appendChild(tr);
    RecipeModal.recalcWeight();
  },

  addByproduct: (existing = null) => {
    const idx = ++RecipeModal.bpCount;
    const materialOptions = RecipeModal.materials.map(m =>
      `<option value="${m.id}" ${existing && existing.material_id === m.id ? 'selected' : ''}>${m.material_name} (${m.material_code})</option>`
    ).join('');
    const tr = document.createElement('tr');
    tr.className = 'recipe-byproduct';
    tr.innerHTML = `
      <td class="align-middle text-muted sno-cell">${idx}</td>
      <td><select class="form-control form-control-sm material-select"><option value="">Select Material</option>${materialOptions}</select></td>
      <td><input type="number" class="form-control form-control-sm qty-input" step="0.001" value="${existing ? existing.quantity : ''}"></td>
      <td><input type="text" class="form-control form-control-sm unit-input" value="${existing ? existing.unit : 'Kg'}"></td>
      <td><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove(); RecipeModal.renumberByproducts()"><i class="fas fa-trash"></i></button></td>
    `;
    document.getElementById('recipeByproductsContainer').appendChild(tr);
  },

  renumber: () => {
    document.querySelectorAll('#recipeItemsContainer .recipe-item .sno-cell').forEach((cell, i) => { cell.textContent = i + 1; });
  },
  renumberByproducts: () => {
    document.querySelectorAll('#recipeByproductsContainer .recipe-byproduct .sno-cell').forEach((cell, i) => { cell.textContent = i + 1; });
  },

  // Live total: how many Kg of RM this batch consumes (incl. scrap %),
  // shown right next to the output weight so a user can sanity-check
  // yield while still building the BOM.
  recalcWeight: () => {
    let totalKg = 0;
    document.querySelectorAll('.recipe-item').forEach(row => {
      const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
      const scrap = parseFloat(row.querySelector('.scrap-input').value) || 0;
      const unit = (row.querySelector('.unit-input').value || '').trim().toLowerCase();
      if (unit === 'kg' || unit === '') totalKg += qty * (1 + scrap / 100);
    });
    document.getElementById('rmTotalWeight').textContent = `${totalKg.toFixed(2)} Kg RM (Kg-unit rows only)`;
  },

  edit: async (recipeId) => {
    const recipe = await API.getProductionRecipe(recipeId);
    if (!recipe || recipe.error) {
      alert('Could not load this BOM');
      return;
    }

    document.getElementById('recipeForm').reset();
    document.getElementById('recipeId').value = recipe.id;
    document.getElementById('recipePrimaryId').value = '';
    document.getElementById('recipeProductName').disabled = false;
    document.getElementById('recipeModalTitle').textContent = `Edit BOM — ${recipe.product_name}${recipe.is_alternate ? ' (Alternate)' : ''}`;
    document.getElementById('alternateBanner').style.display = 'none';
    document.getElementById('alternateLabelRow').style.display = recipe.is_alternate ? 'table-row' : 'none';
    document.getElementById('recipeAlternateLabel').value = recipe.alternate_label || '';
    document.getElementById('recipeProductName').value = recipe.product_name;
    document.getElementById('recipeAlias').value = recipe.alias || '';
    document.getElementById('recipeOutputQty').value = recipe.output_quantity;
    document.getElementById('recipeOutputUnit').value = recipe.output_unit || 'Kg';
    document.getElementById('recipeWeightPerUnit').value = recipe.weight_per_output_unit || 1;
    document.getElementById('recipeExpensesPerUnit').value = recipe.expenses_per_unit || 0;
    document.getElementById('recipeOutputMaterial').innerHTML = RecipeModal.outputMaterialOptions(recipe.output_material_id);
    document.getElementById('recipeRouting').innerHTML = RecipeModal.routingOptions(recipe.routing_id);
    document.getElementById('recipeDefaultMachine').innerHTML = RecipeModal.machineOptions(recipe.default_machine_id);
    document.getElementById('recipeNotes').value = recipe.process_notes || '';

    document.getElementById('recipeItemsContainer').innerHTML = '';
    RecipeModal.itemCount = 0;
    (recipe.items || []).forEach(item => RecipeModal.addItem(item));
    if ((recipe.items || []).length === 0) RecipeModal.addItem();

    document.getElementById('recipeByproductsContainer').innerHTML = '';
    RecipeModal.bpCount = 0;
    (recipe.byproducts || []).forEach(bp => RecipeModal.addByproduct(bp));

    RecipeModal.modal = new bootstrap.Modal(document.getElementById('recipeModal'));
    RecipeModal.modal.show();
  },

  submit: async (event) => {
    event.preventDefault();
    const recipeId = document.getElementById('recipeId').value;
    const primaryId = document.getElementById('recipePrimaryId').value;

    const items = [];
    document.querySelectorAll('.recipe-item').forEach(row => {
      const materialId = row.querySelector('.material-select').value;
      const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
      const unit = row.querySelector('.unit-input').value;
      const scrap = parseFloat(row.querySelector('.scrap-input').value) || 0;
      if (materialId && qty > 0) {
        items.push({ material_id: parseInt(materialId), input_quantity: qty, input_unit: unit, scrap_percent: scrap });
      }
    });

    if (items.length === 0) {
      alert('Add at least one raw material with a quantity');
      return;
    }

    const byproducts = [];
    document.querySelectorAll('.recipe-byproduct').forEach(row => {
      const materialId = row.querySelector('.material-select').value;
      const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
      const unit = row.querySelector('.unit-input').value;
      if (materialId && qty > 0) byproducts.push({ material_id: parseInt(materialId), quantity: qty, unit });
    });

    const data = {
      product_name: document.getElementById('recipeProductName').value,
      alias: document.getElementById('recipeAlias').value,
      output_quantity: parseFloat(document.getElementById('recipeOutputQty').value) || 1,
      output_unit: document.getElementById('recipeOutputUnit').value,
      weight_per_output_unit: parseFloat(document.getElementById('recipeWeightPerUnit').value) || 1,
      expenses_per_unit: parseFloat(document.getElementById('recipeExpensesPerUnit').value) || 0,
      output_material_id: document.getElementById('recipeOutputMaterial').value || null,
      routing_id: document.getElementById('recipeRouting').value || null,
      default_machine_id: document.getElementById('recipeDefaultMachine').value || null,
      alternate_label: document.getElementById('recipeAlternateLabel') ? document.getElementById('recipeAlternateLabel').value : null,
      process_notes: document.getElementById('recipeNotes').value,
      items,
      byproducts
    };

    let result;
    if (recipeId) {
      result = await API.updateProductionRecipe(recipeId, data);
    } else if (primaryId) {
      result = await API.createAlternateBOM(primaryId, data);
    } else {
      result = await API.createProductionRecipe(data);
    }

    if (result && !result.error) {
      RecipeModal.modal.hide();
      alert(result.message || 'BOM saved');
      await RecipeModal.loadRecipes();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  loadRecipes: async () => {
    const recipes = await API.getProductionRecipes();
    if (!Array.isArray(recipes)) {
      document.getElementById('recipesList').innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">${(recipes && recipes.error) || 'Could not load BOMs.'}</td></tr>`;
      return;
    }

    RecipeModal._recipeCache = {};
    recipes.forEach(r => { RecipeModal._recipeCache[r.id] = r; });

    const totalWeight = (r) => ((parseFloat(r.output_quantity) || 0) * (parseFloat(r.weight_per_output_unit) || 1)).toFixed(2);

    const rowHtml = (r, isAlt) => `
      <tr class="${isAlt ? 'table-light' : ''}">
        <td>${isAlt ? '<span class="text-muted">↳</span> ' : ''}<strong>${r.product_code}</strong></td>
        <td>${r.product_name}${r.alias ? ` <span class="text-muted small">(${r.alias})</span>` : ''}${isAlt ? ` <span class="badge bg-secondary">Alternate${r.alternate_label ? ': ' + r.alternate_label : ''}</span>` : ''}</td>
        <td>${r.output_material_name ? r.output_material_name : '<span class="text-danger">Not linked</span>'}</td>
        <td>${r.output_quantity} ${r.output_unit || ''}</td>
        <td>${r.weight_per_output_unit || 1}</td>
        <td>${totalWeight(r)}</td>
        <td>${r.routing_name || '<span class="text-muted">—</span>'}</td>
        <td>${r.material_count} material${r.material_count !== 1 ? 's' : ''}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="RecipeModal.edit(${r.id})">Edit</button>
          ${!isAlt ? `<button class="btn btn-sm btn-outline-secondary" onclick="RecipeModal.show(RecipeModal._recipeCache[${r.id}])">+ Alternate</button>` : ''}
        </td>
      </tr>
    `;

    const html = recipes.length > 0
      ? recipes.map(r => rowHtml(r, false) + (r.alternates || []).map(a => rowHtml(a, true)).join('')).join('')
      : '<tr><td colspan="9" class="text-center text-muted py-4">No BOMs yet — create one before planning production for a product</td></tr>';

    document.getElementById('recipesList').innerHTML = html;
  }
};
