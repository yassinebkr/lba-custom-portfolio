# Asset Modding Workflow

This document provides a robust workflow for editing game assets and levels, focusing on the Museum Hub room, using the official LBALab tools cloned in your workspace.

## Prerequisites
1. Ensure all repositories are successfully cloned into `tools/`. You should have:
   - `metadata`
   - `lba-packager`
   - `LBAPackEd`
   - `LBArchitect`
2. You have generated your saves via `node scripts/hqr-tools/create-savegame.js --dos` and run `./scripts/build-web-bundle.sh` to have them available.

## Step 1: Identifying the Target Scene
1. Open up `tools/metadata` in your code editor.
2. Locate the scenes file or search for "Museum". The Maritime Museum in LBA1 is generally **Scene 43**.
3. Use the metadata to identify specific Entity and Sprite IDs when you interact with objects in the museum. 

## Step 2: Level Editing with LBArchitect
1. Launch **LBArchitect** (since you are on Windows, you can just run it directly from the repo using Visual Studio or by building it, or downloading the releases).
2. Point it to your `base_game/` output directory where your `SCENE.HQR` resides.
3. Open Scene 43 (Museum).
4. You can edit geometry (adding walls or removing the museum desks), move actors (NPCs), and set new teleport vectors.
5. Save the modified scene. LBArchitect typically exports replacement chunks. 

## Step 3: Modifying Entities with LBAPackEd
If you need to change how Twinsen looks, or swap out museum artifacts for your own portfolio 3D models (Sprites/3D Models):
1. Open **LBAPackEd**.
2. Load up `BODY.HQR`, `ANIM.HQR`, and `SPRITES.HQR`.
3. Locate the museum item models (often static bodies) and replace them with custom isometric sprites or 3D models that represent your projects (e.g., a satellite model for GSAT).
4. Save your modified `BODY.HQR`/`SPRITES.HQR` into `output/`.

## Step 4: Web-Based Packager (lba-packager)
If you want to quickly test repacking without running Node scripts:
1. You can launch `tools/lba-packager`.
2. Open your `base_game/SCENE.HQR` and inject your newly modified Scene 43 from LBArchitect.
3. Export it as `SCENE.HQR` into `output/`.

*Alternatively, use the command-line script:*
```bash
node scripts/hqr-tools/repack-hqr.js scenes
```

## Step 5: Build and Test
1. Make sure all your customized `.HQR` files are currently in `output/`.
2. Run the deployment script to generate the DOS bundle with your saves:
```bash
bash scripts/build-web-bundle.sh
```
3. Test locally in the browser:
```bash
cd web_deploy
npx serve .
```
4. Click "Enter the World", load the "Museum" save, and verify your changes!
