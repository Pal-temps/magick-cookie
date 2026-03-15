import { describe, test, expect } from "bun:test";

// ─── Types (mirrored from notesStore.ts) ───

interface NoteEntry {
  name: string;
  path: string;
  modified: number;
  size: number;
  type: "md" | "excalidraw";
}

interface TreeNode {
  name: string;
  path: string;
  folders: TreeNode[];
  files: NoteEntry[];
}

// ─── Pure logic extracted from notesStore for testing ───

function ensureFolder(root: TreeNode, folderPath: string): TreeNode {
  const parts = folderPath.split("/");
  let node = root;
  for (let i = 0; i < parts.length; i++) {
    const name = parts[i];
    const path = parts.slice(0, i + 1).join("/");
    let child = node.folders.find((f) => f.name === name);
    if (!child) {
      child = { name, path, folders: [], files: [] };
      node.folders.push(child);
    }
    node = child;
  }
  return node;
}

function buildTree(
  allFiles: NoteEntry[],
  folderPaths: string[],
): TreeNode {
  const root: TreeNode = { name: "Vault", path: "", folders: [], files: [] };

  // 1. Create all real folders from backend (including empty ones)
  for (const fp of folderPaths) {
    ensureFolder(root, fp);
  }

  // 2. Place files into their parent folders
  for (const file of allFiles) {
    const parts = file.path.split("/");
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join("/");
      const node = ensureFolder(root, parentPath);
      node.files.push(file);
    } else {
      root.files.push(file);
    }
  }

  // Sort folders alphabetically at each level
  function sortNode(n: TreeNode) {
    n.folders.sort((a, b) => a.name.localeCompare(b.name));
    n.folders.forEach(sortNode);
  }
  sortNode(root);

  return root;
}

function filteredFiles(allFiles: NoteEntry[], query: string): NoteEntry[] {
  const q = query.toLowerCase();
  if (!q) return [];
  return allFiles.filter(
    (n) => n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q),
  );
}

// ─── Helpers ───

function makeFile(
  name: string,
  path: string,
  modified = 0,
  type: "md" | "excalidraw" = "md",
): NoteEntry {
  return { name, path, modified, size: 100, type };
}

function makeRoot(): TreeNode {
  return { name: "Vault", path: "", folders: [], files: [] };
}

// ─── Tests ───

describe("ensureFolder", () => {
  test("creates a single-level folder", () => {
    const root = makeRoot();
    const node = ensureFolder(root, "projects");

    expect(root.folders).toHaveLength(1);
    expect(root.folders[0].name).toBe("projects");
    expect(root.folders[0].path).toBe("projects");
    expect(node).toBe(root.folders[0]);
  });

  test("creates multi-level folder path a/b/c", () => {
    const root = makeRoot();
    const leaf = ensureFolder(root, "a/b/c");

    expect(root.folders).toHaveLength(1);
    expect(root.folders[0].name).toBe("a");
    expect(root.folders[0].path).toBe("a");

    const b = root.folders[0].folders[0];
    expect(b.name).toBe("b");
    expect(b.path).toBe("a/b");

    const c = b.folders[0];
    expect(c.name).toBe("c");
    expect(c.path).toBe("a/b/c");
    expect(leaf).toBe(c);
  });

  test("reuses existing folders instead of creating duplicates", () => {
    const root = makeRoot();

    ensureFolder(root, "projects/web");
    ensureFolder(root, "projects/mobile");
    ensureFolder(root, "projects/web/frontend");

    // "projects" should exist only once
    expect(root.folders).toHaveLength(1);
    expect(root.folders[0].name).toBe("projects");

    // "projects" should have two children: web and mobile
    const projects = root.folders[0];
    expect(projects.folders).toHaveLength(2);

    const web = projects.folders.find((f) => f.name === "web")!;
    expect(web).toBeDefined();
    expect(web.folders).toHaveLength(1);
    expect(web.folders[0].name).toBe("frontend");

    const mobile = projects.folders.find((f) => f.name === "mobile")!;
    expect(mobile).toBeDefined();
    expect(mobile.folders).toHaveLength(0);
  });

  test("returns the deepest node", () => {
    const root = makeRoot();
    const deep = ensureFolder(root, "x/y/z");
    expect(deep.name).toBe("z");
    expect(deep.path).toBe("x/y/z");
  });
});

