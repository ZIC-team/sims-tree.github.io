(function () {
  const STORAGE_KEY = "simsFamilyTrees_v1";

  let state = {
    trees: [],
    persons: [],
    activeTreeId: null,
    selectedPersonId: null
  };

  const rootSelect = document.getElementById("rootSelect");
  const showAllCheckbox = document.getElementById("bigShowAllTrees");
  const treeContainer = document.getElementById("bigTreeContainer");
  const nodesWrapper = document.getElementById("bigTreeNodes");
  const svg = document.getElementById("bigTreeLines");
  const emptyBlock = document.getElementById("bigTreeEmpty");

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
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
        state = Object.assign(
          { trees: [], persons: [], activeTreeId: null, selectedPersonId: null },
          parsed
        );
      }
    } catch (e) {
      console.error("Ошибка загрузки сохранений:", e);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function personShortLife(p) {
    const birth = p.birthDate ? p.birthDate.slice(0, 4) : "?";
    const death = p.deathDate ? p.deathDate.slice(0, 4) : "";
    if (birth === "?" && !death) return "даты неизвестны";
    if (!death) return `р. ${birth}`;
    return `${birth}–${death}`;
  }
	
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


  function isAdoptiveBetween(aId, bId) {
    const flags = getRelationFlagsBetween(aId, bId);
    return !!flags.adoptive;
  }


  function getActiveTree() {
    return state.trees.find(t => t.id === state.activeTreeId) || null;
  }

  function getParents(person, inScope) {
    const res = [];
    function add(p) {
      if (!p) return;
      if (inScope && !inScope(p)) return;
      if (!res.some(x => x.id === p.id)) res.push(p);
    }

    (person.relations || []).forEach(rel => {
      if (rel.type !== "parent") return;
      const target = state.persons.find(p => p.id === rel.targetId);
      add(target);
    });

    state.persons.forEach(other => {
      if (other.id === person.id) return;
      (other.relations || []).forEach(rel => {
        if (rel.targetId !== person.id) return;
        if (rel.type === "child") {
          add(other);
        }
      });
    });

    return res;
  }

  function getChildren(person, inScope) {
    const res = [];
    function add(p) {
      if (!p) return;
      if (inScope && !inScope(p)) return;
      if (!res.some(x => x.id === p.id)) res.push(p);
    }

    (person.relations || []).forEach(rel => {
      if (rel.type !== "child") return;
      const target = state.persons.find(p => p.id === rel.targetId);
      add(target);
    });

    state.persons.forEach(other => {
      if (other.id === person.id) return;
      (other.relations || []).forEach(rel => {
        if (rel.targetId !== person.id) return;
        if (rel.type === "parent") {
          add(other);
        }
      });
    });

    return res;
  }

  function getSpouses(person, inScope) {
    const res = [];
    function add(p) {
      if (!p) return;
      if (inScope && !inScope(p)) return;
      if (!res.some(x => x.id === p.id)) res.push(p);
    }

    (person.relations || []).forEach(rel => {
      if (rel.type !== "spouse") return;
      const target = state.persons.find(p => p.id === rel.targetId);
      add(target);
    });

    state.persons.forEach(other => {
      if (other.id === person.id) return;
      (other.relations || []).forEach(rel => {
        if (rel.targetId !== person.id) return;
        if (rel.type === "spouse") {
          add(other);
        }
      });
    });

    return res;
  }

    function buildRows(root) {
    const activeTree = getActiveTree();
    const showAll = showAllCheckbox.checked;

    const inScope = (p) => {
      if (!p) return false;
      if (showAll || !activeTree) return true;
      return Array.isArray(p.trees) && p.trees.includes(activeTree.id);
    };

    const parents = getParents(root, inScope);
    const grandparents = [];
    parents.forEach(par => {
      getParents(par, inScope).forEach(gp => {
        if (!grandparents.some(x => x.id === gp.id)) grandparents.push(gp);
      });
    });

    const children = getChildren(root, inScope);
    const grandchildren = [];
    children.forEach(ch => {
      getChildren(ch, inScope).forEach(gc => {
        if (!grandchildren.some(x => x.id === gc.id)) grandchildren.push(gc);
      });
    });

    const spouses = getSpouses(root, inScope);

    // Братья и сёстры — другие дети тех же родителей
    const siblings = [];
    parents.forEach(par => {
      getChildren(par, inScope).forEach(ch => {
        if (ch.id === root.id) return;
        if (!siblings.some(x => x.id === ch.id)) siblings.push(ch);
      });
    });

    const rows = [];

    if (grandparents.length) {
      rows.push({
        key: "grandparents",
        label: "Прабабушки и прадедушки",
        persons: grandparents
      });
    }

    if (parents.length) {
      rows.push({
        key: "parents",
        label: "Родители",
        persons: parents
      });
    }

    // --- раскладка супругов вокруг root ---
    let leftSpouses = [];
    let rightSpouses = [];

    if (spouses.length === 1) {
      // один супруг — можно справа (классика)
      rightSpouses = spouses;
    } else if (spouses.length >= 2) {
      // первый супруг слева, остальные справа
      leftSpouses = [spouses[0]];
      rightSpouses = spouses.slice(1);
    }

    // ЦЕНТРАЛЬНЫЙ РЯД:
    // [левый супруг] [root] [братья/сёстры] [остальные супруги]
    const centerPersons = []
      .concat(leftSpouses)
      .concat([root])
      .concat(siblings)
      .concat(rightSpouses);

    rows.push({
      key: "center",
      label: parents.length
        ? "Текущий персонаж, братья/сёстры и партнёры"
        : "Текущий персонаж и партнёры",
      persons: centerPersons
    });

    if (children.length) {
      rows.push({
        key: "children",
        label: "Дети",
        persons: children
      });
    }

    if (grandchildren.length) {
      rows.push({
        key: "grandchildren",
        label: "Внуки",
        persons: grandchildren
      });
    }

    return { rows, inScope };
  }



  function renderBigTree(rootId) {
    const root = state.persons.find(p => p.id === rootId);
    if (!root) {
      nodesWrapper.innerHTML = "";
      svg.innerHTML = "";
      treeContainer.classList.add("hidden");
      emptyBlock.classList.remove("hidden");
      return;
    }

    const { rows, inScope } = buildRows(root);

    if (!rows.length) {
      nodesWrapper.innerHTML = "";
      svg.innerHTML = "";
      treeContainer.classList.add("hidden");
      emptyBlock.classList.remove("hidden");
      return;
    }

    treeContainer.classList.remove("hidden");
    emptyBlock.classList.add("hidden");

    nodesWrapper.innerHTML = "";
    svg.innerHTML = "";

    const consideredIds = new Set();
    rows.forEach(row => {
      row.persons.forEach(p => consideredIds.add(p.id));
    });

    rows.forEach((row, rowIndex) => {
      const rowDiv = document.createElement("div");
      rowDiv.className = "big-tree-row";
      rowDiv.dataset.row = row.key;

      const label = document.createElement("div");
      label.className = "big-tree-row-label";
      label.textContent = row.label;
      rowDiv.appendChild(label);

      const nodesRow = document.createElement("div");
      nodesRow.className = "big-tree-row-nodes";

       row.persons.forEach((p, colIndex) => {
        const node = document.createElement("div");
        const isRoot = p.id === root.id;
        node.className = "tree-node-big" + (isRoot ? " tree-node-big-root" : "");
        node.dataset.id = p.id;
        node.dataset.rowIndex = String(rowIndex);
        node.dataset.colIndex = String(colIndex);

        const initials = (p.name || "?")
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map(part => part[0].toUpperCase())
          .join("");

        const years = personShortLife(p);
        const hasPhoto = !!p.photoUrl;
        const photoDiv = document.createElement("div");
        photoDiv.className = "tree-photo big" + (hasPhoto ? " has-image" : "");
        if (hasPhoto) {
          const img = document.createElement("img");
          img.src = p.photoUrl;
          img.alt = p.name || "";
          photoDiv.appendChild(img);
        } else {
          photoDiv.textContent = initials || "?";
        }

        const nameDiv = document.createElement("div");
        nameDiv.className = "tree-name";
        nameDiv.textContent = p.name || "Без имени";

        const yearsDiv = document.createElement("div");
        yearsDiv.className = "tree-years";
        yearsDiv.textContent = years;

        node.appendChild(photoDiv);
        node.appendChild(nameDiv);
        node.appendChild(yearsDiv);
// Теги для брака и приёмности относительно корня
        const flags = getRelationFlagsBetween(root.id, p.id);

        // Партнёры в центре — "в браке"
        if (row.key === "center" && p.id !== root.id && flags.married) {
          const tag = document.createElement("div");
          tag.className = "tree-tag tree-tag-married";
          tag.textContent = "в браке";
          node.appendChild(tag);
        }

        // Приёмные родители / дети относительно корня
        if ((row.key === "parents" || row.key === "children") && flags.adoptive) {
          const tag = document.createElement("div");
          tag.className = "tree-tag tree-tag-adoptive";
          tag.textContent = row.key === "parents"
            ? "приёмный родитель"
            : "приёмный ребёнок";
          node.appendChild(tag);
        }

        node.addEventListener("click", () => {
          rootSelect.value = p.id;
          renderBigTree(p.id);
        });

        nodesRow.appendChild(node);
      });

      rowDiv.appendChild(nodesRow);
      nodesWrapper.appendChild(rowDiv);
    });

    requestAnimationFrame(() => drawLines(rows, inScope, consideredIds));
  }

  function drawLines(rows, inScope, consideredIds) {
    svg.innerHTML = "";

    const wrapperRect = nodesWrapper.getBoundingClientRect();
    const width = nodesWrapper.scrollWidth || nodesWrapper.clientWidth;
    const height = nodesWrapper.scrollHeight || nodesWrapper.clientHeight;

    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const centers = new Map();
    const nodeEls = nodesWrapper.querySelectorAll(".tree-node-big");

    nodeEls.forEach(node => {
      const id = node.getAttribute("data-id");
      if (!id) return;
      const rect = node.getBoundingClientRect();
      const x = rect.left - wrapperRect.left + rect.width / 2;
      const y = rect.top - wrapperRect.top + rect.height / 2;
      centers.set(id, { x, y });
    });

    const rootId = rootSelect.value || null;

    function addLine(x1, y1, x2, y2, adoptive) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      line.setAttribute(
        "class",
        adoptive ? "big-tree-line big-tree-line-adoptive" : "big-tree-line"
      );
      svg.appendChild(line);
    }

    const drawnSegments = new Set();
    function addSegmentKeyed(x1, y1, x2, y2, adoptive) {
      const key = `${Math.round(x1)}_${Math.round(y1)}_${Math.round(x2)}_${Math.round(
        y2
      )}_${adoptive ? 1 : 0}`;
      if (drawnSegments.has(key)) return;
      drawnSegments.add(key);
      addLine(x1, y1, x2, y2, adoptive);
    }

    // Для каждого ребёнка строим его связи с родителями
    consideredIds.forEach(childId => {
      const child = state.persons.find(p => p.id === childId);
      if (!child) return;

      const childCenter = centers.get(child.id);
      if (!childCenter) return;

      let parents = getParents(child, inScope).filter(p => consideredIds.has(p.id));
      if (!parents.length) return;

      // Если среди родителей есть корневой персонаж, считаем, что это его семья:
      // оставляем корень + одного другого родителя (если он есть).
      if (rootId && parents.length > 1 && parents.some(p => p.id === rootId)) {
        const rootParent = parents.find(p => p.id === rootId);
        const others = parents.filter(p => p.id !== rootId);
        if (others.length) {
          parents = [rootParent, others[0]];
        } else {
          parents = [rootParent];
        }
      }

      // Если по каким-то причинам родителей всё ещё > 2 — режем до двух.
      if (parents.length > 2) {
        parents = parents.slice(0, 2);
      }

      if (parents.length >= 2) {
        // несколько родителей -> "симсовский" узел семьи
        const parentCenters = parents
          .map(p => ({
            p,
            c: centers.get(p.id),
            adoptive: isAdoptiveBetween(p.id, child.id)
          }))
          .filter(x => !!x.c);

        if (parentCenters.length < 2) return;

        parentCenters.sort((a, b) => a.c.x - b.c.x);
        const left = parentCenters[0].c;
        const right = parentCenters[parentCenters.length - 1].c;

        const yParents =
          parentCenters.reduce((sum, pc) => sum + pc.c.y, 0) / parentCenters.length;
        const yChild = childCenter.y;
        const yJoint = yParents + (yChild - yParents) * 0.4;
        const midX = (left.x + right.x) / 2;

        // от каждого родителя — вертикальная линия (пунктир если приёмный)
        parentCenters.forEach(({ c, adoptive }) => {
          addSegmentKeyed(c.x, c.y + 5, c.x, yJoint, adoptive);
        });

        // горизонтальная линия между двумя родителями (сплошная)
        addSegmentKeyed(left.x, yJoint, right.x, yJoint, false);

        // от середины к ребёнку (сплошная)
        addSegmentKeyed(midX, yJoint, midX, yChild - 5, false);
        addSegmentKeyed(midX, yChild - 5, childCenter.x, childCenter.y - 5, false);
      } else {
        // один родитель
        parents.forEach(parent => {
          const parentCenter = centers.get(parent.id);
          if (!parentCenter) return;
          const adoptive = isAdoptiveBetween(parent.id, child.id);
          addSegmentKeyed(
            parentCenter.x,
            parentCenter.y + 5,
            childCenter.x,
            childCenter.y - 5,
            adoptive
          );
        });
      }
    });
  }



  function populateRootSelect() {
    rootSelect.innerHTML = "";
    if (!state.persons.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Нет персонажей";
      rootSelect.appendChild(opt);
      rootSelect.disabled = true;
      treeContainer.classList.add("hidden");
      emptyBlock.classList.remove("hidden");
      return;
    }

    rootSelect.disabled = false;
    const activeTree = getActiveTree();
    const showAll = showAllCheckbox.checked;

    let persons = state.persons.slice();
    if (!showAll && activeTree) {
      persons = persons.filter(p => Array.isArray(p.trees) && p.trees.includes(activeTree.id));
    }

    if (!persons.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "В этом древе пока нет персонажей";
      rootSelect.appendChild(opt);
      treeContainer.classList.add("hidden");
      emptyBlock.classList.remove("hidden");
      return;
    }

    persons.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));

    persons.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name || "Без имени";
      rootSelect.appendChild(opt);
    });

    let rootId = persons[0].id;
    if (state.selectedPersonId && persons.some(p => p.id === state.selectedPersonId)) {
      rootId = state.selectedPersonId;
    }

    rootSelect.value = rootId;
    renderBigTree(rootId);
  }

  function init() {
    loadState();
    if (!state.trees.length && window.DEFAULT_STATE) {
      state = Object.assign(
        { trees: [], persons: [], activeTreeId: null, selectedPersonId: null },
        window.DEFAULT_STATE
      );
    }

    populateRootSelect();

    rootSelect.addEventListener("change", () => {
      const id = rootSelect.value;
      if (!id) return;
      state.selectedPersonId = id; // чтобы и главная страница помнила
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderBigTree(id);
    });

    showAllCheckbox.addEventListener("change", () => {
      populateRootSelect();
    });

    window.addEventListener("resize", () => {
      const id = rootSelect.value;
      if (id) {
        renderBigTree(id);
      }
    });
  }

  init();
})();
