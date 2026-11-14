# R05.6 — Diagnostic VOX sous js-dos 8.5.4

Date : 2026-11-14. Note de travail. **Aucune bande vocale GOG n'est versionnée, diffusée ni hébergée.**

## Éléments observés

Le bundle de voix de l'utilisateur mesure **39,5 Mio sur disque**,
**44,8 Mio une fois extrait**, avec **12 banques VOX pour 32,1 Mio**
non compressés ; la plus grande banque fait **10 101 Kio**. Ces
valeurs sont très inférieures au plafond de 512 Mio accepté par notre
importateur. Un blocage durable ne peut donc pas être expliqué
uniquement par ce plafond de taille.

Le backend js-dos 8 emploie le code WebAssembly `zip_to_fs` du projet
`caiiiycuk/emulators`, qui alloue une copie complète de l'archive
compressée en mémoire WASM, puis extrait les entrées en fichiers
émulés. Cette chaîne implique plusieurs copies en mémoire, mais
aucune mesure de dépassement mémoire n'a été fournie.

Sources :
- https://github.com/caiiiycuk/emulators/blob/8.xx/src/libzip/libzip.ts
- https://github.com/caiiiycuk/emulators/blob/8.xx/native/libzip/jsdos-libzip.c
- https://github.com/caiiiycuk/js-dos/blob/8.xx/src/host/bundle-storage.ts

Le message « Extracting local game files… » appartient au code 6.22
historique ; le navigateur 8 possède ses propres phases. Un simple
libellé ne prouve pas le backend réellement utilisé. Depuis la
promotion locale, le **lecteur principal est `/` (8.5.4)** et la
régression 6.22 est sur `/v6-local.html`.

## Expérience contrôlée à deux archives

Après avoir mis à jour la branche, conserver exactement :
- `RELENT.EXE`, les archives HQR, les sauvegardes S001…S007 ;
- le backend js-dos 8.5.4 DOSBox Worker ;
- le pilote validé **W_SB16.DLL (16 bits stéréo)** ;
- le même `LBA.ISO`, sans nouveau CDDA.

Changer seulement **combien de banques VOX sont décompressées**.
Les profils `smallest` et `largest` choisissent automatiquement une
seule banque par taille de fichier non compressé. Les noms précis
sélectionnés apparaissent dans la sortie JSON.

~~~bash
cd ~/Documents/lba-custom-portfolio
VOX="/mnt/fast-ssd/Games/Heroic/tlba-classic/Speedrun/Windows/VOX"

# Une seule petite banque : contrôle minimal du chemin VOX
python3 scripts/runtime/prepare-jsdos8-bundle.py \
  --input output/r05-probes/r05-sb16-8.jsdos \
  --wave-driver W_SB16.DLL \
  --voices-dir "$VOX" --voice-profile smallest \
  --out output/r05-probes/r05-v8-vox-smallest.jsdos

# Une seule grande banque : isoler l'effet d'une entrée de ~10 Mio
python3 scripts/runtime/prepare-jsdos8-bundle.py \
  --input output/r05-probes/r05-sb16-8.jsdos \
  --wave-driver W_SB16.DLL \
  --voices-dir "$VOX" --voice-profile largest \
  --out output/r05-probes/r05-v8-vox-largest.jsdos
~~~

Importer **une archive à la fois** depuis
`http://127.0.0.1:8765/`, en cliquant sur « Stop emulator » et en
rechargeant la page entre les essais si nécessaire. L'archive sans
voix avec pilote 16 bits
`r05-v8-sb16-16bit.jsdos` est le témoin déjà validé.

Le lecteur indique maintenant les phases horodatées, un avertissement
après 30 secondes sans initialisation, et conserve un rapport accessible
par « Copy diagnostics » ou via
`JSON.stringify(window.r05V8DiagnosticReport(), null, 2)`.
Les avertissements ne prouvent pas un manque de mémoire.

| Résultat | Interprétation |
| --- | --- |
| Les deux mini-archives démarrent ; la complète reste bloquée | Effet cumulatif, budget mémoire/temps ou banque particulière dans les 10 restantes : à mesurer |
| La petite démarre ; la grande bloque | Coût ou corruption de l'entrée la plus volumineuse : vérifier spécifiquement son extraction |
| Les deux mini-archives bloquent ; le témoin sans voix démarre | Problème de compatibilité du chemin VOX, de configuration ou de structure du bundle, non expliqué par le seul volume |
| Les trois archives démarrent ; pas de voix | La chaîne d'extraction est utilisable, mais la lecture des banques par LBA ou le dialogue déclenché reste à diagnostiquer |

**Ne pas confondre démarrage et restitution des voix :** une mini-archive
avec une seule banque ne contiendra normalement pas toutes les répliques.
On mesure d'abord l'extraction, ensuite l'audio parlé.

Conserver les archives GOG et tous les bundles dans `output/` ignoré
par Git. Ne pas fusionner avec `main` avant une validation utilisateur.