describe("buildTree", () => {
  test("empty vault returns root with no folders or files", () => {
    const tree = buildTree([], []);

    expect(tree.name).toBe("Vault");
    expect(tree.path).toBe("");
    expect(tree.folders).toHaveLength(0);
    expect(tree.files).toHaveLength(0);
  });

  test("files at root only", () => {
    const files = [
      makeFile("readme.md", "readme.md", 100),
      makeFile("todo.md", "todo.md", 200),
    ];
    const tree = buildTree(files, []);

    expect(tree.folders).toHaveLength(0);
    expect(tree.files).toHaveLength(2);
    expect(tree.files.map((f) => f.name)).toContain("readme.md");
    expect(tree.files.map((f) => f.name)).toContain("todo.md");
  });

  test("files in nested folders", () => {
    const files = [
      makeFile("index.md", "projects/web/index.md", 100),
      makeFile("notes.md", "projects/notes.md", 200),
    ];
    const tree = buildTree(files, []);

    // "projects" folder should be created automatically
    expect(tree.folders).toHaveLength(1);
    expect(tree.folders[0].name).toBe("projects");

    const projects = tree.folders[0];
    expect(projects.files).toHaveLength(1);
    expect(projects.files[0].name).toBe("notes.md");

    expect(projects.folders).toHaveLength(1);
    expect(projects.folders[0].name).toBe("web");
    expect(projects.folders[0].files).toHaveLength(1);
    expect(projects.folders[0].files[0].name).toBe("index.md");
  });

  test("empty folders are preserved from folderPaths", () => {
    const files = [makeFile("root.md", "root.md")];
    const folders = ["archive", "drafts/2024"];
    const tree = buildTree(files, folders);

    expect(tree.files).toHaveLength(1);
    // archive and drafts should exist as empty folders
    const archive = tree.folders.find((f) => f.name === "archive");
    expect(archive).toBeDefined();
    expect(archive!.files).toHaveLength(0);
    expect(archive!.folders).toHaveLength(0);

    const drafts = tree.folders.find((f) => f.name === "drafts");
    expect(drafts).toBeDefined();
    expect(drafts!.folders).toHaveLength(1);
    expect(drafts!.folders[0].name).toBe("2024");
    expect(drafts!.folders[0].files).toHaveLength(0);
  });

  test("mixed files and folders at multiple levels", () => {
    const files = [
      makeFile("root.md", "root.md", 300),
      makeFile("plan.md", "work/plan.md", 200),
      makeFile("sketch.excalidraw", "work/design/sketch.excalidraw", 100, "excalidraw"),
    ];
    const folders = ["personal", "work/design"];
    const tree = buildTree(files, folders);

    expect(tree.files).toHaveLength(1);
    expect(tree.files[0].name).toBe("root.md");

    // Both "personal" and "work" at root level
    expect(tree.folders).toHaveLength(2);

    const personal = tree.folders.find((f) => f.name === "personal")!;
    expect(personal).toBeDefined();
    expect(personal.files).toHaveLength(0);

    const work = tree.folders.find((f) => f.name === "work")!;
    expect(work).toBeDefined();
    expect(work.files).toHaveLength(1);
    expect(work.files[0].name).toBe("plan.md");

    const design = work.folders.find((f) => f.name === "design")!;
    expect(design).toBeDefined();
    expect(design.files).toHaveLength(1);
    expect(design.files[0].name).toBe("sketch.excalidraw");
  });

  test("folders are sorted alphabetically at each level", () => {
    const folders = ["zebra", "alpha", "middle"];
    const tree = buildTree([], folders);

    const names = tree.folders.map((f) => f.name);
    expect(names).toEqual(["alpha", "middle", "zebra"]);
  });

  test("nested folders are sorted alphabetically", () => {
    const folders = ["parent/charlie", "parent/alice", "parent/bob"];
    const tree = buildTree([], folders);

    expect(tree.folders).toHaveLength(1);
    const parent = tree.folders[0];
    const childNames = parent.folders.map((f) => f.name);
    expect(childNames).toEqual(["alice", "bob", "charlie"]);
  });

  test("files create implicit parent folders that merge with explicit ones", () => {
    const files = [makeFile("doc.md", "notes/doc.md")];
    const folders = ["notes"];
    const tree = buildTree(files, folders);

    // "notes" should exist only once, not duplicated
    expect(tree.folders).toHaveLength(1);
    expect(tree.folders[0].name).toBe("notes");
    expect(tree.folders[0].files).toHaveLength(1);
    expect(tree.folders[0].files[0].name).toBe("doc.md");
  });
});

describe("filteredFiles", () => {
  const files: NoteEntry[] = [
    makeFile("Meeting Notes.md", "work/Meeting Notes.md", 300),
    makeFile("shopping.md", "personal/shopping.md", 200),
    makeFile("README.md", "README.md", 100),
    makeFile("design.excalidraw", "projects/design.excalidraw", 50, "excalidraw"),
  ];

  test("empty query returns empty array", () => {
    expect(filteredFiles(files, "")).toEqual([]);
  });

  test("matches by file name", () => {
    const result = filteredFiles(files, "shopping");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("shopping.md");
  });

  test("matches by path", () => {
    const result = filteredFiles(files, "work/");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Meeting Notes.md");
  });

  test("case insensitive matching", () => {
    const result = filteredFiles(files, "readme");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("README.md");
  });

  test("case insensitive matching with uppercase query", () => {
    const result = filteredFiles(files, "SHOPPING");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("shopping.md");
  });

  test("matches multiple files", () => {
    const result = filteredFiles(files, ".md");
    expect(result).toHaveLength(3);
  });

  test("no matches returns empty array", () => {
    const result = filteredFiles(files, "nonexistent");
    expect(result).toEqual([]);
  });

  test("matches excalidraw files", () => {
    const result = filteredFiles(files, "design");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("excalidraw");
  });
});
