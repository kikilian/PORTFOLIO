// ============================================================
//  GHOST HUNTER — game.js
//  Structure : constantes → carte → état → IA (BFS) →
//              classes Character / Pacman / Ghost →
//              rendu → logique de jeu → contrôles
// ============================================================

// ── Constantes de direction ──────────────────────────────────
const DIRECTION_RIGHT  = 4;
const DIRECTION_UP     = 3;
const DIRECTION_LEFT   = 2;
const DIRECTION_BOTTOM = 1;

// ── Taille d'une case en pixels et cadence ──────────────────
const ONE = 20;   // largeur/hauteur d'une case (px)
const FPS = 30;   // images par seconde

// ── Mode de jeu courant (solo | duo) ────────────────────────
let gameMode = 'solo';

// ============================================================
//  IMAGES PERSONNALISÉES
//  Remplacez les chemins par vos propres fichiers image.
//  Les images doivent être dans le même dossier que index.html.
//  Mettez null pour conserver le dessin par défaut.
//
//  Exemple :
//    const IMG_PACMAN_SRC = 'mon_perso.png';
//    const IMG_GHOST_SRC  = 'mon_fantome.png';
// ============================================================
const IMG_PACMAN_SRC = null;  // ex: 'pacman.png'  — null = dessin par défaut
const IMG_GHOST_SRC  = null;  // ex: 'ghost.png'   — null = dessin par défaut
const IMG_WOLF_SRC   = null;  // ex: 'wolf.png'    — null = dessin par défaut (phase loup)

// Chargement des images (si un chemin est fourni)
function loadImg(src) {
  if (!src) return null;
  const img = new Image();
  img.src = src;
  return img;
}
const imgPacman = loadImg(IMG_PACMAN_SRC);
const imgGhost  = loadImg(IMG_GHOST_SRC);
const imgWolf   = loadImg(IMG_WOLF_SRC);

