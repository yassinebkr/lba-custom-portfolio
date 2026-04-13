/**
 * Apply Portfolio Dialogue to dialogue_strings.json
 * 
 * This script replaces specific dialogue strings with portfolio-themed content.
 * It modifies the "modified" field while keeping "original" intact for reference.
 * 
 * Usage:
 *   node apply-portfolio-dialogue.js          Apply changes
 *   node apply-portfolio-dialogue.js --dry    Dry run (show changes without writing)
 */

const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '../../modded_assets/text/dialogue_strings.json');

// ============================================================
// ENGLISH DIALOGUE — Bank 7 (entry index 7)
// ============================================================
const ENGLISH_BANK_7 = {
    // --- Asylum / Welcome Area ---
    0:  'Ah, a visitor! Welcome to this world. @ Feel free to explore and talk @ to everyone!',
    1:  'Hello there!',
    2:  "Don't be shy, have a look around! @ There's a lot to discover here.",
    3:  'You should talk to Zoe first, @ she knows this place better @ than anyone.',
    4:  'Welcome, friend. Enjoy your stay!',
    5:  'A new visitor! How exciting! @ I love showing people around.',
    6:  "VISITOR'S GUIDE: @ Talk to the residents to discover @ projects and creations. @ Visit the Maritime Museum for @ a full overview!",
    7:  'Where engineering meets art. @ Electronics, AI, Space Technology, @ and Music - all under one roof.',
    8:  'Hmmm... I should look around. @ There are people here who can tell @ me about some interesting projects.',

    // --- Zoe / Home / Personal Intro ---
    9:  'Good day!',
    10: "You're here! I've been expecting @ you. Come inside, I'll tell you @ about the person who built @ all of this.",
    11: 'Yassine is an engineer and a maker. @ He works on cameras, AI systems, @ satellites, and music. Each resident @ here knows about one of his projects!',
    12: "I've been traveling across this @ island collecting knowledge about @ different projects. Let me share @ what I've found.",

    // --- Citadel Island NPCs ---
    13: "I've been tinkering with some @ gadgets in the back. Electronics @ is fascinating once you get into it!",
    14: 'Hey there! Did you know you can @ read the posters on the walls? @ Just walk up to one and interact!',

    // --- CinePi NPC ---
    15: 'Have you heard of CinePi? It is @ a cinema camera built on a Raspberry @ Pi CM4 with a custom PCB. Captures @ RAW video at cinema quality!',
    16: 'The CinePi project is open source! @ Yassine contributed to the @ development and built on top of it. @ The community keeps growing!',

    // --- OpenClaw NPC ---
    47: "I've been studying this remarkable @ invention called OpenClaw. It is @ an AI agent framework - autonomous @ agents that collaborate on tasks!",
    48: 'OpenClaw handles code generation, @ research, and decision-making. @ Imagine a team of AI specialists @ working together. Quite something!',

    // --- GSAT NPC ---
    49: 'Do you know about GSAT? It is a @ CubeSat guidance system for @ atmospheric re-entry. Uses a parafoil @ to steer back to a landing zone!',
    50: 'The GSAT navigation algorithm runs @ Monte Carlo simulations. Space @ engineering meets embedded systems. @ Impressive stuff!',

    // --- Behavior mode reminder ---
    58: "Take it easy! There is no rush @ here. Why not switch to a calmer @ mode?",

    // --- Signs ---
    62: '"Welcome to the Portfolio District @ (Citadel Island)."',
    64: '"Welcome to Portfolio Island"',

    // --- Hitson Thrilla NPC ---
    66: 'Have you met Hitson Thrilla? @ He is an artist who lives on this @ island. Music runs through @ everything he does!',
    78: "I've heard Hitson Thrilla's work. @ The man puts his soul into every @ beat. You should check out his music!",

    // --- Contact teaser ---
    80: 'Good day! If you want to get in @ touch with Yassine, keep exploring. @ You will find contact info @ eventually!',

    // --- Generic greetings (island NPCs) ---
    102: 'Good day, explorer!',
    103: 'Hello, welcome to the island!',
    104: 'Good day!',
    105: 'Nice to see a new face around here!',
    106: 'Good day!',
    107: 'Hey, enjoy your visit!',
    108: 'Good day!',
    109: 'Good day, friend!',

    // --- Ferry / Navigation ---
    119: 'Want to visit another section? @ You can travel to different areas, @ each one showcasing a project!',
    123: 'No need to be aggressive! @ I prefer a calm conversation.',
    124: "Easy there! Let's talk properly.",
    130: 'Where would you like to go?',
    131: 'To the Electronics Lab',
    132: 'To the AI Workshop',
    133: 'To the Maker Space',
    134: 'To the Gallery',
    135: "I'll stay here for now.",
};

