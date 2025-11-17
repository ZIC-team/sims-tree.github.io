(function() {
  const STORAGE_KEY = "simsFamilyTrees_v1";

  let state = {
    trees: [],
    persons: [],
    activeTreeId: null,
    selectedPersonId: null
  };

  const treeListEl = document.getElementById("treeList");
  const addTreeBtn = document.getElementById("addTreeBtn");
  const addPersonBtn = document.getElementById("addPersonBtn");
  const showAllTreesCheckbox = document.getElementById("showAllTrees");
  const searchInput = document.getElementById("searchInput");
  const personTableBody = document.getElementById("personTableBody");
  const personDetailEl = document.getElementById("personDetail");
  const editPersonBtn = document.getElementById("editPersonBtn");
  const deletePersonBtn = document.getElementById("deletePersonBtn");
  const currentTreeTitleEl = document.getElementById("currentTreeTitle");
  const currentTreeSubtitleEl = document.getElementById("currentTreeSubtitle");
  const statsPillEl = document.getElementById("statsPill");

  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFileInput = document.getElementById("importFileInput");

  // Tree modal elements
  const treeModalBackdrop = document.getElementById("treeModalBackdrop");
  const treeModalTitle = document.getElementById("treeModalTitle");
  const treeIdInput = document.getElementById("treeIdInput");
  const treeNameInput = document.getElementById("treeNameInput");
  const treeColorInput = document.getElementById("treeColorInput");
  const treeDescriptionInput = document.getElementById("treeDescriptionInput");
  const saveTreeBtn = document.getElementById("saveTreeBtn");

  // Person modal elements
  const personModalBackdrop = document.getElementById("personModalBackdrop");
  const personModalTitle = document.getElementById("personModalTitle");
  const personIdInput = document.getElementById("personIdInput");
  const personNameInput = document.getElementById("personNameInput");
  const personHomeInput = document.getElementById("personHomeInput");
  const personBirthInput = document.getElementById("personBirthInput");
  const personDeathInput = document.getElementById("personDeathInput");
  const personPhotoInput = document.getElementById("personPhotoInput");
  const personNotesInput = document.getElementById("personNotesInput");
  const personTreesContainer = document.getElementById("personTreesContainer");
  const relationsContainer = document.getElementById("relationsContainer");
  const addRelationRowBtn = document.getElementById("addRelationRowBtn");
  const savePersonBtn = document.getElementById("savePersonBtn");

  function uid() {
    return "id_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

	function syncReverseRelations(person) {
  const revMap = {
    parent: "child",
    child: "parent",
    spouse: "spouse",
    sibling: "sibling",
    friend: "friend"
  };

  // 1) Сначала чистим все связи, которые указывают на этого персонажа
  state.persons.forEach(target => {
    if (target.id === person.id) return;
    if (!Array.isArray(target.relations)) return;
    target.relations = target.relations.filter(r => r.targetId !== person.id);
  });

  // 2) Потом заново создаём обратные по текущему списку
  (person.relations || []).forEach(rel => {
    if (!rel || !rel.targetId || !rel.type) return;
    const revType = revMap[rel.type];
    if (!revType) return;

    const target = state.persons.find(p => p.id === rel.targetId);
    if (!target) return;
    if (!Array.isArray(target.relations)) target.relations = [];

    target.relations.push({
      targetId: person.id,
      type: revType,
      adoptive: !!rel.adoptive,
      married: !!rel.married
    });
  });
}

 // Флаги связи между двумя персонажами:
  // adoptive = есть приёмный родитель/ребёнок,
  // married  = есть супружеская связь с флажком "в браке".
  function getRelationFlagsBetween(aId, bId) {
    const a = state.persons.find(p => p.id === aId);
    const b = state.persons.find(p => p.id === bId);
    if (!a || !b) return { adoptive: false, married: false };

    let adoptive = false;
    let married = false;

    function scan(from, toId) {
      (from.relations || []).forEach(rel => {
        if (!rel || rel.targetId !== toId) return;
        if ((rel.type === "parent" || rel.type === "child") && rel.adoptive) {
          adoptive = true;
        }
        if (rel.type === "spouse" && rel.married) {
          married = true;
        }
      });
    }

    scan(a, bId);
    scan(b, aId);

    return { adoptive, married };
  }
  
  
// Создаём/обновляем обратные связи у других персонажей:
  // parent <-> child, spouse <-> spouse, sibling <-> sibling, friend <-> friend
  function syncReverseRelations(person) {
    const revMap = {
      parent: "child",
      child: "parent",
      spouse: "spouse",
      sibling: "sibling",
      friend: "friend"
    };

    (person.relations || []).forEach(rel => {
      if (!rel || !rel.targetId || !rel.type) return;
      const revType = revMap[rel.type];
      if (!revType) return;

      const target = state.persons.find(p => p.id === rel.targetId);
      if (!target) return;
      if (!Array.isArray(target.relations)) target.relations = [];

      const existing = target.relations.find(
        r => r.targetId === person.id && r.type === revType
      );
      if (existing) {
        existing.adoptive = !!rel.adoptive;
        existing.married = !!rel.married;
      } else {
        target.relations.push({
          targetId: person.id,
          type: revType,
          adoptive: !!rel.adoptive,
          married: !!rel.married
        });
      }
    });
  }
  
  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // если есть стартовые данные из data.js — используем их
      if (window.DEFAULT_STATE) {
        state = Object.assign(
          { trees: [], persons: [], activeTreeId: null, selectedPersonId: null },
          window.DEFAULT_STATE
        );
      }
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        state = Object.assign({ trees: [], persons: [], activeTreeId: null, selectedPersonId: null }, parsed);
      }
    } catch (e) {
      console.error("Ошибка загрузки сохранений:", e);
    }
  }

  function ensureDefaultTree() {
    if (state.trees.length === 0) {
      const t = {
        id: uid(),
        name: "Основное древо",
        color: "#38bdf8",
        description: "Стартовое древо для ваших симов."
      };
      state.trees.push(t);
      state.activeTreeId = t.id;
    } else if (!state.activeTreeId) {
      state.activeTreeId = state.trees[0].id;
    }
  }

  function getActiveTree() {
    return state.trees.find(t => t.id === state.activeTreeId) || null;
  }

  function openTreeModal(tree) {
    if (tree) {
      treeModalTitle.textContent = "Редактирование древа";
      treeIdInput.value = tree.id;
      treeNameInput.value = tree.name || "";
      treeColorInput.value = tree.color || "#38bdf8";
      treeDescriptionInput.value = tree.description || "";
    } else {
      treeModalTitle.textContent = "Новое древо";
      treeIdInput.value = "";
      treeNameInput.value = "";
      treeColorInput.value = "#38bdf8";
      treeDescriptionInput.value = "";
    }
    treeModalBackdrop.classList.remove("hidden");
    treeNameInput.focus();
  }

  function closeTreeModal() {
    treeModalBackdrop.classList.add("hidden");
  }

  function openPersonModal(person) {
    renderPersonTreesCheckboxes();

    if (person) {
  personModalTitle.textContent = "Редактирование персонажа";
  personIdInput.value = person.id;
  personNameInput.value = person.name || "";
  personHomeInput.value = person.home || "";
  personBirthInput.value = person.birthDate || "";
  personDeathInput.value = person.deathDate || "";
  personPhotoInput.value = person.photoUrl || "";
  personNotesInput.value = person.notes || "";          // ← ДОБАВИТЬ ЭТО

  const combinedRelations = buildCombinedRelationsForPerson(person.id);

  // mark trees
  const checkboxEls = personTreesContainer.querySelectorAll("input[type=checkbox]");
  checkboxEls.forEach(cb => {
    cb.checked = Array.isArray(person.trees) && person.trees.includes(cb.value);
  });

  // relations
  renderRelationRows(combinedRelations);
}

    personModalBackdrop.classList.remove("hidden");
    personNameInput.focus();
  }

  function closePersonModal() {
    personModalBackdrop.classList.add("hidden");
  }

  function renderTrees() {
    treeListEl.innerHTML = "";
    if (state.trees.length === 0) return;

    state.trees.forEach(tree => {
      const li = document.createElement("li");
      li.className = "tree-item" + (tree.id === state.activeTreeId ? " active" : "");
      li.dataset.id = tree.id;

      const labelDiv = document.createElement("div");
      labelDiv.className = "tree-label";

      const dot = document.createElement("div");
      dot.className = "tree-dot";
      dot.style.backgroundColor = tree.color || "#38bdf8";
      labelDiv.appendChild(dot);

      const nameSpan = document.createElement("div");
      nameSpan.className = "tree-name";
      nameSpan.textContent = tree.name || "Без названия";
      labelDiv.appendChild(nameSpan);

      const countSpan = document.createElement("div");
      countSpan.className = "tree-count";
      const count = state.persons.filter(p => Array.isArray(p.trees) && p.trees.includes(tree.id)).length;
      countSpan.textContent = count;
      labelDiv.appendChild(countSpan);

      li.appendChild(labelDiv);

      const actions = document.createElement("div");
      actions.className = "tree-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn-icon";
      editBtn.title = "Редактировать";
      editBtn.innerHTML = "✎";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openTreeModal(tree);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn-icon";
      deleteBtn.title = "Удалить";
      deleteBtn.innerHTML = "🗑";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteTree(tree.id);
      });

      actions.appendChild(editBtn);
      if (state.trees.length > 1) {
        actions.appendChild(deleteBtn);
      }

      li.appendChild(actions);

      li.addEventListener("click", () => {
        state.activeTreeId = tree.id;
        state.selectedPersonId = null;
        renderTrees();
        renderPersons();
        renderPersonDetail();
        saveState();
      });

      treeListEl.appendChild(li);
    });

    updateTopInfo();
  }

  function deleteTree(treeId) {
    const personsUsing = state.persons.filter(p => Array.isArray(p.trees) && p.trees.includes(treeId)).length;
    if (!confirm(`Удалить это древо?\nВ нём числится персонажей: ${personsUsing}.\nПерсонажи не будут удалены, только привязка к этому древу.`)) {
      return;
    }
    state.trees = state.trees.filter(t => t.id !== treeId);
    state.persons.forEach(p => {
      if (Array.isArray(p.trees)) {
        p.trees = p.trees.filter(id => id !== treeId);
      }
    });
    if (!state.trees.length) {
      ensureDefaultTree();
    } else if (!state.trees.find(t => t.id === state.activeTreeId)) {
      state.activeTreeId = state.trees[0].id;
    }
    saveState();
    renderTrees();
    renderPersons();
    renderPersonDetail();
  }

  function updateTopInfo() {
    const activeTree = getActiveTree();
    const totalPersons = state.persons.length;
    const activePersons = activeTree
      ? state.persons.filter(p => Array.isArray(p.trees) && p.trees.includes(activeTree.id)).length
      : 0;

    if (showAllTreesCheckbox.checked) {
      currentTreeTitleEl.textContent = "Персонажи — все древа";
      currentTreeSubtitleEl.textContent = `Всего персонажей: ${totalPersons}`;
    } else if (activeTree) {
      currentTreeTitleEl.textContent = activeTree.name || "Без названия";
      currentTreeSubtitleEl.textContent = activeTree.description || "Текущее активное древо.";
    } else {
      currentTreeTitleEl.textContent = "Персонажи";
      currentTreeSubtitleEl.textContent = "";
    }

    statsPillEl.textContent = `${totalPersons} персонаж(ей), в активном древе: ${activePersons}`;
  }

  function renderPersons() {
    const searchTerm = (searchInput.value || "").trim().toLowerCase();
    const activeTree = getActiveTree();
    const showAll = showAllTreesCheckbox.checked;

    let list = state.persons.slice();

    if (!showAll && activeTree) {
      list = list.filter(p => Array.isArray(p.trees) && p.trees.includes(activeTree.id));
    }

    if (searchTerm) {
      list = list.filter(p => (p.name || "").toLowerCase().includes(searchTerm));
    }

    personTableBody.innerHTML = "";

    list.forEach(person => {
      const tr = document.createElement("tr");
      tr.dataset.id = person.id;
      if (person.id === state.selectedPersonId) {
        tr.classList.add("selected");
      }

      const dead = !!person.deathDate;
      const multiTrees = Array.isArray(person.trees) && person.trees.length > 1;

      const tdName = document.createElement("td");
      tdName.textContent = person.name || "Без имени";
      tr.appendChild(tdName);

      const tdLife = document.createElement("td");
      if (person.birthDate || person.deathDate) {
        const birth = person.birthDate || "?";
        const death = person.deathDate || "";
        tdLife.textContent = `${birth} — ${death || "..."}`;
      } else {
        tdLife.textContent = "—";
      }
      if (dead) {
        const badge = document.createElement("span");
        badge.className = "badge badge-dead";
        badge.textContent = "умер";
        tdLife.appendChild(document.createTextNode(" "));
        tdLife.appendChild(badge);
      }
      tr.appendChild(tdLife);

      const tdHome = document.createElement("td");
      tdHome.textContent = person.home || "—";
      tr.appendChild(tdHome);

      const tdTrees = document.createElement("td");
      const numTrees = Array.isArray(person.trees) ? person.trees.length : 0;
      if (numTrees === 0) {
        tdTrees.textContent = "—";
      } else {
        const badge = document.createElement("span");
        badge.className = "badge" + (multiTrees ? " badge-multi" : "");
        badge.textContent = `${numTrees}`;
        tdTrees.appendChild(badge);
      }
      tr.appendChild(tdTrees);

      tr.addEventListener("click", () => {
        state.selectedPersonId = person.id;
        renderPersons();
        renderPersonDetail();
        saveState();
      });

      personTableBody.appendChild(tr);
    });

    updateTopInfo();
  }

  function personShortLife(p) {
    const birth = p.birthDate ? p.birthDate.slice(0, 4) : "?";
    const death = p.deathDate ? p.deathDate.slice(0, 4) : "";
    if (birth === "?" && !death) return "даты неизвестны";
    if (!death) return `р. ${birth}`;
    return `${birth}–${death}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* MINI-TREE BUILDER */
  function buildMiniTreeHtml(person) {
    const activeTree = getActiveTree();
    const showAll = showAllTreesCheckbox.checked;

    const inScope = (p) => {
      if (!p || p.id === person.id) return false;
      if (showAll || !activeTree) return true;
      return Array.isArray(p.trees) && p.trees.includes(activeTree.id);
    };

    // теперь храним не просто персонажей, а { person, adoptive, married }
    const parents = [];
    const children = [];
    const spouses = [];

    function uniqPush(arr, personObj, flags) {
      if (!personObj) return;
      if (arr.some(x => x.person.id === personObj.id)) return;
      arr.push({
        person: personObj,
        adoptive: !!(flags && flags.adoptive),
        married: !!(flags && flags.married)
      });
    }

    // связи, указанные у самого персонажа
    (person.relations || []).forEach(rel => {
      const target = state.persons.find(p => p.id === rel.targetId);
      if (!inScope(target)) return;

      const flags = getRelationFlagsBetween(person.id, target.id);

      if (rel.type === "parent") {
        uniqPush(parents, target, flags);           // target = родитель
      }
      if (rel.type === "child") {
        uniqPush(children, target, flags);          // target = ребёнок
      }
      if (rel.type === "spouse") {
        uniqPush(spouses, target, flags);           // target = партнёр
      }
    });

    // обратные связи из других персонажей
    state.persons.forEach(other => {
      if (other.id === person.id || !inScope(other)) return;
      (other.relations || []).forEach(rel => {
        if (rel.targetId !== person.id) return;

        const flags = getRelationFlagsBetween(person.id, other.id);

        if (rel.type === "child") {
          // other -> child -> this  => other = родитель
          uniqPush(parents, other, flags);
        }
        if (rel.type === "parent") {
          // other -> parent -> this => other = ребёнок
          uniqPush(children, other, flags);
        }
        if (rel.type === "spouse") {
          uniqPush(spouses, other, flags);
        }
      });
    });

    const hasAnything = parents.length || children.length || spouses.length;
    if (!hasAnything) {
      return `<div class="panel-subtitle">Для построения древа у этого персонажа пока нет указанных родителей, детей или партнёров.</div>`;
    }

    function renderNode(entry, relationType) {
      const p = entry.person || entry;
      const initials = (p.name || "?")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join("");
      const years = personShortLife(p);
      const hasPhoto = !!p.photoUrl;
      const photoInner = hasPhoto
        ? `<img src="${escapeHtml(p.photoUrl)}" alt="${escapeHtml(p.name || "")}">`
        : escapeHtml(initials || "?");
      const photoClass = "tree-photo" + (hasPhoto ? " has-image" : "");

      const tags = [];

      // приёмные связи: разный текст для родителя и ребёнка
      if (entry.adoptive) {
        let text = "приёмный";
        if (relationType === "parent") text = "приёмный родитель";
        else if (relationType === "child") text = "приёмный ребёнок";
        tags.push(`<div class="tree-tag tree-tag-adoptive">${text}</div>`);
      }

      // брак для партнёров
      if (relationType === "spouse" && entry.married) {
        tags.push(`<div class="tree-tag tree-tag-married">в браке</div>`);
      }

      return `
        <div class="tree-node" data-id="${escapeHtml(p.id)}">
          <div class="${photoClass}">${photoInner}</div>
          <div class="tree-name">${escapeHtml(p.name || "Без имени")}</div>
          <div class="tree-years">${escapeHtml(years)}</div>
          ${tags.join("")}
        </div>
      `;
    }


    function renderRow(label, arr, relationType) {
      if (!arr.length) return "";
      return `
        <div class="tree-row-label">${label}</div>
        <div class="tree-row-nodes">
          ${arr.map(entry => renderNode(entry, relationType)).join("")}
        </div>
      `;
    }

    // текущий персонаж (без тегов) + партнёры (с тегами "в браке" при необходимости)
    const selfEntry = { person };
    const centerRow = `
      <div class="tree-row-label">Текущий персонаж</div>
      <div class="tree-row-nodes">
        ${renderNode(selfEntry, "self")}
        ${spouses.length ? spouses.map(entry => renderNode(entry, "spouse")).join("") : ""}
      </div>
    `;

    return `
      <div class="tree-view">
        ${renderRow("Родители", parents, "parent")}
        ${parents.length ? `<div class="tree-connector"><div class="tree-connector-line"></div></div>` : ""}
        ${centerRow}
        ${children.length ? `<div class="tree-connector"><div class="tree-connector-line"></div></div>` : ""}
        ${renderRow("Дети", children, "child")}
      </div>
    `;
  }

  function renderPersonTreesCheckboxes() {
    personTreesContainer.innerHTML = "";
    if (!state.trees.length) return;
    state.trees.forEach(tree => {
      const label = document.createElement("label");
      label.className = "tree-checkbox";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = tree.id;
      const dot = document.createElement("span");
      dot.style.display = "inline-block";
      dot.style.width = "8px";
      dot.style.height = "8px";
      dot.style.borderRadius = "999px";
      dot.style.backgroundColor = tree.color || "#38bdf8";
      dot.style.marginRight = "4px";
      const nameSpan = document.createElement("span");
      nameSpan.textContent = tree.name || "Без названия";

      label.appendChild(cb);
      label.appendChild(dot);
      label.appendChild(nameSpan);
      personTreesContainer.appendChild(label);
    });
  }

  function renderRelationRows(relations) {
    relationsContainer.innerHTML = "";
    const otherPersons = state.persons.filter(
      p => p.id !== personIdInput.value
    );

    function createRow(rel) {
      const row = document.createElement("div");
      row.className = "relation-row";

      // Выбор персонажа
      const selectPerson = document.createElement("select");
      selectPerson.className = "form-select relation-target-select";
      const defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "Выберите персонажа...";
      selectPerson.appendChild(defaultOpt);
      otherPersons.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name || "Без имени";
        selectPerson.appendChild(opt);
      });
      if (rel && rel.targetId) {
        selectPerson.value = rel.targetId;
      }

      // Тип связи
      const selectType = document.createElement("select");
      selectType.className = "form-select relation-type-select";
      const types = [
        ["parent", "Родитель"],
        ["child", "Ребёнок"],
        ["spouse", "Партнёр / супруг"],
        ["sibling", "Брат / сестра"],
        ["friend", "Друг"]
      ];
      types.forEach(([val, label]) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        selectType.appendChild(opt);
      });
      if (rel && rel.type) {
        selectType.value = rel.type;
      }

      // Флажки: приёмный / в браке
      const flagsDiv = document.createElement("div");
      flagsDiv.className = "relation-flags";
      flagsDiv.innerHTML = `
        <label class="flag-adoptive">
          <input type="checkbox" class="rel-flag-adoptive" />
          приёмный
        </label>
        <label class="flag-married">
          <input type="checkbox" class="rel-flag-married" />
          в браке
        </label>
      `;
      const adoptiveCb = flagsDiv.querySelector(".rel-flag-adoptive");
      const marriedCb = flagsDiv.querySelector(".rel-flag-married");

      if (rel && rel.adoptive) adoptiveCb.checked = true;
      if (rel && rel.married) marriedCb.checked = true;

      function updateFlagsVisibility() {
        const t = selectType.value;
        const showAdoptive = t === "parent" || t === "child";
        const showMarried = t === "spouse";
        flagsDiv.querySelector(".flag-adoptive").style.display = showAdoptive ? "" : "none";
        flagsDiv.querySelector(".flag-married").style.display = showMarried ? "" : "none";
      }

      selectType.addEventListener("change", updateFlagsVisibility);
      updateFlagsVisibility();

      // Кнопка удаления строки
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-icon";
      removeBtn.innerHTML = "&times;";
      removeBtn.title = "Удалить связь";
      removeBtn.addEventListener("click", () => {
        relationsContainer.removeChild(row);
      });

      row.appendChild(selectPerson);
      row.appendChild(selectType);
      row.appendChild(flagsDiv);
      row.appendChild(removeBtn);
      relationsContainer.appendChild(row);
    }

    if (relations && relations.length) {
      relations.forEach(rel => createRow(rel));
    } else {
      createRow(null);
    }
  }


  function gatherPersonFormData() {
    const id = personIdInput.value || uid();
    const name = personNameInput.value.trim();
    if (!name) {
      alert("Введите имя персонажа.");
      return null;
    }

    const home = personHomeInput.value.trim();
    const birthDate = personBirthInput.value || "";
    const deathDate = personDeathInput.value || "";
    const photoUrl = personPhotoInput.value.trim();
    const notes = personNotesInput.value.trim();

    const trees = [];
    const checkboxEls = personTreesContainer.querySelectorAll("input[type=checkbox]");
    checkboxEls.forEach(cb => {
      if (cb.checked) trees.push(cb.value);
    });

      const relations = [];
    const rows = relationsContainer.querySelectorAll(".relation-row");
    rows.forEach(row => {
      const selPerson = row.querySelector(".relation-target-select");
      const selType = row.querySelector(".relation-type-select");
      const adoptiveCb = row.querySelector(".rel-flag-adoptive");
      const marriedCb = row.querySelector(".rel-flag-married");

      const targetId = selPerson.value;
      const type = selType.value;
      if (!targetId || !type) return;

      relations.push({
        targetId,
        type,
        adoptive: !!(adoptiveCb && adoptiveCb.checked),
        married: !!(marriedCb && marriedCb.checked)
      });
    });


    return {
      id,
      name,
      home,
      birthDate,
      deathDate,
      photoUrl,
      notes,
      trees,
      relations
    };
  }

function savePerson() {
    const data = gatherPersonFormData();
    if (!data) return;

    const idx = state.persons.findIndex(p => p.id === data.id);
    if (idx === -1) {
      state.persons.push(data);
    } else {
      state.persons[idx] = data;
    }

    // создаём/обновляем обратные связи
    syncReverseRelations(data);

    state.selectedPersonId = data.id;
    saveState();
    renderPersons();
    renderPersonDetail();
    closePersonModal();
  }

  function deletePerson(personId) {
    const person = state.persons.find(p => p.id === personId);
    if (!person) return;
    if (!confirm(`Удалить персонажа «${person.name || "Без имени"}»?`)) {
      return;
    }
    state.persons = state.persons.filter(p => p.id !== personId);
    // также удаляем ссылки на него в связях других
    state.persons.forEach(p => {
      if (!Array.isArray(p.relations)) return;
      p.relations = p.relations.filter(r => r.targetId !== personId);
    });
    if (state.selectedPersonId === personId) {
      state.selectedPersonId = null;
    }
    saveState();
    renderPersons();
    renderPersonDetail();
  }

  function saveTree() {
    const id = treeIdInput.value || uid();
    const name = treeNameInput.value.trim();
    if (!name) {
      alert("Введите название древа.");
      return;
    }
    const color = treeColorInput.value || "#38bdf8";
    const description = treeDescriptionInput.value.trim();

    const idx = state.trees.findIndex(t => t.id === id);
    if (idx === -1) {
      state.trees.push({ id, name, color, description });
      state.activeTreeId = id;
    } else {
      state.trees[idx] = { id, name, color, description };
    }
    saveState();
    renderTrees();
    renderPersons();
    closeTreeModal();
  }

  function exportJson() {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sims_trees_export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object") throw new Error("Неверный формат данных.");
        if (!Array.isArray(parsed.trees) || !Array.isArray(parsed.persons)) {
          throw new Error("В файле отсутствуют поля trees/persons.");
        }
        state = Object.assign({ trees: [], persons: [], activeTreeId: null, selectedPersonId: null }, parsed);
        ensureDefaultTree();
        saveState();
        renderTrees();
        renderPersons();
        renderPersonDetail();
        alert("Данные успешно импортированы.");
      } catch (e) {
        console.error(e);
        alert("Ошибка импорта: " + e.message);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function renderPersonDetail() {
    const person = state.persons.find(p => p.id === state.selectedPersonId);
    if (!person) {
      editPersonBtn.classList.add("hidden");
      deletePersonBtn.classList.add("hidden");
      personDetailEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🌿</div>
          <div><strong>Выберите персонажа слева</strong>, чтобы увидеть подробности, связи и мини-древо.</div>
          <div style="margin-top:6px;">Или создайте нового симa — кнопка «+ персонаж» сверху слева.</div>
        </div>
      `;
      return;
    }

    editPersonBtn.classList.remove("hidden");
    deletePersonBtn.classList.remove("hidden");

    const initials = (person.name || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join("");

    const lifeParts = [];
    if (person.birthDate) lifeParts.push(person.birthDate);
    if (person.deathDate) lifeParts.push(person.deathDate);
    const lifeLine = lifeParts.length ? lifeParts.join(" — ") : "даты неизвестны";

    const homeLabel = person.home || "место жительства не указано";

    const personTrees = Array.isArray(person.trees)
      ? state.trees.filter(t => person.trees.includes(t.id))
      : [];

     const relationsByType = {};
    const relationTypeLabels = {
      parent: "Родители",
      child: "Дети",
      spouse: "Партнёры / супруги",
      sibling: "Братья и сёстры",
      friend: "Друзья"
    };

    function addRel(type, targetPerson, flags) {
      if (!relationsByType[type]) relationsByType[type] = [];
      const arr = relationsByType[type];
      if (arr.some(entry => entry.person.id === targetPerson.id)) return;
      arr.push({
        person: targetPerson,
        adoptive: !!(flags && flags.adoptive),
        married: !!(flags && flags.married)
      });
    }

    // Прямые связи этого персонажа
    (person.relations || []).forEach(rel => {
      if (!rel || !rel.targetId || !rel.type) return;
      const target = state.persons.find(p => p.id === rel.targetId);
      if (!target) return;
      addRel(rel.type, target, { adoptive: rel.adoptive, married: rel.married });
    });

    // Обратные связи – чтобы дети/родители были видны с обеих сторон
    state.persons.forEach(other => {
      if (other.id === person.id) return;
      (other.relations || []).forEach(rel => {
        if (!rel || !rel.targetId || !rel.type) return;
        if (rel.targetId !== person.id) return;

        let typeForThis = null;
        if (rel.type === "child") typeForThis = "parent";
        else if (rel.type === "parent") typeForThis = "child";
        else if (rel.type === "spouse") typeForThis = "spouse";
        else if (rel.type === "sibling") typeForThis = "sibling";
        else if (rel.type === "friend") typeForThis = "friend";
        if (!typeForThis) return;

        addRel(typeForThis, other, { adoptive: rel.adoptive, married: rel.married });
      });
    });

    let relationsHtml = "";
    const relTypesOrder = ["spouse", "parent", "child", "sibling", "friend"];
    relTypesOrder.forEach(type => {
      const arr = relationsByType[type];
      if (!arr || !arr.length) return;
      relationsHtml += `<div class="relations-group">
        <div class="section-title">${relationTypeLabels[type] || type}</div>
        <div class="relations-list">
          ${arr
            .map(entry => {
              const p = entry.person;
              const extras = [];
              if ((type === "parent" || type === "child") && entry.adoptive) {
                extras.push(`<span class="rel-flag-tag">приёмный</span>`);
              }
              if (type === "spouse" && entry.married) {
                extras.push(`<span class="rel-flag-tag">в браке</span>`);
              }
              return `
                <div class="relation-pill">
                  <strong>${escapeHtml(p.name || "Без имени")}</strong>
                  <span> — ${escapeHtml(personShortLife(p))}</span>
                  ${extras.join("")}
                </div>
              `;
            })
            .join("")}
        </div>
      </div>`;
    });


    if (!relationsHtml) {
      relationsHtml = `<div class="panel-subtitle">Связи не указаны. Открой карточку на редактирование и добавь родственников/друзей.</div>`;
    }

    const notesHtml = person.notes
      ? `<div class="panel-subtitle" style="white-space:pre-wrap;">${escapeHtml(person.notes)}</div>`
      : `<div class="panel-subtitle">Заметки отсутствуют. Можно использовать это поле для челленджей, поколений и т.п.</div>`;

    const treeHtml = buildMiniTreeHtml(person);

    personDetailEl.innerHTML = `
      <div class="detail-header">
        <div class="detail-main">
          <div class="avatar">${escapeHtml(initials || "?")}</div>
          <div>
            <div class="detail-name">${escapeHtml(person.name || "Без имени")}</div>
            <div class="detail-meta">
              <span>${escapeHtml(lifeLine)}</span>
              <span>${escapeHtml(homeLabel)}</span>
            </div>
            <div class="tags-row" style="margin-top:4px;">
              ${
                personTrees.length
                  ? personTrees
                      .map(
                        t =>
                          `<div class="tag" title="${escapeHtml(t.description || "")}">
                             <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${t.color ||
                               "#38bdf8"};margin-right:5px;"></span>${escapeHtml(t.name || "Без названия")}
                           </div>`
                      )
                      .join("")
                  : `<div class="tag">Не привязан ни к одному древу</div>`
              }
            </div>
          </div>
        </div>
      </div>

      <div class="section-title">Связи</div>
      ${relationsHtml}

      <div class="section-title">Заметки</div>
      ${notesHtml}

      <div class="section-title">Мини-древо (родители / партнёры / дети)</div>
      ${treeHtml}
    `;
  }

 // Строим объединённый список связей для персонажа:
  // и те, что записаны у него,
  // и обратные (из других персонажей в его сторону),
  // при этом тип приводим к "точке зрения" этого персонажа.
  function buildCombinedRelationsForPerson(personId) {
    const self = state.persons.find(p => p.id === personId);
    if (!self) return [];

    const combined = [];
    const used = new Set(); // "type:targetId"

    function add(type, targetId, extra) {
      const key = type + ":" + targetId;
      if (used.has(key)) return;
      used.add(key);
      combined.push({
        targetId,
        type,
        adoptive: !!(extra && extra.adoptive),
        married: !!(extra && extra.married)
      });
    }

    // Прямые связи самого персонажа
    (self.relations || []).forEach(rel => {
      if (!rel || !rel.targetId || !rel.type) return;
      add(rel.type, rel.targetId, { adoptive: rel.adoptive, married: rel.married });
    });

    // Обратные связи из других персонажей
    state.persons.forEach(other => {
      if (other.id === personId) return;
      (other.relations || []).forEach(rel => {
        if (!rel || !rel.targetId || !rel.type) return;
        if (rel.targetId !== personId) return;

        let typeForThis = null;
        if (rel.type === "child") typeForThis = "parent";
        else if (rel.type === "parent") typeForThis = "child";
        else if (rel.type === "spouse") typeForThis = "spouse";
        else if (rel.type === "sibling") typeForThis = "sibling";
        else if (rel.type === "friend") typeForThis = "friend";
        if (!typeForThis) return;

        add(typeForThis, other.id, { adoptive: rel.adoptive, married: rel.married });
      });
    });

    return combined;
  }
  
  function init() {
    loadState();
    ensureDefaultTree();
    renderTrees();
    renderPersons();
    renderPersonDetail();

    addTreeBtn.addEventListener("click", () => openTreeModal(null));
    addPersonBtn.addEventListener("click", () => openPersonModal(null));

    document.querySelectorAll("[data-close-tree-modal]").forEach(btn => {
      btn.addEventListener("click", closeTreeModal);
    });
    document.querySelectorAll("[data-close-person-modal]").forEach(btn => {
      btn.addEventListener("click", closePersonModal);
    });

    saveTreeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      saveTree();
    });

    savePersonBtn.addEventListener("click", (e) => {
      e.preventDefault();
      savePerson();
    });

