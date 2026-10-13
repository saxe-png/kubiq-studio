# Ako vznikli modely rúk

Hotové modely sú v `public/models/*.glb`. Tieto skripty sú tu len pre prípad, že
budete chcieť zmeniť pózu prstov alebo pridať ďalšiu ruku. Na bežnú úpravu webu
ich netreba.

Potrebné: [Blender](https://www.blender.org) (4.2 alebo novší), Python s balíkom
`mujoco` a Node (na kompresiu).

## Pohyblivé modely (použité na webe)

### Ľudská ruka – `human_arm_rig.glb`

Zdroj: *Human Base Meshes* od Blender Studio (CC0), objekt `GEO-body_male_realistic`,
<https://www.blender.org/download/demo-files/> → Asset Bundles.

```bash
blender -b human_base_meshes_bundle.blend --python build_arm_rig.py -- \
  poses/poses_arm.json public/models/human_arm_rig.glb src/gl/rigs/human_arm.json nahlad.png
```

Skript vezme pravú ruku z realistickej mužskej postavy. Z farebných oblastí modelu
(sculpt face sets) si sám odvodí lakeť, zápästie a kĺby prstov a vyrobí kostru.
Vymodelovaný detail (Multires) zapečie do siete, váhy kostí sa pritom prenesú na
hustú sieť. Výsledok je model s kostrou a JSON s pózami.

`poses_arm.json` obsahuje tri pózy v stupňoch (kladné = ohyb do dlane),
`[základný kĺb, stredný kĺb, koncový kĺb]` pre každý prst:

- `rest` – pokoj (Adamova uvoľnená ruka),
- `idle` – o kúsok viac zovretá; web medzi `rest` a `idle` pomaly „dýcha“,
- `reach` – natiahnutie ukazováka pri dotyku guľôčky.

### Robotická ruka – `robot_sharpa_rig.glb`

Zdroj: [MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie), priečinok `sharpa_wave`.

```bash
cd mujoco_menagerie
python mj_rig_export.py sharpa poses/poses_sharpa.json sharpa_rig          # diely + kĺby + pózy
blender -b --python build_robot_rig.py -- sharpa_rig \
  public/models/robot_sharpa_rig.glb src/gl/rigs/robot_sharpa.json nahlad.png 0.42
#                                                 podiel ponechaných trojuholníkov ┘
```

`build_robot_rig.py` poskladá ruku z kĺbovo spojených dielov a dorobí mechanické
predlaktie: guľový kĺb zápästia s tiahlami, štyri piesty, káble, pancierové panely
s oknom, svetelný pás, kontrolky, vetracie mriežky a skrutky. Rozmery predlaktia
sú na jednom mieste v časti „mechanical forearm“ (napr. `R` = polomer).
Uhly v `poses_sharpa.json` sú v radiánoch, názvy kĺbov z `right_hand.xml`.

Oba modely sa ukladajú s kompresiou Draco priamo z Blenderu a s osou Z nahor;
web ich pri načítaní raz otočí.

## Nehybné modely (alternatívne návrhy rúk)

```bash
blender -b human_base_meshes_bundle.blend --python build_arm.py -- \
  poses/pose_arm_adam.json human_adam.raw.glb nahlad.png

cd mujoco_menagerie
python mj_export.py sharpa poses/pose_sharpa.json sharpa.obj
blender -b --python build_robot.py -- sharpa.obj robot_sharpa.raw.glb nahlad.png 52000 1
```

## Kompresia nehybných modelov

```bash
npx @gltf-transform/cli meshopt robot_sharpa.raw.glb public/models/robot_sharpa.glb --level medium
```

Všetky modely sú uložené rovnako: pravá ruka, prsty mieria doľava, chrbát ruky
hore, palec ku kamere, špička ukazováka v bode [0, 0, 0]. Ľavú ruku web vyrobí
zrkadlením.