// ============================================================
// ENGLISH DIALOGUE — Bank 9 (entry index 9)
// ============================================================
const ENGLISH_BANK_9 = {
    208: "I'm a huge fan of Hitson Thrilla! @ His music is incredible. Yassine @ works closely with him on creative @ projects. Art meets technology!",
    209: "I'd love to help you discover more, @ but music and art is what I know @ best. Have a great visit!",
};

// ============================================================
// ENGLISH DIALOGUE — Bank 13 (entry index 13)
// ============================================================
const ENGLISH_BANK_13 = {
    0:  '"Portfolio Showroom, welcome! @ Admission: Free @ (Explore at your own pace)"',
    1:  '"Welcome to the Electronics Lab @ (Proxima Island)."',
    10: 'Welcome to the Portfolio Showroom! @ Would you like a tour of @ the projects?',
    11: 'Yes, show me around!',
    12: "No thanks, I'll explore on my own.",
};

// ============================================================
// FRENCH DIALOGUE — Bank 35 (= Bank 7 in French)
// ============================================================
const FRENCH_BANK_35 = {
    0:  'Ah, un visiteur ! Bienvenue dans @ ce monde. N\'hesitez pas a explorer @ et a parler a tout le monde !',
    1:  'Bonjour !',
    2:  'Ne soyez pas timide, regardez @ autour de vous ! Il y a beaucoup @ a decouvrir ici.',
    3:  'Vous devriez d\'abord parler a Zoe, @ elle connait cet endroit mieux @ que quiconque.',
    4:  'Bienvenue, ami. Bon sejour !',
    5:  'Un nouveau visiteur ! Formidable ! @ J\'adore faire visiter les lieux.',
    6:  'GUIDE DU VISITEUR : @ Parlez aux habitants pour decouvrir @ les projets et creations. @ Visitez le Musee Maritime pour @ une vue d\'ensemble !',
    7:  'La ou l\'ingenierie rencontre l\'art. @ Electronique, IA, technologie @ spatiale et musique - tout sous @ un meme toit.',
    8:  'Hmmm... Je devrais jeter un oeil. @ Il y a des gens ici qui peuvent me @ parler de projets interessants.',
    9:  'Bonjour !',
    10: 'Tu es la ! Je t\'attendais. @ Entre, je vais te parler de celui @ qui a construit tout cela.',
    11: 'Yassine est ingenieur et createur. @ Il travaille sur des cameras, des @ systemes d\'IA, des satellites et @ de la musique. Chaque habitant @ connait un de ses projets !',
    12: 'J\'ai voyage a travers cette ile @ pour collecter des informations @ sur differents projets. Laisse-moi @ partager ce que j\'ai trouve.',
    13: 'J\'ai bricole quelques gadgets @ dans l\'arriere-boutique. @ L\'electronique, c\'est fascinant @ quand on s\'y met !',
    14: 'He ! Tu savais que tu peux lire @ les affiches sur les murs ? @ Il suffit de s\'en approcher !',
    15: 'Tu connais CinePi ? C\'est une camera @ de cinema construite sur un Raspberry @ Pi CM4 avec un PCB sur mesure. @ Capture de la video RAW !',
    16: 'Le projet CinePi est open source ! @ Yassine a contribue au developpement @ et a construit par-dessus. La @ communaute grandit avec le temps !',
    47: 'J\'etudie cette invention remarquable @ appelee OpenClaw. C\'est un framework @ d\'agents IA - des agents autonomes @ qui collaborent sur des taches !',
    48: 'OpenClaw gere la generation de code, @ la recherche et la prise de decision. @ Imagine une equipe de specialistes @ IA travaillant ensemble !',
    49: 'Tu connais GSAT ? C\'est un systeme @ de guidage CubeSat pour la rentree @ atmospherique. Il utilise un parapente @ pour rejoindre une zone cible !',
    50: 'L\'algorithme de navigation GSAT @ effectue des simulations Monte Carlo. @ L\'ingenierie spatiale rencontre @ les systemes embarques !',
    58: 'Du calme ! Il n\'y a pas de @ precipitation ici. Pourquoi ne pas @ passer en mode plus calme ?',
    62: '"Bienvenue dans le quartier Portfolio @ (Ile de la Citadelle)."',
    64: '"Bienvenue sur l\'Ile Portfolio"',
    66: 'Tu as rencontre Hitson Thrilla ? @ C\'est un artiste qui vit sur cette @ ile. La musique coule dans tout @ ce qu\'il fait !',
    78: 'J\'ai ecoute le travail de Hitson @ Thrilla. Il met son ame dans chaque @ beat. Tu devrais ecouter sa musique !',
    80: 'Bonjour ! Si tu veux contacter @ Yassine, continue a explorer. @ Tu trouveras ses coordonnees !',
    102: 'Bonjour, explorateur !',
    103: 'Bonjour, bienvenue sur l\'ile !',
    104: 'Bonjour !',
    105: 'Content de voir un nouveau visage !',
    106: 'Bonjour !',
    107: 'He, bonne visite !',
    108: 'Bonjour !',
    109: 'Bonjour, ami !',
    119: 'Tu veux visiter une autre section ? @ Tu peux voyager vers differentes @ zones, chacune presentant un projet !',
    123: 'Pas besoin d\'etre agressif ! @ Je prefere une conversation calme.',
    124: 'Doucement ! Parlons correctement.',
    130: 'Ou voulez-vous aller ?',
    131: 'Au Labo d\'Electronique',
    132: 'A l\'Atelier d\'IA',
    133: 'A l\'Espace Maker',
    134: 'A la Galerie',
    135: 'Je reste ici pour le moment.',
};