// ============================================================
//  CARTE DU LABYRINTHE
//  0 = case vide inaccessible (bords extérieurs non jouables)
//  1 = mur
//  2 = boule (point à manger)
//  3 = case vide déjà mangée
// ============================================================
const mapInit = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,2,1],
  [1,2,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,2,1],
  [1,2,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,2,1],
  [1,1,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,1,1],
  [0,0,0,0,1,2,1,2,2,2,2,2,2,2,1,2,1,0,0,0,0],
  [1,1,1,1,1,2,1,2,1,1,2,1,1,2,1,2,1,1,1,1,1],
  [2,2,2,2,2,2,2,2,1,2,2,2,1,2,2,2,2,2,2,2,2],
  [1,1,1,1,1,2,1,2,1,2,2,2,1,2,1,2,1,1,1,1,1],
  [0,0,0,0,1,2,1,2,1,1,1,1,1,2,1,2,1,0,0,0,0],
  [0,0,0,0,1,2,1,2,2,2,2,2,2,2,1,2,1,0,0,0,0],
  [1,1,1,1,1,2,2,2,1,1,1,1,1,2,2,2,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,2,1],
  [1,2,2,2,1,2,2,2,2,2,1,2,2,2,2,2,1,2,2,2,1],
  [1,1,2,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,2,1,1],
  [1,2,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// Copie de travail de la carte (modifiée en cours de partie)
let map;
const COLS = mapInit[0].length;
const ROWS = mapInit.length;

// ── Canvas ───────────────────────────────────────────────────
const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");
canvas.width  = COLS * ONE;
canvas.height = ROWS * ONE + 48; // +48 pour le HUD en bas

// ============================================================
//  ÉTAT DE LA PARTIE
// ============================================================
let score       = 0;
let ghostLives  = 1;
let pacmanLives = 3;
// Phase 'hunt'  : le fantôme (joueur) chasse Pacman (IA)
// Phase 'flee'  : Pacman (IA) chasse le fantôme (joueur)
let phase    = 'hunt';
let gameOver = false;
let pacmanWon= false;
let ghostWon = false;
let flashTimer = 0;   // timer pour le clignotement au changement de phase
let intervalId = null;

// ============================================================
//  UTILITAIRES DE CARTE
// ============================================================

// Retourne true si la case (r,c) est un obstacle (mur ou bord inaccessible)
function isSolid(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
  return map[r][c] === 1 || map[r][c] === 0;
}

// Retourne true si le personnage est parfaitement aligné sur la grille
// (offset pixel dans la case = 0), ce qui autorise un changement de direction
function isAligned(x, y) {
  return (x % ONE === 0) && (y % ONE === 0);
}

// ============================================================
//  ALGORITHME BFS
//  Trouve la première direction à prendre pour aller de
//  (startC, startR) vers (destC, destR) en évitant les murs
//  et éventuellement un ensemble de cases "avoid".
//  Retourne une constante DIRECTION_* ou undefined si inaccessible.
// ============================================================
function bfsDirection(startC, startR, destC, destR, avoid) {
  const visited = new Set();
  const queue   = [{ c: startC, r: startR, firstDir: undefined }];
  visited.add(startR + ',' + startC);

  const neighbors = [
    { dc: -1, dr:  0, dir: DIRECTION_LEFT   },
    { dc:  1, dr:  0, dir: DIRECTION_RIGHT  },
    { dc:  0, dr: -1, dir: DIRECTION_UP     },
    { dc:  0, dr:  1, dir: DIRECTION_BOTTOM },
  ];

  while (queue.length > 0) {
    const cur = queue.shift();

    // Destination atteinte : on retourne la première direction prise
    if (cur.c === destC && cur.r === destR) return cur.firstDir;

    for (const n of neighbors) {
      const nc  = cur.c + n.dc;
      const nr  = cur.r + n.dr;
      const key = nr + ',' + nc;
      if (!isSolid(nr, nc) && !visited.has(key) && !(avoid && avoid.has(key))) {
        visited.add(key);
        queue.push({
          c: nc, r: nr,
          // On mémorise uniquement la première direction empruntée
          firstDir: cur.firstDir !== undefined ? cur.firstDir : n.dir,
        });
      }
    }
  }
  return undefined; // Destination inaccessible
}

// ============================================================
//  CLASSE DE BASE : Character
//  Gère la position pixel, la direction, le mouvement et
//  la détection de collision.
// ============================================================
class Character {
  constructor(x, y, speed) {
    this.x    = x;
    this.y    = y;
    this.speed = speed;
    this.direction     = DIRECTION_RIGHT;
    this.nextDirection = DIRECTION_RIGHT;
  }

  // Colonne de la grille (position en cases)
  get col() { return Math.floor(this.x / ONE); }
  // Ligne de la grille
  get row() { return Math.floor(this.y / ONE); }

  // Teste si un déplacement (dx, dy) depuis la position actuelle
  // heurte un mur (vérifie les 4 coins du sprite)
  checkCollision(dx, dy) {
    const nx = this.x + dx;
    const ny = this.y + dy;
    const corners = [
      [Math.floor(ny / ONE),              Math.floor(nx / ONE)             ],
      [Math.floor((ny + ONE * 0.99) / ONE), Math.floor(nx / ONE)           ],
      [Math.floor(ny / ONE),              Math.floor((nx + ONE * 0.99) / ONE)],
      [Math.floor((ny + ONE * 0.99) / ONE), Math.floor((nx + ONE * 0.99) / ONE)],
    ];
    return corners.some(([r, c]) => isSolid(r, c));
  }

  // Retourne le vecteur (dx, dy) correspondant à une direction
  delta(dir) {
    switch (dir) {
      case DIRECTION_RIGHT:  return [ this.speed, 0           ];
      case DIRECTION_LEFT:   return [-this.speed, 0           ];
      case DIRECTION_UP:     return [ 0,         -this.speed  ];
      case DIRECTION_BOTTOM: return [ 0,          this.speed  ];
    }
    return [0, 0];
  }

  // Déplacement manuel (joueur) :
  // Tente d'abord nextDirection, sinon continue dans direction
  tryMove() {
    // Changer de direction seulement quand le personnage est bien centré
    // dans un couloir (aligné sur la grille) pour éviter de traverser un mur
    if (this.nextDirection !== this.direction && isAligned(this.x, this.y)) {
      const [dx, dy] = this.delta(this.nextDirection);
      if (!this.checkCollision(dx, dy)) this.direction = this.nextDirection;
    }
    const [dx, dy] = this.delta(this.direction);
    if (!this.checkCollision(dx, dy)) { this.x += dx; this.y += dy; }
  }
}

// ============================================================
//  CLASSE : Pacman
//  En mode solo  → toujours piloté par l'IA
//  En mode duo   → toujours piloté par le joueur (ZQSD)
// ============================================================
class Pacman extends Character {
  constructor() {
    super(ONE, ONE, ONE / 5);
    this.mouthOpen = 0;
    this.mouthDir  = 1;
    this.isWolf    = false; // true en phase flee (Pacman devient un loup)

    // Animation de la bouche (indépendante du FPS)
    setInterval(() => {
      this.mouthOpen += this.mouthDir * 0.15;
      if (this.mouthOpen >= 1) { this.mouthOpen = 1; this.mouthDir = -1; }
      if (this.mouthOpen <= 0) { this.mouthOpen = 0; this.mouthDir =  1; }
    }, 50);
  }

  // ── IA Pacman ─────────────────────────────────────────────
  // On recalcule la direction BFS seulement quand Pacman est
  // parfaitement aligné sur une case (x et y multiples de ONE).
  // Entre deux cases, il continue sur son élan sans recalcul,
  // ce qui empêche les blocages contre les murs.
  aiMove() {
    if (isAligned(this.x, this.y)) {
      let dir;

      if (phase === 'flee') {
        // Phase loup : Pacman fonce vers le fantôme (BFS direct)
        dir = bfsDirection(this.col, this.row, ghost.col, ghost.row, null);
      } else {
        // Phase chasse : Pacman cherche la boule la plus proche
        // en évitant une zone de sécurité autour du fantôme
        const avoid = new Set();
        const gr = ghost.row, gc = ghost.col;
        for (let dr = -2; dr <= 2; dr++)
          for (let dc = -2; dc <= 2; dc++)
            avoid.add((gr + dr) + ',' + (gc + dc));

        let bestDir  = undefined;
        let bestDist = Infinity;

        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (map[r][c] === 2) {
              const dist = Math.abs(r - this.row) + Math.abs(c - this.col);
              if (dist < bestDist) {
                const d = bfsDirection(this.col, this.row, c, r, avoid);
                if (d !== undefined) { bestDist = dist; bestDir = d; }
              }
            }
          }
        }

        // Secours : si toutes les boules sont dans la zone d'évitement,
        // relancer le BFS sans restriction pour ne jamais rester bloqué
        if (bestDir === undefined) {
          bestDist = Infinity;
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              if (map[r][c] === 2) {
                const dist = Math.abs(r - this.row) + Math.abs(c - this.col);
                if (dist < bestDist) {
                  const d = bfsDirection(this.col, this.row, c, r, null);
                  if (d !== undefined) { bestDist = dist; bestDir = d; }
                }
              }
            }
          }
        }

        dir = bestDir;
      }

      // Appliquer la direction calculée
      if (dir !== undefined) {
        this.direction     = dir;
        this.nextDirection = dir;
      }
    }

    // Avancer d'un pixel dans la direction courante
    const [dx, dy] = this.delta(this.direction);
    if (!this.checkCollision(dx, dy)) { this.x += dx; this.y += dy; }
  }

  // ── Point d'entrée du mouvement ───────────────────────────
  move() {
    if (gameMode === 'duo') {
      // Duo : Pacman toujours contrôlé par le joueur (ZQSD)
      this.tryMove();
    } else {
      // Solo : Pacman en IA
      this.aiMove();
    }

    // Manger une boule — uniquement en phase hunt
    // (en phase flee, Pacman ne peut plus manger les boules)
    if (phase === 'hunt' && map[this.row][this.col] === 2) {
      map[this.row][this.col] = 3;
      score++;
    }
  }

  // ── Rendu ─────────────────────────────────────────────────
  draw() {
    const cx = this.x + ONE / 2;
    const cy = this.y + ONE / 2;
    const r  = ONE / 2 - 1;

    // Rotation selon la direction pour orienter le sprite
    let rot = 0;
    if (this.direction === DIRECTION_LEFT)   rot = Math.PI;
    if (this.direction === DIRECTION_UP)     rot = -Math.PI / 2;
    if (this.direction === DIRECTION_BOTTOM) rot =  Math.PI / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.translate(-cx, -cy);

    if (this.isWolf) {
      // ── Phase flee : Pacman en rouge-orange ──
      const angleW = Math.PI * 0.15 * this.mouthOpen;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angleW, Math.PI * 2 - angleW);
      ctx.closePath();
      ctx.fillStyle = '#FF4400';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 2, cy - r * 0.4, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#000'; ctx.fill();
    } else {
      // ── Dessin Pacman normal ──
      if (imgPacman && imgPacman.complete) {
        // Image personnalisée Pacman
        ctx.drawImage(imgPacman, this.x, this.y, ONE, ONE);
      } else {
        // Dessin par défaut : camembert jaune avec bouche animée
        const angle = Math.PI * 0.15 * this.mouthOpen;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, angle, Math.PI * 2 - angle);
        ctx.closePath();
        ctx.fillStyle = '#FFD700';
        ctx.fill();

        // Œil
        ctx.beginPath();
        ctx.arc(cx + 2, cy - r * 0.4, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#000'; ctx.fill();
      }
    }

    ctx.restore();
  }
}

