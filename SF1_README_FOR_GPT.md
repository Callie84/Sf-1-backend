# SF-1 – SeedFinder PRO (GPT-kompatibles Übergabepaket)

## 📌 Projektüberblick
SeedFinder PRO (SF-1) ist eine modulare Web-App zur Suche, Analyse und zum Preisvergleich von Cannabis-Samen.
Das Ziel ist es, Growern eine zentrale Plattform zu bieten, um Sorten zu vergleichen, Growpläne zu erstellen und mit Affiliate-Links Einnahmen zu generieren.

---

## 📂 Ordnerstruktur

- `/frontend/`: Benutzeroberfläche, klickbares HTML mit Navigation, Sidebar, responsivem Layout
- `/modules/`: Alle Funktionsmodule (Preisvergleich, Growplan, Favoriten, Werbung etc.)
- `/assets/`: Bilder, Banner, Logos, Affiliate-Grafiken
- `/zip_batches/`: Fertige Teilsysteme in ZIPs (zur modularen Entpackung in `SF1/`)
- `/docs/`: Impressum, Datenschutz, AGB, Rechtstexte
- `/seed_data/`: JSON-Schemas, Sortenstruktur, Seedbank-Datenmodell
- `/gpt_bridge/`: GPT-kompatible Übergabedateien & Anweisungen

---

## 🧠 GPT-kompatible Arbeitsweise

Jeder GPT kann dieses Projekt weiterentwickeln, indem er:

### 🔨 Aufgaben direkt umsetzt, z. B.:

1. **Navigation erweitern:**
   - Datei: `frontend/navigation.html`
   - Aktion: Menüpunkt `Growplan` hinzufügen → verlinke auf `/modules/growplanner/index.html`

2. **Seedbank-Filterlogik erstellen:**
   - Datei: `modules/pricecompare/`
   - Nutze `seed_data/schema.json` als Vorlage für ein Filtersystem (z. B. nach Preis, Genetik, Blütezeit)

3. **PDF-Downloadfunktion einbauen:**
   - Ziel: Alle PDFs im Ordner `docs/` sollen als Downloadlink im Frontend erscheinen
   - Datei: `frontend/index.html`

4. **Favoriten-System erweitern:**
   - Speicherung lokal (z. B. `localStorage`) oder vorbereitetes Backend-Modul integrieren
   - Datei: `modules/favorites/` (anlegen)

5. **Growplan-Generator verbinden:**
   - Benutzer wählt Setup → automatisch wird ein .xlsx oder PDF generiert
   - Ausgabe-Dateien nach `modules/growplanner/exports/`

---

## ✅ Was bereits fertig ist

- Vollständiges klickbares Frontend (Sidebar, Layout)
- Modulstruktur + ZIP-System
- Beispielmodule & Platzhalter mit Inhalt
- Seed-Datenmodell
- Impressum, DSGVO, AGB mit realen Daten
- Affiliate-Werbebanner-Logik
- Integration von UGG-1 als PDF-Grow-Guide

---

## 🔄 Was noch offen ist

- Sorten-Filterlogik im Preisvergleich
- Vollständige Seedbank-Daten
- Backend-Funktionen (Login, Favoriten speichern)
- Scraper zur Preisaktualisierung
- Finales Gesamt-ZIP aller Module

---

## 🧾 Prompt für GPTs

Wenn du ein GPT-Modell bist, arbeite anhand dieser Liste:

> „Bitte öffne `gpt_bridge/SF1_README_FOR_GPT.md`, analysiere die Aufgaben und beginne mit der Priorität 1: Sortenvergleich + Filterlogik in `modules/pricecompare/`. Nutze dazu das Schema in `seed_data/schema.json`. Speichere die Änderungen als neue ZIP im Ordner `zip_batches/`.“

Viel Erfolg bei der Weiterentwicklung!
