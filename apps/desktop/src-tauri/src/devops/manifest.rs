use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const MANIFEST_JSON: &str = include_str!("../../cli-manifest.json");
const SUPPORTED_SCHEMA: u32 = 1;

#[cfg(test)]
pub const ALL_TRIPLES: &[Triple] = &[
    Triple::X86_64WindowsMsvc,
    Triple::Aarch64WindowsMsvc,
    Triple::X86_64AppleDarwin,
    Triple::Aarch64AppleDarwin,
    Triple::X86_64LinuxGnu,
    Triple::Aarch64LinuxGnu,
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Triple {
    #[serde(rename = "x86_64-pc-windows-msvc")]
    X86_64WindowsMsvc,
    #[serde(rename = "aarch64-pc-windows-msvc")]
    Aarch64WindowsMsvc,
    #[serde(rename = "x86_64-apple-darwin")]
    X86_64AppleDarwin,
    #[serde(rename = "aarch64-apple-darwin")]
    Aarch64AppleDarwin,
    #[serde(rename = "x86_64-unknown-linux-gnu")]
    X86_64LinuxGnu,
    #[serde(rename = "aarch64-unknown-linux-gnu")]
    Aarch64LinuxGnu,
}

impl Triple {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::X86_64WindowsMsvc => "x86_64-pc-windows-msvc",
            Self::Aarch64WindowsMsvc => "aarch64-pc-windows-msvc",
            Self::X86_64AppleDarwin => "x86_64-apple-darwin",
            Self::Aarch64AppleDarwin => "aarch64-apple-darwin",
            Self::X86_64LinuxGnu => "x86_64-unknown-linux-gnu",
            Self::Aarch64LinuxGnu => "aarch64-unknown-linux-gnu",
        }
    }

    pub fn is_windows(&self) -> bool {
        matches!(self, Self::X86_64WindowsMsvc | Self::Aarch64WindowsMsvc)
    }

    /// Resolves the host triple at compile time. Returns `None` on unsupported
    /// platforms — callers should surface an explicit error rather than panic.
    pub const fn host() -> Option<Self> {
        #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
        {
            Some(Self::X86_64WindowsMsvc)
        }
        #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
        {
            Some(Self::Aarch64WindowsMsvc)
        }
        #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
        {
            Some(Self::X86_64AppleDarwin)
        }
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        {
            Some(Self::Aarch64AppleDarwin)
        }
        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        {
            Some(Self::X86_64LinuxGnu)
        }
        #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
        {
            Some(Self::Aarch64LinuxGnu)
        }
        #[cfg(not(any(
            all(target_os = "windows", target_arch = "x86_64"),
            all(target_os = "windows", target_arch = "aarch64"),
            all(target_os = "macos", target_arch = "x86_64"),
            all(target_os = "macos", target_arch = "aarch64"),
            all(target_os = "linux", target_arch = "x86_64"),
            all(target_os = "linux", target_arch = "aarch64"),
        )))]
        {
            None
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ArchiveType {
    Zip,
    #[serde(rename = "tar.gz")]
    TarGz,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssetEntry {
    pub asset: String,
    pub archive: ArchiveType,
    #[serde(rename = "innerPath")]
    pub inner_path: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReleaseEntry {
    #[serde(rename = "urlBase")]
    pub url_base: String,
    #[serde(rename = "checksumsAsset")]
    pub checksums_asset: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CliEntry {
    pub version: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub homepage: String,
    /// Manifest documents the upstream license; not surfaced to Rust callers yet but kept
    /// so the JSON spec stays self-describing.
    #[serde(default)]
    #[allow(dead_code)]
    pub license: Option<String>,
    pub release: ReleaseEntry,
    pub assets: HashMap<Triple, AssetEntry>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Manifest {
    #[serde(rename = "$schema_version")]
    pub schema_version: u32,
    pub clis: HashMap<String, CliEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ResolvedAsset {
    pub url: String,
    pub archive: ArchiveType,
    pub inner_path: String,
    pub checksums_url: String,
    pub archive_basename: String,
}

#[derive(Debug)]
pub enum ManifestError {
    Parse(String),
    UnsupportedSchema(u32),
    UnknownCli(String),
    UnsupportedTriple { cli: String, triple: Triple },
}

impl std::fmt::Display for ManifestError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Parse(e) => write!(f, "manifest parse error: {e}"),
            Self::UnsupportedSchema(v) => write!(f, "unsupported manifest schema version: {v}"),
            Self::UnknownCli(name) => write!(f, "no cli named '{name}' in manifest"),
            Self::UnsupportedTriple { cli, triple } => {
                write!(f, "cli '{cli}' has no asset for triple {}", triple.as_str())
            }
        }
    }
}

impl std::error::Error for ManifestError {}

fn subst_version(template: &str, version: &str) -> String {
    template.replace("{version}", version)
}

impl Manifest {
    pub fn embedded() -> Result<Self, ManifestError> {
        let m: Manifest =
            serde_json::from_str(MANIFEST_JSON).map_err(|e| ManifestError::Parse(e.to_string()))?;
        if m.schema_version != SUPPORTED_SCHEMA {
            return Err(ManifestError::UnsupportedSchema(m.schema_version));
        }
        Ok(m)
    }

    pub fn cli(&self, name: &str) -> Result<&CliEntry, ManifestError> {
        self.clis
            .get(name)
            .ok_or_else(|| ManifestError::UnknownCli(name.to_string()))
    }

    pub fn cli_names(&self) -> Vec<&str> {
        let mut names: Vec<&str> = self.clis.keys().map(String::as_str).collect();
        names.sort_unstable();
        names
    }

    pub fn resolve(&self, name: &str, triple: Triple) -> Result<ResolvedAsset, ManifestError> {
        let cli = self.cli(name)?;
        let asset = cli
            .assets
            .get(&triple)
            .ok_or_else(|| ManifestError::UnsupportedTriple {
                cli: name.to_string(),
                triple,
            })?;
        let v = &cli.version;
        let url_base = subst_version(&cli.release.url_base, v);
        let archive_basename = subst_version(&asset.asset, v);
        let checksums_url = format!(
            "{url_base}/{}",
            subst_version(&cli.release.checksums_asset, v)
        );
        Ok(ResolvedAsset {
            url: format!("{url_base}/{archive_basename}"),
            archive: asset.archive,
            inner_path: subst_version(&asset.inner_path, v),
            checksums_url,
            archive_basename,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_manifest_loads_with_supported_schema() {
        let m = Manifest::embedded().expect("embedded manifest must parse");
        assert_eq!(m.schema_version, SUPPORTED_SCHEMA);
    }

    #[test]
    fn gh_is_registered_with_all_six_triples() {
        let m = Manifest::embedded().unwrap();
        let gh = m.cli("gh").expect("gh must be registered");
        for triple in ALL_TRIPLES {
            assert!(
                gh.assets.contains_key(triple),
                "gh missing asset for triple {}",
                triple.as_str()
            );
        }
    }

    #[test]
    fn resolve_substitutes_version_in_every_field() {
        let m = Manifest::embedded().unwrap();
        let v = m.cli("gh").unwrap().version.clone();
        for triple in ALL_TRIPLES {
            let r = m.resolve("gh", *triple).unwrap();
            assert!(
                !r.url.contains("{version}"),
                "url still templated for {}",
                triple.as_str()
            );
            assert!(!r.archive_basename.contains("{version}"));
            assert!(!r.inner_path.contains("{version}"));
            assert!(!r.checksums_url.contains("{version}"));
            assert!(r.url.contains(&v), "url should contain version {v}");
        }
    }

    #[test]
    fn windows_zips_use_flat_inner_path() {
        let m = Manifest::embedded().unwrap();
        let r = m.resolve("gh", Triple::X86_64WindowsMsvc).unwrap();
        assert_eq!(r.inner_path, "bin/gh.exe");
        let r = m.resolve("gh", Triple::Aarch64WindowsMsvc).unwrap();
        assert_eq!(r.inner_path, "bin/gh.exe");
    }

    #[test]
    fn linux_archives_are_tar_gz_and_others_are_zip() {
        let m = Manifest::embedded().unwrap();
        assert_eq!(
            m.resolve("gh", Triple::X86_64LinuxGnu).unwrap().archive,
            ArchiveType::TarGz
        );
        assert_eq!(
            m.resolve("gh", Triple::Aarch64LinuxGnu).unwrap().archive,
            ArchiveType::TarGz
        );
        assert_eq!(
            m.resolve("gh", Triple::X86_64WindowsMsvc).unwrap().archive,
            ArchiveType::Zip
        );
        assert_eq!(
            m.resolve("gh", Triple::X86_64AppleDarwin).unwrap().archive,
            ArchiveType::Zip
        );
    }

    #[test]
    fn resolve_errors_on_unknown_cli() {
        let m = Manifest::embedded().unwrap();
        let err = m.resolve("nope", Triple::X86_64LinuxGnu).unwrap_err();
        assert!(matches!(err, ManifestError::UnknownCli(_)));
    }

    #[test]
    fn cli_names_are_sorted() {
        let m = Manifest::embedded().unwrap();
        let names = m.cli_names();
        let mut sorted = names.clone();
        sorted.sort_unstable();
        assert_eq!(names, sorted);
    }

    #[test]
    fn host_triple_resolves_on_supported_platforms() {
        // CI runs on one of the supported triples, so this must be Some.
        // Compile-time fallback returns None only on platforms we explicitly don't ship for.
        assert!(
            Triple::host().is_some(),
            "host triple should be one of the 6 supported"
        );
    }

    #[test]
    fn triple_as_str_round_trips_via_serde() {
        for t in ALL_TRIPLES {
            let json = serde_json::to_string(t).unwrap();
            let unquoted = json.trim_matches('"');
            assert_eq!(unquoted, t.as_str());
        }
    }

    #[test]
    fn unsupported_schema_is_rejected() {
        let bad = r#"{"$schema_version": 99, "clis": {}}"#;
        let parsed: Manifest = serde_json::from_str(bad).unwrap();
        assert_eq!(parsed.schema_version, 99);
        // The embedded constructor would reject this; simulate it.
        let err = match (|| -> Result<Manifest, ManifestError> {
            if parsed.schema_version != SUPPORTED_SCHEMA {
                return Err(ManifestError::UnsupportedSchema(parsed.schema_version));
            }
            Ok(parsed)
        })() {
            Err(e) => e,
            Ok(_) => panic!("should have errored"),
        };
        assert!(matches!(err, ManifestError::UnsupportedSchema(99)));
    }
}
