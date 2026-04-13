# LBA1 Portfolio Mod — Dialogue Script

## Formatting Rules
- `@` = line break in LBA1 dialogue system
- Keep lines under ~40 characters between `@` markers
- Keep total string length under 250 chars where possible
- NPCs should sound like they live in this world — blend RPG tone with portfolio info

---

## Bank 7 — Main Dialogue (English entry 7, French entry 35)

### Asylum / Opening (IDs 0-8)
The player starts in the asylum and escapes. We repurpose this as a "welcome area."

| ID | Original Context | New Role |
|----|------------------|----------|
| 0 | Guard "off limits" | Welcome guide |
| 1 | "Halt!" | Greeting |
| 2 | "Stop squirming prisoner" | Encouragement |
| 3 | "Not one of my nurses" | Redirect |
| 4 | "Good day fellow nurse" | Friendly NPC |
| 5 | "Prisoner escaped alarm" | Excitement |
| 6 | Rule poster | Portfolio guide poster |
| 7 | FunFrock praise poster | Mission statement poster |
| 8 | Twinsen inner thought | Twinsen self-intro thought |

### Zoé / Home (IDs 9-12)
Personal introduction area.

| ID | Original | New Role |
|----|----------|----------|
| 9 | Generic greeting | Warm greeting |
| 10 | Zoé "welcome home" | Zoé personal intro |
| 11 | Zoé "worried" | Zoé portfolio overview |
| 12 | Twinsen explaining escape | Twinsen self-narration |

### Citadel Island NPCs (IDs 13-50+)
Various island residents become project showcasers.

| ID | Original | New Portfolio Role |
|----|----------|--------------------|
| 14 | Hint NPC (read posters) | Navigation helper |
| 15 | Bar NPC | CinePi showcase |
| 16 | Bar info (buy a drink) | CinePi detail |
| 47 | Town NPC | OpenClaw showcase |
| 48 | Town NPC | OpenClaw detail |
| 49 | Town NPC | GSAT showcase |
| 50 | Drink request | GSAT detail |
| 62 | Lupin-Burg sign | Portfolio district sign |
| 64 | Citadel Island sign | Portfolio Island sign |
| 66 | Legend question | Hitson Thrilla showcase |
| 78 | Bartender story | Hitson Thrilla detail |
| 80 | Generic greeting | Contact teaser |
| 102-109 | Generic greetings | Portfolio-themed greetings |
| 119 | Ferry ticket NPC | "Travel" to other portfolio sections |
| 130-135 | Ferry destinations | Portfolio section names |

### Ferry / Travel (IDs 119, 130-135)

| ID | Original | New |
|----|----------|-----|
| 119 | "Need a ticket" | Section travel intro |
| 130 | "Where do you want to go?" | Portfolio navigation |
| 131 | "To Principal Island" | "To the Electronics Lab" |
| 132 | "To White Leaf Desert" | "To the AI Workshop" |
| 133 | "To Proxima Island" | "To the Maker Space" |
| 134 | "To Rebellion Island" | "To the Gallery" |
| 135 | "I'm staying here!" | "I'll stay here for now." |

---

## Bank 9 — Extended Dialogue (English entry 9, French entry 37)

| ID | Original Context | New Portfolio Role |
|----|------------------|-------------------|
| 208 | Star Wars fan | Hitson Thrilla fan |
| 209 | Movie help | Creative arts helper |

---

## Bank 13 — Signs & Labels (English entry 13, French entry 41)

| ID | Original | New |
|----|----------|-----|
| 0 | Museum rates sign | Portfolio Museum sign |
| 1 | Proxim-City welcome | Electronics Lab welcome |
| 10 | Museum ticket seller | Portfolio guide NPC |
| 14 | Museum exhibit (ship propeller) | Portfolio exhibit |

---

## Actual Dialogue Text — English

### Bank 7