// ============================================================
// FRENCH DIALOGUE — Bank 37 (= Bank 9 in French)
// ============================================================
const FRENCH_BANK_37 = {
    208: 'Je suis un grand fan de Hitson @ Thrilla ! Sa musique est incroyable. @ Yassine travaille avec lui sur des @ projets creatifs. L\'art rencontre @ la technologie !',
    209: 'J\'aimerais t\'aider a decouvrir plus, @ mais la musique et l\'art c\'est ce que @ je connais le mieux. Bonne visite !',
};

// ============================================================
// FRENCH DIALOGUE — Bank 41 (= Bank 13 in French)
// ============================================================
const FRENCH_BANK_41 = {
    0:  '"Salle d\'Exposition Portfolio ! @ Entree : Gratuite @ (Explorez a votre rythme)"',
    1:  '"Bienvenue au Labo d\'Electronique @ (Ile Proxima)."',
    10: 'Bienvenue a la Salle d\'Exposition ! @ Voulez-vous une visite guidee @ des projets ?',
    11: 'Oui, faites-moi visiter !',
    12: 'Non merci, j\'explore seul.',
};

// ============================================================
// Apply changes
// ============================================================

function applyChanges(data, bankIndex, changes, langName) {
    const bank = data.languages[langName]?.banks[String(bankIndex)];
    if (!bank) {
        console.log(`  WARNING: Bank ${bankIndex} not found for ${langName}`);
        return 0;
    }

    let count = 0;
    for (const [idStr, newText] of Object.entries(changes)) {
        const id = parseInt(idStr);
        const strEntry = bank.strings.find(s => s.id === id);
        if (!strEntry) {
            console.log(`  WARNING: String ID ${id} not found in bank ${bankIndex} (${langName})`);
            continue;
        }

        if (strEntry.modified !== newText) {
            strEntry.modified = newText;
            count++;
        }
    }
    return count;
}

function main() {
    const dryRun = process.argv.includes('--dry');

    if (!fs.existsSync(JSON_PATH)) {
        console.error('ERROR: dialogue_strings.json not found.');
        console.error('Run "node edit-text.js extract" first.');
        process.exit(1);
    }

    console.log('Loading dialogue_strings.json...');
    const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

    console.log('\nApplying portfolio dialogue changes...\n');

    let total = 0;

    // English
    console.log('=== ENGLISH ===');
    total += applyChanges(data, 7, ENGLISH_BANK_7, 'english');
    console.log(`  Bank 7 (dialogue_main): ${Object.keys(ENGLISH_BANK_7).length} strings`);
    total += applyChanges(data, 9, ENGLISH_BANK_9, 'english');
    console.log(`  Bank 9 (dialogue_extended): ${Object.keys(ENGLISH_BANK_9).length} strings`);
    total += applyChanges(data, 13, ENGLISH_BANK_13, 'english');
    console.log(`  Bank 13 (signs_labels): ${Object.keys(ENGLISH_BANK_13).length} strings`);

    // French
    console.log('\n=== FRENCH ===');
    total += applyChanges(data, 35, FRENCH_BANK_35, 'french');
    console.log(`  Bank 35 (dialogue_main): ${Object.keys(FRENCH_BANK_35).length} strings`);
    total += applyChanges(data, 37, FRENCH_BANK_37, 'french');
    console.log(`  Bank 37 (dialogue_extended): ${Object.keys(FRENCH_BANK_37).length} strings`);
    total += applyChanges(data, 41, FRENCH_BANK_41, 'french');
    console.log(`  Bank 41 (signs_labels): ${Object.keys(FRENCH_BANK_41).length} strings`);

    console.log(`\nTotal strings modified: ${total}`);

    if (dryRun) {
        console.log('\n[DRY RUN] No files written.');
        console.log('Run without --dry to apply changes.');
    } else {
        // Backup original
        const backupPath = JSON_PATH + '.backup';
        if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(JSON_PATH, backupPath);
            console.log(`\nBackup saved: ${backupPath}`);
        }

        fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));
        console.log(`\nWritten: ${JSON_PATH}`);
        console.log('\nNext step: node edit-text.js repack');
    }
}

main();
