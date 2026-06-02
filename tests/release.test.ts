import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("release readiness", () => {
  it("keeps publication gated while exposing package metadata", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      bugs?: { url?: string };
      files?: string[];
      homepage?: string;
      keywords?: string[];
      license: string;
      private?: boolean;
      publishConfig?: { access?: string };
      scripts: Record<string, string>;
      version: string;
    };

    expect(packageJson.private).toBeUndefined();
    expect(packageJson.version).toBe("0.1.0");
    expect(packageJson.license).toBe("MIT");
    expect(packageJson.publishConfig?.access).toBe("public");
    expect(packageJson.homepage).toBe("https://github.com/danielgwilson/mimetic-cli#readme");
    expect(packageJson.bugs?.url).toBe("https://github.com/danielgwilson/mimetic-cli/issues");
    expect(packageJson.keywords).toContain("persona-simulation");
    expect(packageJson.files).toEqual(["dist", "README.md", "LICENSE"]);
    expect(packageJson.scripts.prepack).toBe("pnpm build");
    expect(packageJson.scripts["public-surface:scan"]).toBe("node scripts/public-surface-scan.mjs");
    expect(packageJson.scripts["pack:dry-run"]).toBe("npm pack --dry-run");
    expect(packageJson.scripts["release:check"]).toBe("pnpm check && pnpm public-surface:scan && npm pack --dry-run");
  });

  it("documents release gates and human publish decisions", async () => {
    const readiness = await readFile("docs/release/open-source-readiness.md", "utf8");

    expect(readiness).toContain("public package candidate");
    expect(readiness).toContain("License: MIT");
    expect(readiness).toContain("Actual `npm publish` remains a human release");
    expect(readiness).toContain("GitHub Visibility Gate");
    expect(readiness).toContain("Do not make the existing repository public with full history");
    expect(readiness).toContain("skills/mimetic-cli/SKILL.md");
    expect(readiness).toContain("DISABLE_TELEMETRY=1 npx skills add . --list");
    expect(readiness).toContain("npm pack --dry-run");
    expect(readiness).toContain("No agent should run that command without explicit human approval");
    expect(readiness).toContain("`.mimetic/`");
    expect(readiness).toContain("`.npmrc`");
  });
});
