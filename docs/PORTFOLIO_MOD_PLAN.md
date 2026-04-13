# LBA1 Portfolio Mod — Implementation Plan

## Vision

Transform LBA1 into an interactive portfolio where visitors explore a shortened game world, discovering your projects through NPC dialogue and themed locations. French voices with English/French text options.

---

## Location Mapping

| Portfolio Section | LBA1 Location | Scene Index | Purpose |
|-------------------|---------------|-------------|---------|
| **Hub / Showroom** | Maritime Museum | TBD | Main portfolio hub, overview of all projects |
| **Personal Intro** | Twinsen's House | 0 | About me, background, welcome message |
| **Electronics Lab** | Proxima Island | TBD | CinePi, PCB design, hardware projects |
| **AI Workshop** | Citadel Old Burg | TBD | OpenClaw, AI agents, automation |
| **Maker Space** | Rebellion Base | TBD | GSAT CubeSat, embedded systems |
| **Production Studio** | Custom area | TBD | Hitson, video production |
| **Contact / Outro** | Clear Water Lake | TBD | Contact info, social links, farewell |

---

## Shortened Timeline

Instead of the full LBA1 story, we create a **"Portfolio Quest"**:

```
START: Wake up in Twinsen's House
  │
  ├─► Meet Zoé (intro NPC) - "Welcome to my portfolio!"
  │
  ├─► Exit to Citadel Island Hub (limited area)
  │     ├─► Maritime Museum (Main Hub) - Project overview
  │     ├─► Electronics Shop → CinePi showcase
  │     └─► Old Burg Building → AI Workshop
  │
  ├─► Ferry to Proxima Island (unlocks after museum visit)
  │     ├─► Maker Space building
  │     └─► Production area
  │
  └─► END: Return home, contact info displayed
```

---

## Dialogue Replacement Strategy

### Text Banks to Modify

| Entry | Language | Bank Name | New Content |
|-------|----------|-----------|-------------|
| 7 | English | dialogue_main | Portfolio NPC dialogues |
| 9 | English | dialogue_extended | Project descriptions |
| 11 | English | dialogue_quest | Quest/navigation hints |
| 13 | English | signs_labels | Location signs, UI text |
| 35-55 | French | (same structure) | French translations |

### Key NPCs to Repurpose

| Original NPC | New Role | Dialogue Focus |
|--------------|----------|----------------|
| Zoé | Partner/Guide | Introduction, navigation help |
| Grobo Guard | Project Guardian | "Unlock" projects by viewing them |
| Shopkeeper | Skill Demonstrator | Technical deep-dives |
| Sailor | Transition Guide | Move between portfolio sections |
| Sendell | Contact/Outro | Contact info, social links |

---

## Voice Recording Plan

### Technical Requirements

- **Format**: Creative VOC (8-bit, 22050Hz mono)
- **Tools**: Record as WAV → Convert to VOC → Pack into VOX HQR
- **Languages**: French primary (authentic), English secondary

### Voice Recording Script Template

```
[VOX Entry Index] - [Scene/Context]
Speaker: [Character Name]
Duration: ~X seconds

"[Dialogue text to record]"
```

### Conversion Pipeline

```
1. Record WAV (44100Hz stereo recommended for quality)
   └─► Audacity, phone recorder, etc.

2. Process WAV
   └─► Downmix to mono
   └─► Resample to 22050Hz
   └─► Convert to 8-bit unsigned

3. Convert to VOC
   └─► Use sox: sox input.wav output.voc
   └─► Or ffmpeg: ffmpeg -i input.wav -ar 22050 -ac 1 -c:a pcm_u8 output.voc

4. Pack into VOX HQR
   └─► Use our Node.js script to replace entries
```

---

## Implementation Phases

### Phase 1: Text Replacement (Current)
- [x] Extract TEXT.HQR to JSON
- [ ] Write portfolio dialogue for English
- [ ] Write portfolio dialogue for French
- [ ] Repack TEXT.HQR
- [ ] Test in game

### Phase 2: Voice Recording
- [ ] Create voice recording scripts
- [ ] Record English voices (or French primary)
- [ ] Convert to VOC format
- [ ] Create VOX packing script
- [ ] Test voice playback

### Phase 3: Scene Simplification
- [ ] Identify which scenes to keep
- [ ] Modify SCENE.HQR to simplify world
- [ ] Block access to unused areas
- [ ] Add custom "teleport" points

### Phase 4: Web Deployment
- [ ] Build js-dos bundle with modded assets
- [ ] Test in browser
- [ ] Deploy to VPS
- [ ] Add landing page with instructions

---

## File Modifications Summary

| File | Modification |
|------|--------------|
| TEXT.HQR | Replace dialogue strings |
| VOX/FR_*.VOX | Replace French voice clips |
| VOX/EN_*.VOX | Replace English voice clips |
| SCENE.HQR | (Optional) Simplify world layout |
| LBA.CFG | (Optional) Default settings |

---

## Voice Recording Schedule

### Priority 1: Essential Dialogues
1. Welcome/Introduction (Zoé)
2. Portfolio overview (Museum NPC)
3. Project descriptions (4 projects × ~3 lines each)
4. Contact/Goodbye

### Priority 2: Atmosphere
5. Navigation hints
6. Flavor dialogue (shop keepers, etc.)
7. Easter eggs

### Recording Tips
- Record in a quiet environment
- Speak clearly, slight accent is authentic
- Keep lines short (5-10 seconds max)
- Leave 0.5s silence at start/end

---

## Tools Required

| Tool | Purpose | Status |
|------|---------|--------|
| Node.js + @lbalab/hqr | HQR extraction/packing | ✅ Ready |
| Audacity / any DAW | Voice recording | Need install |
| sox or ffmpeg | WAV → VOC conversion | Need install |
| DOSBox | Testing | ✅ Ready |
| js-dos | Web deployment | ✅ Ready |

---

## Next Steps

1. **Write dialogue scripts** - Create the actual text for all NPCs
2. **Test text replacement** - Verify modified TEXT.HQR works
3. **Set up audio tools** - Install sox/ffmpeg for VOC conversion
4. **Record test voice** - Try one dialogue, verify it plays
5. **Full voice recording** - Record all dialogues
6. **Build and deploy** - Create js-dos bundle for web

