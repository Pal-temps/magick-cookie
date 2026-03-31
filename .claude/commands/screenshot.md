Capture a screenshot of the user's screen for visual analysis.

Steps:
1. Run this command via Bash: `tools/screenshot-cli/target/release/screenshot.exe --full -o /tmp/screen.png`
2. Read the image file at `/tmp/screen.png` using the Read tool
3. Describe what you see and ask the user what they'd like to analyze or discuss about the screenshot

If the screenshot tool is not built yet, build it first:
`cd tools/screenshot-cli && cargo build --release`
