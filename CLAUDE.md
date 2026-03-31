# Magick Cookie (Do-It-Now)

## Screenshot Tool

Tu as accès à un outil de capture d'écran pour voir l'application.

**Commande :**
```bash
tools/screenshot-cli/target/release/screenshot.exe --full -o /tmp/screen.png
```

**Puis lis l'image :**
```
Read /tmp/screen.png
```

Tu es multimodal — tu peux voir et analyser l'image directement.

Options :
- `--full` : capture plein écran sans GUI
- `-o <path>` : chemin de sortie
- `--max-width 1280` : resize pour optimiser les tokens (défaut)
- Sans `--full` : ouvre une fenêtre de sélection de zone (interactif, pour l'utilisateur)
