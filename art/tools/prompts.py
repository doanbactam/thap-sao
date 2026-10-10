# Prompt recipe for Tháp Sao characters (art-characters). Used with generate_image + refs:
#   art/raw_chars/ref_chars.jpg (style crop of art/style_ref.jpg) and, for costumes, art/raw_chars/hero_bong.png
STYLE = ("STYLE: flat modern mobile-game cartoon art, thick uniform dark-brown outline (#3B2416) around every shape, "
 "chunky rounded simplified shapes, warm muted pastel palette, soft two-tone cel shading with one darker shadow tone and a "
 "small highlight, no gradients, no texture noise, no realism, cute and readable. Match only the rendering style of the "
 "reference image; do not copy any of its objects or characters.")
VIEW = ("VIEW: full body, 3/4 view from slightly above, body turned and FACING RIGHT, cute chibi proportions with big head, "
 "limbs slightly away from the body so the silhouette is clear.")
SUFFIX_ONE = ("Isolated single subject centered with generous margin, on a solid pure chroma green #00FF00 background. "
 "No cast shadow, no ground, no text, no letters, no watermark.")
SUFFIX_MANY = ("Each creature separate and well spaced in a loose row with wide empty gaps between them, none overlapping, "
 "same scale, all on a solid pure chroma green #00FF00 background. No cast shadow, no ground, no text, no labels, no watermark.")

ENEMY_PREFIX = ("SUBJECT: a set of separate cute-but-hostile chibi enemy creature sprites for a top-down action roguelite, "
 "each a full body, 3/4 view from slightly above, FACING RIGHT, chunky readable silhouette, angry little eyebrows. ")
# enemy batches: (filename, background, list of subject descriptions)
ENEMY_BATCHES = [
 ("en_ch1a.png","magenta",["en_slime_moss: a round wobbly slime blob made of soft olive-sage moss with a tiny pink flower and a small mushroom on top, two dot eyes",
   "en_mushroom_spore: a small walking mushroom creature with a big spotted tan-red cap, stubby legs, puffing a little cloud of yellow spores",
   "en_beetle_charger: a chunky armored rhino beetle with a big curved horn, glossy dark teal shell, six stubby legs, ready to charge"]),
 ("en_ch1b.png","magenta",["en_sprout_archer: a little walking plant sprout creature with two leaves on its head, a bulb body, holding a tiny wooden bow",
   "en_bee_swarm: a tight cluster of three fat fuzzy yellow-and-brown striped bees with tiny stingers, flying together as one group"]),
 ("en_ch2a.png","green",["en_rat_bandit: a grey-brown bandit rat with a red bandana mask and a small curved dagger, sneaky crouch",
   "en_rat_bomber: a grey bandit rat with goggles holding up a round black bomb with a lit fuse",
   "en_rat_shield: a stocky grey rat with a big round wooden plank shield held in front and a little helmet"]),
 ("en_ch2b.png","green",["en_mole_digger: a chubby dark-brown mole with a miner helmet with lamp, big pink digging claws",
   "en_rat_crossbow: a grey bandit rat with a brown leather cap aiming a small wooden crossbow to the right"]),
 ("en_ch3a.png","green",["en_book_flyer: a flying open spellbook monster with paper bat wings, fanged page mouth, purple cover",
   "en_ink_blob: a gooey dark-indigo ink blob creature with big white eyes and drips, small puddle base",
   "en_candle_mage: a little wax candle creature with a lit flame on its head, a tiny purple wizard hat and cloak, holding a small wand"]),
 ("en_ch3b.png","green",["en_mirror_construct: a floating ornate golden-framed oval mirror golem with small stone hands, the glass shows a glint",
   "en_quill_turret: an inkwell turret creature: a round dark ink bottle with eyes and a big feather quill sticking out like a cannon pointing right"]),
 ("en_ch4a.png","green",["en_penguin_slider: a round penguin with a blue scarf sliding on its belly, flippers back",
   "en_ice_spirit: a floating icy wisp spirit made of pale blue ice crystals with a cold glowing face, wispy tail, no legs",
   "en_seal_lobber: a chubby grey-white seal holding a big snowball above its head ready to throw"]),
 ("en_ch4b.png","green",["en_frost_wolf: a fluffy white-and-icy-blue wolf with frosty mane and icicle spikes on its back, snarling, four legs",
   "en_snow_golem_small: a small snow golem made of three lumpy snowballs, stick arms, coal eyes, a little ice crown"]),
 ("en_ch5a.png","green",["en_gear_bot: a small round brass robot built around a big cog wheel, one glowing eye, tiny legs",
   "en_steam_turret: a squat brass-and-copper steam cannon turret on short tripod legs, barrel pointing right, puffing steam",
   "en_raccoon_mechanic: a raccoon in orange overalls and goggles holding a big wrench"]),
 ("en_ch5b.png","green",["en_drone_bomber: a flying brass drone with one propeller on top and a round bomb hanging below, one red eye",
   "en_piston_brute: a big hulking copper robot with huge piston arms, small head, steam vents, heavy stance"]),
 ("en_ch6a.png","green",["en_star_shard: a floating jagged five-point golden-violet crystal star fragment creature with angry eyes",
   "en_void_eye: a floating big eyeball in dark purple-black void goo with small tentacles and starry specks",
   "en_comet_hound: a lean dark-blue space hound with a long flaming comet tail of cyan and gold, running"]),
 ("en_ch6b.png","green",["en_nebula_healer: a floating cosmic jellyfish creature with a translucent pink-violet nebula bell and dangling starry tentacles, glowing heart",
   "en_star_knight: a small dark-navy armored knight with a star-shaped visor glowing gold, a starlight sword and cape"]),
]