```
[0]  "Ah, a visitor! Welcome to this world. @ Feel free to explore and talk to everyone!"

[1]  "Hello there!"

[2]  "Don't be shy, have a look around! @ There's a lot to discover here."

[3]  "You should talk to Zoe first, @ she knows this place better than anyone."

[4]  "Welcome, friend. Enjoy your stay!"

[5]  "A new visitor! How exciting! @ I love showing people around."

[6]  "VISITOR'S GUIDE: @ Talk to the residents to discover @ projects and creations. @ Visit the Maritime Museum for @ a full overview!"

[7]  "Where engineering meets art. @ Electronics, AI, Space Technology, @ and Music — all under one roof."

[8]  "Hmmm... I should look around. @ There are people here who can tell @ me about some interesting projects."

[9]  "Good day!"

[10] "You're here! I've been expecting you. @ Come inside, I'll tell you about @ the person who built all of this."

[11] "Yassine is an engineer and a maker. @ He works on cameras, AI systems, @ satellites, and music. Each resident @ here knows about one of his projects!"

[12] "I've been traveling across this island @ collecting knowledge about different @ projects. Let me share what I've found."

[13] "I've been tinkering with some gadgets @ in the back. Electronics is fascinating @ once you get into it!"

[14] "Hey there! Did you know you can @ read the posters on the walls? @ Just walk up to one and interact!"

[15] "Have you heard of CinePi? It's @ a cinema camera built on a Raspberry @ Pi CM4 with a custom PCB. Captures @ RAW video at cinema quality!"

[16] "The CinePi project is open source! @ Yassine contributed to the development @ and built on top of it. The community @ keeps growing with time!"

[47] "I've been studying this remarkable @ invention called OpenClaw. It's an AI @ agent framework — autonomous agents @ that collaborate on complex tasks!"

[48] "OpenClaw handles code generation, @ research, and decision-making. Imagine @ a team of AI specialists working @ together. Quite something!"

[49] "Do you know about GSAT? It's a @ CubeSat guidance system for atmospheric @ re-entry. Uses a parafoil to steer @ back to a landing zone!"

[50] "The GSAT navigation algorithm runs @ Monte Carlo simulations. Space @ engineering meets embedded systems. @ Impressive stuff!"

[58] "Take it easy! There's no rush here. @ Why not switch to a calmer mode?"

[62] "Welcome to the Portfolio District @ (Citadel Island)."

[64] "Welcome to Portfolio Island"

[66] "Have you met Hitson Thrilla? @ He's an artist who lives on this island. @ Music runs through everything he does!"

[78] "I've heard Hitson Thrilla's work. @ The man puts his soul into every beat. @ You should check out his music!"

[80] "Good day! If you want to get in touch @ with Yassine, keep exploring. @ You'll find contact info eventually!"

[102] "Good day, explorer!"
[103] "Hello, welcome to the island!"
[104] "Good day!"
[105] "Nice to see a new face around here!"
[106] "Good day!"
[107] "Hey, enjoy your visit!"
[108] "Good day!"
[109] "Good day, friend!"

[119] "Want to visit another section? @ You can travel to different areas, @ each one showcasing a project!"

[123] "No need to be aggressive! @ I prefer a calm conversation."
[124] "Easy there! Let's talk properly."

[130] "Where would you like to go?"
[131] "To the Electronics Lab"
[132] "To the AI Workshop"
[133] "To the Maker Space"
[134] "To the Gallery"
[135] "I'll stay here for now."
```

### Bank 9

```
[208] "I'm a huge fan of Hitson Thrilla! @ His music is incredible. Yassine @ works closely with him on creative @ projects. Art meets technology!"

[209] "I'd love to help you discover more, @ but music and art is what I know best. @ Have a great visit!"
```

### Bank 13

```
[0]  "Portfolio Showroom, welcome! @ Admission: Free @ (Explore at your own pace)"

[1]  "Welcome to the Electronics Lab @ (Proxima Island)."

[10] "Welcome to the Portfolio Showroom! @ Would you like a tour of the projects?"
[11] "Yes, show me around!"
[12] "No thanks, I'll explore on my own."
```

---

## Actual Dialogue Text — French

### Bank 35 (= Bank 7 in French)