// ============================================================
//  CLASSE : Ghost
//  Toujours contrôlé par le joueur (flèches / WASD en solo)
//  dans les deux phases et les deux modes.
// ============================================================
class Ghost extends Character {
  constructor() {
    super(9 * ONE, 10 * ONE, ONE / 5);
    this.color = '#FF0000';
  }


  move() {
    
    this.tryMove();

    
    if (phase === 'flee' && map[this.row][this.col] === 2) {
      map[this.row][this.col] = 3;
      score++;
    }
  }

  draw() {
    const x = this.x, y = this.y, w = ONE, h = ONE;

    
    let col = this.color;
    if (phase === 'flee') {
      col = (flashTimer > 0 && Math.floor(flashTimer / 4) % 2 === 0)
        ? '#fff' : '#4444ff';
    }

    if (imgGhost && imgGhost.complete) {
      
      if (phase === 'flee') {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(imgGhost, x, y, w, h);
    } else {
      // ── Dessin par défaut : silhouette fantôme ──
      ctx.beginPath();
      ctx.fillStyle = col;
      // Demi-cercle du haut
      ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
      // Corps avec dentelure en bas
      ctx.lineTo(x + w, y + h);
      const teeth = 3;
      for (let i = 0; i < teeth; i++) {
        const tx = x + w - (i * w / teeth);
        ctx.lineTo(tx,              y + h    );
        ctx.lineTo(tx - w / (teeth * 2), y + h - 4);
        ctx.lineTo(tx - w / teeth,  y + h    );
      }
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();

      // Yeux blancs avec pupilles bleues orientées selon la direction
      const eyeOffsets = [[w * 0.3, w * 0.4], [w * 0.7, w * 0.4]];
      for (const [ex, ey] of eyeOffsets) {
        ctx.beginPath();
        ctx.ellipse(x + ex, y + ey, 3.5, 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'white'; ctx.fill();

        let px = 0, py = 0;
        if (this.direction === DIRECTION_RIGHT)  px =  1.5;
        if (this.direction === DIRECTION_LEFT)   px = -1.5;
        if (this.direction === DIRECTION_UP)     py = -1.5;
        if (this.direction === DIRECTION_BOTTOM) py =  1.5;

        ctx.beginPath();
        ctx.arc(x + ex + px, y + ey + py, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#00F'; ctx.fill();
      }
    }
  }
}

// ============================================================
//  RENDU DE LA CARTE
// ============================================================
const WW = ONE / 1.6;             // largeur du "tunnel" visuel dans les murs
const WO = (ONE - WW) / 2;       // offset pour centrer ce tunnel

function drawMap() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = map[r][c];
      const x = c * ONE, y = r * ONE;

      if (cell === 1) {
        // ── Mur ──
        ctx.fillStyle = '#342DCA';
        ctx.fillRect(x, y, ONE, ONE);
        // Creuser un tunnel noir entre murs adjacents pour donner
        // un aspect "couloir" plutôt qu'un bloc plein
        ctx.fillStyle = 'black';
        if (c > 0        && map[r][c - 1] === 1) ctx.fillRect(x,      y + WO, WW + WO, WW);
        if (c < COLS - 1 && map[r][c + 1] === 1) ctx.fillRect(x + WO, y + WO, WW + WO, WW);
        if (r < ROWS - 1 && map[r + 1][c] === 1) ctx.fillRect(x + WO, y + WO, WW, WW + WO);
        if (r > 0        && map[r - 1][c] === 1) ctx.fillRect(x + WO, y,      WW, WW + WO);

      } else if (cell === 2) {
        // ── Boule ──
        // Rouge en phase flee (enjeu du fantôme), beige en phase hunt
        ctx.fillStyle = phase === 'flee' ? '#FF6B6B' : '#FEB897';
        ctx.fillRect(x + ONE / 3, y + ONE / 3, ONE / 3, ONE / 3);
      }
      // cell === 3 (case vide) ou 0 (zone inaccessible) → fond noir, rien à dessiner
    }
  }
}