addRelationRowBtn.addEventListener("click", () => {
  const currentRelations = [];
  const rows = relationsContainer.querySelectorAll(".relation-row");
  rows.forEach(row => {
    const selPerson = row.querySelector(".relation-target-select");
    const selType = row.querySelector(".relation-type-select");
    const adoptiveCb = row.querySelector(".rel-flag-adoptive");
    const marriedCb = row.querySelector(".rel-flag-married");

    if (selPerson && selType && selPerson.value) {
      currentRelations.push({
        targetId: selPerson.value,
        type: selType.value,
        adoptive: !!(adoptiveCb && adoptiveCb.checked),
        married: !!(marriedCb && marriedCb.checked),
      });
    }
  });

  // добавляем пустую строку
  renderRelationRows(currentRelations.concat({}));
});

    showAllTreesCheckbox.addEventListener("change", () => {
      renderPersons();
      renderPersonDetail();
    });

    searchInput.addEventListener("input", () => {
      renderPersons();
    });

    editPersonBtn.addEventListener("click", () => {
      const person = state.persons.find(p => p.id === state.selectedPersonId);
      if (!person) return;
      openPersonModal(person);
    });

    deletePersonBtn.addEventListener("click", () => {
      if (!state.selectedPersonId) return;
      deletePerson(state.selectedPersonId);
    });

    exportBtn.addEventListener("click", () => exportJson());

    importBtn.addEventListener("click", () => {
      importFileInput.value = "";
      importFileInput.click();
    });
    importFileInput.addEventListener("change", (e) => {
      if (!e.target.files || !e.target.files[0]) return;
      importJson(e.target.files[0]);
    });

    // Клик по узлу мини-древа -> перейти к этому персонажу
    personDetailEl.addEventListener("click", (e) => {
      const node = e.target.closest(".tree-node");
      if (!node) return;
      const pid = node.getAttribute("data-id");
      if (!pid) return;
      const person = state.persons.find(p => p.id === pid);
      if (!person) return;
      state.selectedPersonId = pid;
      renderPersons();
      renderPersonDetail();
      saveState();
    });
  }

  init();
})();
