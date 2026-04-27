import { describe, it, expect } from "bun:test";
import {
  ALL_TRIPLES,
  CLIS,
  GH_VERSION,
  MANIFEST,
  loadManifest,
  manifestToSpecs,
  parseChecksum,
  targetBinaryName,
  tripleFor,
  type Triple,
} from "../fetch-cli-binaries";

describe("tripleFor", () => {
  const cases: Array<{ platform: NodeJS.Platform; arch: string; expected: Triple }> = [
    { platform: "win32",  arch: "x64",   expected: "x86_64-pc-windows-msvc" },
    { platform: "win32",  arch: "arm64", expected: "aarch64-pc-windows-msvc" },
    { platform: "darwin", arch: "x64",   expected: "x86_64-apple-darwin" },
    { platform: "darwin", arch: "arm64", expected: "aarch64-apple-darwin" },
    { platform: "linux",  arch: "x64",   expected: "x86_64-unknown-linux-gnu" },
    { platform: "linux",  arch: "arm64", expected: "aarch64-unknown-linux-gnu" },
  ];

  for (const { platform, arch, expected } of cases) {
    it(`maps ${platform}/${arch} → ${expected}`, () => {
      expect(tripleFor(platform, arch)).toBe(expected);
    });
  }

  it("throws on unsupported platform", () => {
    expect(() => tripleFor("freebsd" as NodeJS.Platform, "x64")).toThrow(/Unsupported/);
  });

  it("throws on unsupported arch", () => {
    expect(() => tripleFor("linux", "ia32")).toThrow(/Unsupported/);
  });

  it("covers every triple in ALL_TRIPLES", () => {
    const produced = new Set(cases.map((c) => c.expected));
    for (const t of ALL_TRIPLES) expect(produced.has(t)).toBe(true);
  });
});

describe("targetBinaryName", () => {
  it("appends .exe for Windows triples", () => {
    expect(targetBinaryName("gh", "x86_64-pc-windows-msvc")).toBe("gh-x86_64-pc-windows-msvc.exe");
    expect(targetBinaryName("gh", "aarch64-pc-windows-msvc")).toBe("gh-aarch64-pc-windows-msvc.exe");
  });

  it("does not append extension on macOS / Linux", () => {
    expect(targetBinaryName("gh", "x86_64-apple-darwin")).toBe("gh-x86_64-apple-darwin");
    expect(targetBinaryName("gh", "aarch64-apple-darwin")).toBe("gh-aarch64-apple-darwin");
    expect(targetBinaryName("gh", "x86_64-unknown-linux-gnu")).toBe("gh-x86_64-unknown-linux-gnu");
    expect(targetBinaryName("gh", "aarch64-unknown-linux-gnu")).toBe("gh-aarch64-unknown-linux-gnu");
  });

  it("uses the cli name as prefix", () => {
    expect(targetBinaryName("glab", "x86_64-pc-windows-msvc")).toBe("glab-x86_64-pc-windows-msvc.exe");
  });
});