// ============================================================
//  HUD (interface en bas du canvas)
// ============================================================
function drawHUD() {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, ROWS * ONE, canvas.width, 48);

  if (phase === 'hunt') {
    // ── Phase chasse ──
    ctx.fillStyle = 'white';
    ctx.font = '13px \"Space Mono\", monospace';
    ctx.fillText('Score: ' + score, 8, ROWS * ONE + 18);
    ctx.fillText('Vies Pacman: ' + pacmanLives, 170, ROWS * ONE + 18);

   
  } else {
    // ── Phase loup (flee) ──
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 13px \"Space Mono\", monospace';
    ctx.fillText('', 8, ROWS * ONE + 18);

    ctx.fillStyle = 'white';
    ctx.font = '13px \"Space Mono\", monospace';
    ctx.fillText('Boules: ' + map.flat().filter(c => c === 2).length, 140, ROWS * ONE + 18);
    ctx.fillText('Vies: ' + ghostLives, 270, ROWS * ONE + 18);

  

    
  }
}

// ── Écran de fin semi-transparent ───────────────────────────
function drawOverlay(text, sub, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = color;
  ctx.font = 'bold 20px \"Space Mono\", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 16);

  ctx.font = '13px \"Space Mono\", monospace';
  ctx.fillStyle = 'white';
  ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 12);
  ctx.fillText('Appuie sur R pour rejouer — M pour menu', canvas.width / 2, canvas.height / 2 + 34);
  ctx.textAlign = 'left';
}

