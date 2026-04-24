const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const USER_ID = 'kathir A_02082005';
const EMAIL_ID = 'ka9141@srmist.edu.in';
const COLLEGE_ROLL_NUMBER = 'RA2311003050120';

const VALID_EDGE = /^[A-Z]->[A-Z]$/;

function classify(raw) {
  const entry = String(raw).trim();
  if (!VALID_EDGE.test(entry)) return { valid: false, entry };
  const [parent, child] = entry.split('->');
  if (parent === child) return { valid: false, entry };
  return { valid: true, entry, parent, child };
}

function buildGraph(edges) {
  const children = {};
  const parents = {};
  const nodes = new Set();

  for (const { parent, child } of edges) {
    nodes.add(parent);
    nodes.add(child);
    if (!children[parent]) children[parent] = [];
    if (parents[child] === undefined) {
      parents[child] = parent;
      children[parent].push(child);
    }
  }

  return { children, parents, nodes };
}

function findConnectedComponents(nodes, children) {
  const visited = new Set();
  const components = [];

  const dfs = (node, comp) => {
    if (visited.has(node)) return;
    visited.add(node);
    comp.add(node);
    for (const c of (children[node] || [])) dfs(c, comp);
  };

  for (const node of nodes) {
    if (!visited.has(node)) {
      const comp = new Set();
      dfs(node, comp);
      components.push(comp);
    }
  }
  return components;
}

function hasCycle(nodes, children) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  for (const n of nodes) color[n] = WHITE;

  const dfs = (node) => {
    color[node] = GRAY;
    for (const c of (children[node] || [])) {
      if (color[c] === GRAY) return true;
      if (color[c] === WHITE && dfs(c)) return true;
    }
    color[node] = BLACK;
    return false;
  };

  for (const n of nodes) {
    if (color[n] === WHITE && dfs(n)) return true;
  }
  return false;
}

function buildTree(root, children) {
  const tree = {};
  const build = (node, obj) => {
    obj[node] = {};
    for (const c of (children[node] || [])) {
      build(c, obj[node]);
    }
  };
  build(root, tree);
  return tree;
}

function treeDepth(root, children) {
  const dfs = (node) => {
    const kids = children[node] || [];
    if (kids.length === 0) return 1;
    return 1 + Math.max(...kids.map(dfs));
  };
  return dfs(root);
}

app.post('/bfhl', (req, res) => {
  const data = Array.isArray(req.body?.data) ? req.body.data : [];

  const invalid_entries = [];
  const duplicate_edges = [];
  const seenEdges = new Set();
  const validEdges = [];

  for (const raw of data) {
    const result = classify(raw);
    if (!result.valid) {
      invalid_entries.push(result.entry);
      continue;
    }
    const key = result.entry;
    if (seenEdges.has(key)) {
      if (!duplicate_edges.includes(key)) duplicate_edges.push(key);
      continue;
    }
    seenEdges.add(key);
    validEdges.push({ parent: result.parent, child: result.child });
  }

  const { children, parents, nodes } = buildGraph(validEdges);
  const components = findConnectedComponents(nodes, children);

  const hierarchies = [];

  for (const comp of components) {
    const compNodes = [...comp];
    const compChildren = {};
    for (const n of compNodes) {
      if (children[n]) compChildren[n] = children[n].filter(c => comp.has(c));
    }

    const cyclic = hasCycle(compNodes, compChildren);

    const roots = compNodes.filter(n => !parents[n] || !comp.has(parents[n]));
    let root;
    if (roots.length > 0) {
      root = roots.sort()[0];
    } else {
      root = compNodes.sort()[0];
    }

    if (cyclic) {
      hierarchies.push({ root, tree: {}, has_cycle: true });
    } else {
      const tree = buildTree(root, compChildren);
      const depth = treeDepth(root, compChildren);
      hierarchies.push({ root, tree, depth });
    }
  }

  hierarchies.sort((a, b) => {
    if (a.has_cycle && !b.has_cycle) return 1;
    if (!a.has_cycle && b.has_cycle) return -1;
    return a.root.localeCompare(b.root);
  });

  const nonCyclic = hierarchies.filter(h => !h.has_cycle);
  const cyclic = hierarchies.filter(h => h.has_cycle);

  let largest_tree_root = '';
  if (nonCyclic.length > 0) {
    const best = nonCyclic.reduce((acc, h) => {
      if (h.depth > acc.depth) return h;
      if (h.depth === acc.depth && h.root < acc.root) return h;
      return acc;
    });
    largest_tree_root = best.root;
  }

  res.json({
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: COLLEGE_ROLL_NUMBER,
    hierarchies,
    invalid_entries,
    duplicate_edges,
    summary: {
      total_trees: nonCyclic.length,
      total_cycles: cyclic.length,
      largest_tree_root,
    },
  });
});

app.get('/', (_, res) => res.send('BFHL API is running'));

const PORT = 4000;
app.listen(PORT);