describe("parseChecksum", () => {
  // Real-world checksum file format: "<sha256>  <filename>" (two spaces).
  const sampleTwoSpaces = [
    "abc123def456abc123def456abc123def456abc123def456abc123def456abcd  gh_2.66.1_linux_amd64.tar.gz",
    "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef  gh_2.66.1_windows_amd64.zip",
    "1111111111111111111111111111111111111111111111111111111111111111  gh_2.66.1_macOS_arm64.zip",
  ].join("\n");

  it("extracts the hash for a matching filename", () => {
    expect(parseChecksum(sampleTwoSpaces, "gh_2.66.1_windows_amd64.zip"))
      .toBe("deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
  });

  it("works with single-space separator (BSD-style)", () => {
    const single = "cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe gh_2.66.1_linux_arm64.tar.gz";
    expect(parseChecksum(single, "gh_2.66.1_linux_arm64.tar.gz"))
      .toBe("cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe");
  });

  it("returns null when no entry matches", () => {
    expect(parseChecksum(sampleTwoSpaces, "gh_9.9.9_unknown.zip")).toBeNull();
  });

  it("does not match a partial filename suffix", () => {
    // "amd64.zip" should NOT match "gh_2.66.1_windows_amd64.zip".
    expect(parseChecksum(sampleTwoSpaces, "amd64.zip")).toBeNull();
  });

  it("ignores blank/whitespace lines", () => {
    const padded = `\n   \n${sampleTwoSpaces}\n\n`;
    expect(parseChecksum(padded, "gh_2.66.1_macOS_arm64.zip"))
      .toBe("1111111111111111111111111111111111111111111111111111111111111111");
  });
});

describe("gh CLI spec", () => {
  const gh = CLIS.find((c) => c.name === "gh");

  it("is registered", () => {
    expect(gh).toBeDefined();
    expect(gh!.version).toBe(GH_VERSION);
  });

  it("resolves a usable asset for every supported triple", () => {
    for (const triple of ALL_TRIPLES) {
      const r = gh!.resolve(triple);
      expect(r.url.startsWith(`https://github.com/cli/cli/releases/download/v${GH_VERSION}/`)).toBe(true);
      expect(r.url.endsWith(r.archiveBasename)).toBe(true);
      expect(r.checksumsUrl).toBe(
        `https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_checksums.txt`,
      );
      expect(r.archive === "zip" || r.archive === "tar.gz").toBe(true);
    }
  });

  it("uses a flat innerPath for Windows zips (gh quirk)", () => {
    expect(gh!.resolve("x86_64-pc-windows-msvc").innerPath).toBe("bin/gh.exe");
    expect(gh!.resolve("aarch64-pc-windows-msvc").innerPath).toBe("bin/gh.exe");
  });

  it("uses the wrapped innerPath (gh_VERSION_<plat>/bin/gh) for non-Windows archives", () => {
    expect(gh!.resolve("x86_64-apple-darwin").innerPath)
      .toBe(`gh_${GH_VERSION}_macOS_amd64/bin/gh`);
    expect(gh!.resolve("aarch64-apple-darwin").innerPath)
      .toBe(`gh_${GH_VERSION}_macOS_arm64/bin/gh`);
    expect(gh!.resolve("x86_64-unknown-linux-gnu").innerPath)
      .toBe(`gh_${GH_VERSION}_linux_amd64/bin/gh`);
    expect(gh!.resolve("aarch64-unknown-linux-gnu").innerPath)
      .toBe(`gh_${GH_VERSION}_linux_arm64/bin/gh`);
  });

  it("uses .tar.gz for Linux and .zip for Windows / macOS", () => {
    expect(gh!.resolve("x86_64-unknown-linux-gnu").archive).toBe("tar.gz");
    expect(gh!.resolve("aarch64-unknown-linux-gnu").archive).toBe("tar.gz");
    expect(gh!.resolve("x86_64-pc-windows-msvc").archive).toBe("zip");
    expect(gh!.resolve("x86_64-apple-darwin").archive).toBe("zip");
  });
});

describe("cli-manifest.json", () => {
  it("loads with the supported schema version", () => {
    expect(MANIFEST.$schema_version).toBe(1);
  });

  it("rejects an unsupported schema version", () => {
    // loadManifest only validates the schema field; no need for a real file.
    const tmp = `${process.env.TMPDIR ?? process.env.TEMP ?? "/tmp"}/mc-bad-manifest-${Date.now()}.json`;
    require("node:fs").writeFileSync(tmp, JSON.stringify({ $schema_version: 99, clis: {} }));
    try {
      expect(() => loadManifest(tmp)).toThrow(/schema_version/);
    } finally {
      require("node:fs").unlinkSync(tmp);
    }
  });

  it("registers gh with all 6 supported triples", () => {
    const gh = MANIFEST.clis.gh;
    expect(gh).toBeDefined();
    for (const triple of ALL_TRIPLES) {
      expect(gh!.assets[triple]).toBeDefined();
      expect(gh!.assets[triple]!.asset).toContain("{version}");
      expect(["zip", "tar.gz"]).toContain(gh!.assets[triple]!.archive);
    }
  });

  it("manifestToSpecs round-trips: every cli in MANIFEST yields a usable spec", () => {
    const specs = manifestToSpecs(MANIFEST);
    expect(specs.length).toBeGreaterThan(0);
    for (const spec of specs) {
      for (const triple of ALL_TRIPLES) {
        const r = spec.resolve(triple);
        expect(r.url).not.toContain("{version}");
        expect(r.archiveBasename).not.toContain("{version}");
        expect(r.innerPath).not.toContain("{version}");
        expect(r.checksumsUrl).not.toContain("{version}");
      }
    }
  });

  it("substitutes {version} consistently across url, asset, innerPath, checksums", () => {
    const gh = manifestToSpecs(MANIFEST).find((c) => c.name === "gh")!;
    const v = gh.version;
    const r = gh.resolve("x86_64-unknown-linux-gnu");
    expect(r.url).toContain(`v${v}`);
    expect(r.archiveBasename).toBe(`gh_${v}_linux_amd64.tar.gz`);
    expect(r.innerPath).toBe(`gh_${v}_linux_amd64/bin/gh`);
    expect(r.checksumsUrl).toBe(
      `https://github.com/cli/cli/releases/download/v${v}/gh_${v}_checksums.txt`,
    );
  });

  it("manifest version matches GH_VERSION export", () => {
    expect(MANIFEST.clis.gh!.version).toBe(GH_VERSION);
  });
});