// ============================================================
//  LOGIQUE DE JEU
// ============================================================

// Remet les personnages à leurs positions de départ
function resetPositions() {
  pacman.x = ONE; pacman.y = ONE;
  pacman.direction = pacman.nextDirection = DIRECTION_RIGHT;
  ghost.x = 9 * ONE; ghost.y = 10 * ONE;
  ghost.direction = ghost.nextDirection = DIRECTION_RIGHT;
}

// Réinitialisation complète (touche R)
function resetAll() {
  map         = mapInit.map(r => r.slice());
  score       = 0;
  pacmanLives = 3;
  ghostLives  = 1;
  phase       = 'hunt';
  gameOver    = false;
  pacmanWon   = false;
  ghostWon    = false;
  flashTimer  = 0;
  pacman.isWolf = false;
  resetPositions();
}

// ── Mise à jour de la logique (appelée chaque frame) ─────────
function update() {
  if (gameOver || pacmanWon || ghostWon) return;
  if (flashTimer > 0) flashTimer--;

  ghost.move();
  pacman.move();

  if (phase === 'hunt') {
    // ── Collision fantôme → Pacman ──
    if (ghost.col === pacman.col && ghost.row === pacman.row) {
      pacmanLives--;
      if (pacmanLives <= 0) { gameOver = true; return; }
      else resetPositions();
    }

    // ── Déclenchement de la phase loup à 100 points ──
    if (score >= 100) {
      phase     = 'flee';
      pacman.isWolf = true;
      // Les vies restantes de Pacman sont transférées au fantôme
      ghostLives = pacmanLives;
      flashTimer = 60; // clignotement pendant ~2 secondes
    }

  } else {
    // ── Phase flee ──

    // Collision Pacman → fantôme : le fantôme perd une vie
    if (ghost.col === pacman.col && ghost.row === pacman.row) {
      ghostLives--;
      if (ghostLives <= 0) {
        gameOver = true; // Pacman a éliminé toutes les vies du fantôme
        return;
      } else {
        resetPositions(); // Le fantôme perd une vie mais continue
      }
    }

    // Le fantôme mange toutes les boules → il gagne
    if (!map.flat().includes(2)) ghostWon = true;
  }
}

