# Spec Mobile — Vues Calendrier & Evenements (ref desktop)

## Vues calendrier

### Vue Mois
- Grille 7 colonnes (Lundi → Dimanche), 5-6 lignes
- Chaque cellule affiche max 3 events + compteur "+N de plus"
- Les events sont affiches comme des pills colores (couleur du calendrier)
- Jour courant surligne en accent violet
- Jours hors mois en opacite reduite

### Vue Semaine
- Header avec jours (lun-dim) + date
- Grille horaire 24h sur l'axe vertical
- Events positionnes selon heure de debut
- Scroll vertical sur les heures

### Vue Jour
- Header avec date complete
- Liste horaire 24h
- Events positionnes a leur heure

## Composants events

### EventCard
- Petit bandeau avec bordure gauche coloree (couleur calendrier)
- Affiche heure + titre
- Tap = ouvre le detail / formulaire d'edition

### EventForm
- Champs : titre, calendrier (select), debut/fin (datetime), lieu, description, toute la journee (toggle), rappel (minutes)
- Mode creation : permet de choisir le calendrier et le rappel
- Mode edition : modifie les champs existants

### EventDetail
- Affiche tous les champs de l'event
- Boutons : Modifier, Supprimer
- Couleur du calendrier en indicateur visuel

## Multi-calendriers
- Sidebar avec liste des calendriers (nom + pastille couleur)
- Toggle visibilite par calendrier (masque/affiche les events)
- Bouton "+ Nouvel evenement" en haut de la sidebar

## Particularites UX mobile

- Vue mois par defaut au lancement
- Navigation entre vues via tabs en haut (Mois / Semaine / Jour)
- Navigation temporelle par swipe horizontal
- EventForm en plein ecran (pas de modal)
- EventDetail en bottom sheet
- FAB (Floating Action Button) pour creer un event rapidement
- Sidebar = drawer lateral
- Mini-calendrier = pas necessaire sur mobile (ecran trop petit)
- Support des gestes : swipe horizontal entre jours/semaines/mois