```
[0]  "Ah, un visiteur ! Bienvenue dans @ ce monde. N'hesitez pas a explorer @ et a parler a tout le monde !"

[1]  "Bonjour !"

[2]  "Ne soyez pas timide, regardez @ autour de vous ! Il y a beaucoup @ a decouvrir ici."

[3]  "Vous devriez d'abord parler a Zoe, @ elle connait cet endroit mieux @ que quiconque."

[4]  "Bienvenue, ami. Bon sejour !"

[5]  "Un nouveau visiteur ! Formidable ! @ J'adore faire visiter les lieux."

[6]  "GUIDE DU VISITEUR : @ Parlez aux habitants pour decouvrir @ les projets et creations. @ Visitez le Musee Maritime pour @ une vue d'ensemble !"

[7]  "La ou l'ingenierie rencontre l'art. @ Electronique, IA, technologie @ spatiale et musique — tout sous @ un meme toit."

[8]  "Hmmm... Je devrais jeter un oeil. @ Il y a des gens ici qui peuvent me @ parler de projets interessants."

[9]  "Bonjour !"

[10] "Tu es la ! Je t'attendais. @ Entre, je vais te parler de celui @ qui a construit tout cela."

[11] "Yassine est ingenieur et createur. @ Il travaille sur des cameras, des @ systemes d'IA, des satellites et de @ la musique. Chaque habitant @ connait un de ses projets !"

[12] "J'ai voyage a travers cette ile @ pour collecter des informations @ sur differents projets. Laisse-moi @ partager ce que j'ai trouve."

[14] "He ! Tu savais que tu peux lire @ les affiches sur les murs ? @ Il suffit de s'en approcher !"

[15] "Tu connais CinePi ? C'est une camera @ de cinema construite sur un Raspberry @ Pi CM4 avec un PCB sur mesure. @ Elle capture de la video RAW !"

[16] "Le projet CinePi est open source ! @ Yassine a contribue au developpement @ et a construit par-dessus. La @ communaute grandit avec le temps !"

[47] "J'etudie cette invention remarquable @ appelee OpenClaw. C'est un framework @ d'agents IA — des agents autonomes @ qui collaborent sur des taches !"

[48] "OpenClaw gere la generation de code, @ la recherche et la prise de decision. @ Imagine une equipe de specialistes @ IA qui travaillent ensemble !"

[49] "Tu connais GSAT ? C'est un systeme @ de guidage CubeSat pour la rentree @ atmospherique. Il utilise un parapente @ pour revenir vers une zone cible !"

[50] "L'algorithme de navigation GSAT @ effectue des simulations Monte Carlo. @ L'ingenierie spatiale rencontre les @ systemes embarques. Impressionnant !"

[62] "Bienvenue dans le quartier Portfolio @ (Ile de la Citadelle)."

[64] "Bienvenue sur l'Ile Portfolio"

[66] "Tu as rencontre Hitson Thrilla ? @ C'est un artiste qui vit sur cette @ ile. La musique coule dans tout @ ce qu'il fait !"

[78] "J'ai ecoute le travail de Hitson @ Thrilla. Il met son ame dans chaque @ beat. Tu devrais ecouter sa musique !"

[80] "Bonjour ! Si tu veux contacter @ Yassine, continue a explorer. @ Tu trouveras ses coordonnees !"

[102] "Bonjour, explorateur !"
[103] "Bonjour, bienvenue sur l'ile !"
[104] "Bonjour !"
[105] "Content de voir un nouveau visage !"
[106] "Bonjour !"
[107] "He, bonne visite !"
[108] "Bonjour !"
[109] "Bonjour, ami !"

[119] "Tu veux visiter une autre section ? @ Tu peux voyager vers differentes @ zones, chacune presentant un projet !"

[130] "Ou voulez-vous aller ?"
[131] "Au Labo d'Electronique"
[132] "A l'Atelier d'IA"
[133] "A l'Espace Maker"
[134] "A la Galerie"
[135] "Je reste ici pour le moment."
```

### Bank 37 (= Bank 9 in French)

```
[208] "Je suis un grand fan de Hitson @ Thrilla ! Sa musique est incroyable. @ Yassine travaille avec lui sur des @ projets creatifs. L'art rencontre @ la technologie !"

[209] "J'aimerais t'aider a decouvrir plus, @ mais la musique et l'art c'est ce que @ je connais le mieux. Bonne visite !"
```

### Bank 41 (= Bank 13 in French)

```
[0]  "Salle d'Exposition Portfolio ! @ Entree : Gratuite @ (Explorez a votre rythme)"

[1]  "Bienvenue au Labo d'Electronique @ (Ile Proxima)."

[10] "Bienvenue a la Salle d'Exposition ! @ Voulez-vous une visite guidee ?"
[11] "Oui, faites-moi visiter !"
[12] "Non merci, j'explore seul."
```

---

## Voice Recording Notes

Each text bank string ID maps to a VOX entry with the same index:
- Bank 7 strings → `FR_000.VOX` / `EN_000.VOX` entries
- Bank 9 strings → `FR_001.VOX` / `EN_001.VOX` entries
- Bank 13 strings → `FR_GAM.VOX` / `EN_GAM.VOX` entries (to verify)

Priority recording order:
1. IDs 0, 6, 7, 8 (first impressions)
2. IDs 10, 11, 12 (Zoé / personal intro)
3. IDs 15, 16 (CinePi)
4. IDs 47, 48 (OpenClaw)
5. IDs 49, 50 (GSAT)
6. IDs 66, 78 (Hitson Thrilla)
7. IDs 130-135 (navigation)