// ── Dessin complet d'une frame ────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawMap();
  ghost.draw();
  pacman.draw();
  drawHUD();

  // Écrans de fin
  if (gameOver) {
    if (phase === 'flee')
      drawOverlay('VICTOIRE DE PACMAN ', '', '#FFD700');
    else
      drawOverlay('VICTOIRE DU FANTÔME', '', '#FFD700');
  }
  if (pacmanWon) drawOverlay('VICTOIRE DE PACMAN', '', '#FFD700');
  if (ghostWon)  drawOverlay('VICTOIRE DU FANTÔME', '', '#FFD700');
}

// ============================================================
//  INSTANCES DES PERSONNAGES (créées au lancement)
// ============================================================
let pacman, ghost;

// ── Démarrage d'une partie ────────────────────────────────────
function startGame(mode) {
  gameMode = mode;

  document.getElementById('menu').style.display       = 'none';
  document.getElementById('canvas-wrap').style.display = 'block';
  document.getElementById('info').textContent = mode === 'duo'
    ? 'ZQSD = Pacman  |  Flèches = Fantôme  |  R = rejouer  |  M = menu'
    : 'Flèches / WASD = Fantôme  |  R = rejouer  |  M = menu';

  // Création des personnages et état initial
  pacman = new Pacman();
  ghost  = new Ghost();
  map    = mapInit.map(r => r.slice());
  score  = 0; pacmanLives = 3; ghostLives = 1;
  phase  = 'hunt'; gameOver = false; pacmanWon = false; ghostWon = false; flashTimer = 0;

  // Boucle de jeu
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => { update(); draw(); }, 1000 / FPS);
}

// ============================================================
//  CONTRÔLES CLAVIER
// ============================================================
window.addEventListener('keydown', e => {
  const inGame = document.getElementById('canvas-wrap').style.display !== 'none';
  if (!inGame) return;

  // ── Touches globales ──
  if (e.key === 'r' || e.key === 'R') { resetAll(); return; }
  if (e.key === 'm' || e.key === 'M') {
    document.getElementById('canvas-wrap').style.display = 'none';
    document.getElementById('menu').style.display        = 'flex';
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    return;
  }

  // ── Fantôme : flèches directionnelles (solo ET duo, toutes phases) ──
  switch (e.key) {
    case 'ArrowLeft':  ghost.nextDirection = DIRECTION_LEFT;   e.preventDefault(); break;
    case 'ArrowRight': ghost.nextDirection = DIRECTION_RIGHT;  e.preventDefault(); break;
    case 'ArrowUp':    ghost.nextDirection = DIRECTION_UP;     e.preventDefault(); break;
    case 'ArrowDown':  ghost.nextDirection = DIRECTION_BOTTOM; e.preventDefault(); break;
  }

  if (gameMode === 'duo') {
    // ── Pacman : ZQSD (duo uniquement) ──
    switch (e.key) {
      case 'z': case 'Z': pacman.nextDirection = DIRECTION_UP;    e.preventDefault(); break;
      case 'q': case 'Q': pacman.nextDirection = DIRECTION_LEFT;  e.preventDefault(); break;
      case 's': case 'S': pacman.nextDirection = DIRECTION_BOTTOM;e.preventDefault(); break;
      case 'd': case 'D': pacman.nextDirection = DIRECTION_RIGHT; e.preventDefault(); break;
    }
  } else {
    // ── Solo : WASD en alias pour le fantôme ──
    switch (e.key) {
      case 'w': case 'W': ghost.nextDirection = DIRECTION_UP;    e.preventDefault(); break;
      case 'a': case 'A': ghost.nextDirection = DIRECTION_LEFT;  e.preventDefault(); break;
      case 's': case 'S': ghost.nextDirection = DIRECTION_BOTTOM;e.preventDefault(); break;
      case 'd': case 'D': ghost.nextDirection = DIRECTION_RIGHT; e.preventDefault(); break;
    }
  }
});
