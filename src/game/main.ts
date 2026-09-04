import * as Phaser from 'phaser';
import { AUTO, Events, Game as PhaserGame, Scale, Scene } from 'phaser';

// ---------------------------------------------------------------------------
// GAME CONSTANTS
// ---------------------------------------------------------------------------
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const COLORS = {
    GOLD: 0xffd700,
    GREEN: 0x008751,
    CRIMSON: 0xd21034,
    NAVY: 0x0d1b2a,
    ASPHALT: 0x2b2d42,
    OCHRE: 0xe09f3e,
    CYAN: 0x00f5d4,
    SKY_DAY: '#87c5e8',
    SKY_NIGHT: '#0d1b2a',
    TEXT: '#ffffff',
} as const;

// ---------------------------------------------------------------------------
// EVENT NAMES (shared React <-> Phaser contract — single source of truth)
// ---------------------------------------------------------------------------
export const EV = {
    PHASE: 'phase-changed',
    HUD: 'hud-updated',
    DIALOGUE: 'dialogue-triggered',
    MASK: 'mask-power-activated',
    STOP: 'stop-proximity-changed',
    GARAGE: 'garage-opened',
    PURCHASE: 'purchase-upgrade',
    ENTER_SHRINE: 'enter-shrine-request',
    SHRINE_DONE: 'shrine-completed',
    HORN: 'horn-honked',
    START: 'start-game',
    SCENE_READY: 'current-scene-ready',
} as const;

export type GamePhase =
    | 'BOOT' | 'MENU' | 'PLAYING_DRIVE' | 'GARAGE_HUB' | 'SHRINE_MAP'
    | 'TRANSITION_NIGHT' | 'PLAYING_SHRINE' | 'PAUSED' | 'FINISHED' | 'LEADERBOARD';

export interface MaskDef { id: string; name: string; twi: string; color: number; cooldown: number; desc: string; }

export const MASKS: MaskDef[] = [
    { id: 'sankofa', name: 'Sankofa', twi: 'Sankɔfa', color: 0xffd700, cooldown: 15, desc: 'Time Rewind — recover position & Rep / invuln dash.' },
    { id: 'gyenyame', name: 'Gye Nyame', twi: 'Gye Nyame', color: 0x00f5d4, cooldown: 20, desc: 'Divine Shield — impervious to damage for 6s.' },
    { id: 'okomfo', name: 'Okomfo Anokye', twi: 'Okomfo', color: 0xe09f3e, cooldown: 18, desc: 'Golden Magnet — attract coins & relics in radius.' },
    { id: 'adinkrahene', name: 'Adinkrahene', twi: 'Adinkrahene', color: 0xd21034, cooldown: 25, desc: 'Royal Charisma — double fares & Rep gains 10s.' },
    { id: 'fontomfrom', name: 'Talking Drum', twi: 'Fontomfrom', color: 0x9b5de5, cooldown: 12, desc: 'Sonic Shockwave — clear nearby traffic & stun.' },
    { id: 'yaa', name: 'Yaa Asantewaa', twi: 'Yaa Asantewaa', color: 0x008751, cooldown: 16, desc: 'Warrior Surge — +70% top speed / hyper leap.' },
    { id: 'sikadwa', name: 'Sika Dwa Kofi', twi: 'Golden Stool', color: 0xffb703, cooldown: 30, desc: 'Sovereign Blessing — heal, +250 Sika.' },
];

// ---------------------------------------------------------------------------
// STATE HELPERS
// ---------------------------------------------------------------------------
interface Passenger { dest: number; color: number; }
interface StopDef { x: number; y: number; name: string; }

const DISTRICTS = ['Kejetia Roundabout', 'Central Market', 'Adum Avenue', 'Suame Magazine', 'Bantama', 'Asokwa', 'Manhyia Palace'];

const BANTER = [
    'Driver, make you no pass that traffic o!',
    'Auntie, shift small make I sit!',
    'Chale, this trotro dey fly today!',
    'I dey go Manhyia, abeg no miss my stop.',
    'Radio Kumasi dey blast, turn am up!',
    'My change na — keep am sharp driver.',
];
const PROVERBS: Array<[string, string]> = [
    ['Obi nkyerɛ abɔfra Nyame', 'Nobody teaches a child about God'],
    ['Sankɔfa betuo a, enkyi', 'The Sankofa bird never forgets to look back'],
    ['Nkyinkyim no mu na abɔfra wu', 'A child dies in the rushing about'],
    ['Ɛkyi kakra, ɛbɛyɛ dɔɔso', 'What is little becomes plenty'],
    ['Se ɛte sɛn na ɛte', 'How it is, is how it is'],
];
const RADIO = [
    'Radio Kumasi 99.7 FM — traffic flowing on Adum Avenue!',
    'DJ Kwame here — our driver Chale Rep is climbing high!',
    'Heads up: Mr. Quartey patrol spotted near the roundabout!',
    'Akwasidae festival approaching — keep those passengers moving!',
];

// ---------------------------------------------------------------------------
// EVENT BUS
// ---------------------------------------------------------------------------
export const EventBus = new Events.EventEmitter();

// ---------------------------------------------------------------------------
// PROCEDURAL TEXTURE GENERATION (all sprites drawn in-code, no external files)
// ---------------------------------------------------------------------------
function makeTextures(scene: Scene) {
    const g = scene.add.graphics();
    const tex = scene.textures;

    // Trotro (matatu van) — top-down, kente gold body
    g.clear();
    g.fillStyle(0x1a1a1a).fillRoundedRect(2, 2, 56, 28, 6); // shadow
    g.fillStyle(COLORS.GOLD).fillRoundedRect(0, 0, 56, 28, 6);
    g.fillStyle(COLORS.CRIMSON).fillRect(0, 9, 56, 5); // kente stripe
    g.fillStyle(COLORS.GREEN).fillRect(0, 15, 56, 3);
    g.fillStyle(0x0d1b2a).fillRoundedRect(38, 4, 14, 20, 3); // windshield
    g.fillStyle(0x9ad4ff).fillRoundedRect(40, 6, 10, 16, 2);
    g.fillStyle(0xfff3b0).fillCircle(53, 6, 4).fillCircle(53, 22, 4); // headlights
    g.fillStyle(0x111111).fillRect(8, 0, 8, 3).fillRect(8, 25, 8, 3).fillRect(34, 0, 8, 3).fillRect(34, 25, 8, 3); // wheels
    g.generateTexture('trotro', 56, 28);

    // Traffic car — top-down
    g.clear();
    g.fillStyle(0x111111).fillRoundedRect(1, 1, 42, 22, 5);
    g.fillStyle(0x4a6fa5).fillRoundedRect(0, 0, 42, 22, 5);
    g.fillStyle(0x0d1b2a).fillRect(12, 3, 18, 16);
    g.fillStyle(0xfff3b0).fillCircle(40, 5, 3).fillCircle(40, 17, 3);
    g.generateTexture('car', 42, 22);

    // Police patrol (Mr. Quartey)
    g.clear();
    g.fillStyle(0xffffff).fillRoundedRect(0, 0, 46, 24, 5);
    g.fillStyle(0x0d1b2a).fillRect(0, 9, 46, 6);
    g.fillStyle(0xd21034).fillRect(20, 2, 6, 4);
    g.fillStyle(0x00f5d4).fillRect(26, 2, 6, 4);
    g.fillStyle(0x111111).fillRect(10, 0, 8, 3).fillRect(28, 0, 8, 3).fillRect(10, 21, 8, 3).fillRect(28, 21, 8, 3);
    g.generateTexture('police', 46, 24);

    // Passenger NPC (top-down head + body)
    g.clear();
    g.fillStyle(0x6b4f2a).fillCircle(8, 8, 8); // head
    g.fillStyle(0xe09f3e).fillCircle(8, 7, 5); // face
    g.fillStyle(0xd21034).fillCircle(8, 8, 8); // headwrap
    g.fillStyle(0xffffff).fillCircle(6, 7, 1).fillCircle(10, 7, 1); // eyes
    g.generateTexture('passenger', 16, 16);

    // Stop marker — glowing yellow pad
    g.clear();
    g.fillStyle(0xffd700, 0.35).fillCircle(30, 30, 30);
    g.lineStyle(3, 0xffd700, 1).strokeCircle(30, 30, 24);
    g.fillStyle(0x2b2d42).fillRoundedRect(18, 14, 24, 32, 4);
    g.fillStyle(0xffd700).fillRect(22, 18, 16, 4);
    g.generateTexture('stop', 60, 60);

    // Coin (sika)
    g.clear();
    g.fillStyle(0xb8860b).fillCircle(10, 10, 10);
    g.fillStyle(0xffd700).fillCircle(10, 10, 8);
    g.fillStyle(0xfff3b0).fillCircle(7, 7, 3);
    g.generateTexture('coin', 20, 20);

    // Road tile
    g.clear();
    g.fillStyle(0x3a3d52).fillRect(0, 0, 40, 40);
    g.lineStyle(2, 0x555a72, 0.5).strokeRect(0, 0, 40, 40);
    g.generateTexture('road', 40, 40);

    // Grass / pavement tile
    g.clear();
    g.fillStyle(0x2f6b3f).fillRect(0, 0, 40, 40);
    g.fillStyle(0x357a47).fillRect(0, 0, 40, 6);
    g.generateTexture('grass', 40, 40);

    // Shrine platform tile (stone)
    g.clear();
    g.fillStyle(0x4a4458).fillRect(0, 0, 40, 24);
    g.fillStyle(0x6b6280).fillRect(0, 0, 40, 6);
    g.lineStyle(1, 0x2a2536).strokeRect(0, 0, 40, 24);
    g.generateTexture('stone', 40, 24);

    // Sankofa feather relic (glowing gold feather)
    g.clear();
    g.fillStyle(0xffd700).fillTriangle(10, 0, 20, 20, 0, 20);
    g.fillStyle(0xfff3b0).fillTriangle(10, 4, 16, 18, 6, 18);
    g.generateTexture('feather', 20, 20);

    // Ninja Frog hero — procedural 28x32 multi-part
    g.clear();
    g.fillStyle(0x2f9e44).fillRoundedRect(2, 10, 24, 20, 6); // body
    g.fillStyle(0x69db7c).fillRoundedRect(6, 14, 16, 12, 4); // belly
    g.fillStyle(0x2f9e44).fillCircle(8, 8, 12).fillCircle(20, 8, 12); // eyes
    g.fillStyle(0xffffff).fillCircle(8, 8, 8).fillCircle(20, 8, 8);
    g.fillStyle(0x111111).fillCircle(9, 8, 3).fillCircle(19, 8, 3);
    g.fillStyle(0xd21034).fillRect(2, 16, 24, 3); // headband
    g.fillStyle(0x1a1a1a).fillRect(6, 28, 6, 4).fillRect(16, 28, 6, 4); // feet
    g.generateTexture('frog', 28, 32);

    // Saw trap
    g.clear();
    g.fillStyle(0xadb5bd).fillCircle(19, 19, 19);
    g.fillStyle(0x495057).fillCircle(19, 19, 8);
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.fillStyle(0xced4da).fillTriangle(
            19 + Math.cos(a) * 19, 19 + Math.sin(a) * 19,
            19 + Math.cos(a + 0.2) * 14, 19 + Math.sin(a + 0.2) * 14,
            19 + Math.cos(a - 0.2) * 14, 19 + Math.sin(a - 0.2) * 14,
        );
    }
    g.generateTexture('saw', 38, 38);

    // Golden altar
    g.clear();
    g.fillStyle(0xb8860b).fillRoundedRect(0, 10, 60, 30, 4);
    g.fillStyle(0xffd700).fillRoundedRect(4, 6, 52, 12, 4);
    g.fillStyle(0xfff3b0).fillCircle(30, 12, 10);
    g.generateTexture('altar', 60, 40);

    // Dash trail particle
    g.clear();
    g.fillStyle(0x00f5d4).fillCircle(6, 6, 6);
    g.generateTexture('trail', 12, 12);

    g.destroy();
    void tex;
}

// ---------------------------------------------------------------------------
// AUDIO SYNTHESIS (Web Audio API — horn, chimes)
// ---------------------------------------------------------------------------
class Synth {
    private ctx: AudioContext | null = null;
    private ensure() {
        if (!this.ctx) {
            const AC = (window.AudioContext || (window as any).webkitAudioContext);
            if (AC) this.ctx = new AC();
        }
        return this.ctx;
    }
    private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, delay = 0) {
        const ctx = this.ensure();
        if (!ctx) return;
        const t = ctx.currentTime + delay;
        const o = ctx.createOscillator();
        const gain = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(gain).connect(ctx.destination);
        o.start(t);
        o.stop(t + dur + 0.05);
    }
    honk() { this.tone(440, 0.35, 'sawtooth', 0.18); this.tone(554, 0.35, 'sawtooth', 0.14, 0.05); }
    chime() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, i * 0.06)); }
    gong() { this.tone(180, 1.2, 'sine', 0.25); this.tone(270, 1.0, 'sine', 0.15, 0.05); }
    coin() { this.tone(880, 0.08, 'square', 0.12); this.tone(1320, 0.1, 'square', 0.1, 0.06); }
    jump() { this.tone(300, 0.12, 'square', 0.1); this.tone(600, 0.12, 'square', 0.08, 0.05); }
    click() { this.tone(660, 0.05, 'square', 0.08); }
    radio() { this.tone(400, 0.05, 'sawtooth', 0.06); this.tone(500, 0.05, 'sawtooth', 0.06, 0.07); }
    resume() { const c = this.ensure(); if (c && c.state === 'suspended') c.resume(); }
}
const synth = new Synth();

// ---------------------------------------------------------------------------
// START GAME
// ---------------------------------------------------------------------------
const StartGame = (parent: string) => {
    const config: Phaser.Types.Core.GameConfig = {
        type: AUTO,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        parent,
        backgroundColor: COLORS.SKY_DAY,
        scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
        physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
        scene: [Game],
    };
    const game = new PhaserGame(config);
    if (typeof window !== 'undefined') {
        (window as any).__PHASER_GAME__ = game;
        (window as any).__PHASER_EVENT_BUS__ = EventBus;
    }
    return game;
};

// ---------------------------------------------------------------------------
// THE GAME SCENE — dual mode (drive + shrine platformer)
// ---------------------------------------------------------------------------
export class Game extends Scene {
    private phase: GamePhase = 'MENU';
    private mode: 'drive' | 'shrine' = 'drive';

    // shared world state
    private capacity = 0;
    private maxCapacity = 10;
    private rep = 50;
    private maxRep = 100;
    private sika = 120;
    private akwasidae = 180;
    private health = 100;
    private district = 0;
    private activeMask = 0;
    private maskCd = 0;
    private maskActive = false;
    private maskActiveT = 0;
    private unlocked = 1; // masks unlocked
    private charismax2 = false;
    private shieldOn = false;
    private hornFlash = 0;
    private chaseAlert = false;

    // drive mode
    private trotro!: Phaser.Physics.Arcade.Sprite;
    private stops: StopDef[] = [];
    private stopSprites: Phaser.GameObjects.Image[] = [];
    private passengers: Passenger[] = [];
    private waitingAtStop = 0;
    private nearStopIdx = -1;
    private traffic!: Phaser.Physics.Arcade.Group;
    private police!: Phaser.Physics.Arcade.Sprite | null;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    private roadLayer!: Phaser.GameObjects.Layer;
    private worldW = 2400;
    private worldH = 1400;
    private speed = 0;
    private topSpeed = 280;
    private hornCd = 0;

    // shrine mode
    private frog!: Phaser.Physics.Arcade.Sprite;
    private platforms!: Phaser.Physics.Arcade.StaticGroup;
    private saws!: Phaser.Physics.Arcade.Group;
    private feathers!: Phaser.Physics.Arcade.Group;
    private altar!: Phaser.GameObjects.Image;
    private frogKeys!: Record<string, Phaser.Input.Keyboard.Key>;
    private canDouble = true;
    private dashCd = 0;
    private dashing = 0;
    private shrineWorldW = 2400;
    private shrineWorldH = 1200;
    private relicsGot = 0;
    private relicsTotal = 8;

    private hudTimer = 0;
    private dialogueTimer = 0;
    private transitionT = 0;

    constructor() { super('Game'); }

    create() {
        makeTextures(this);

        // input
        this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E,H,M,G,SHIFT,K,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,ESC') as any;
        this.frogKeys = this.keys;

        // EventBus commands from React
        EventBus.on(EV.START, (opts: { mode?: string }) => this.startRun(opts?.mode));
        EventBus.on(EV.HORN, () => this.honkHorn());
        EventBus.on(EV.PURCHASE, (p: { type: string }) => this.applyUpgrade(p.type));
        EventBus.on(EV.ENTER_SHRINE, () => this.startNightTransition());
        EventBus.on(EV.MASK, (idx: number) => this.activateMask(idx));

        this.events.once('shutdown', () => {
            this.time.removeAllEvents();
            this.tweens.killAll();
            this.input.keyboard?.removeAllListeners();
            EventBus.removeAllListeners();
            this.sound.stopAll();
        });

        this.buildMenu();
        EventBus.emit(EV.SCENE_READY, this);
        this.pushHUD();
    }

    // --------------------------------------------------------------- MENU
    private menuObjs: Phaser.GameObjects.GameObject[] = [];
    private clearWorld() {
        this.menuObjs.forEach(o => o.destroy());
        this.menuObjs = [];
        this.children.removeAll();
        // re-add nothing; scene rebuilds
    }

    private buildMenu() {
        this.mode = 'drive';
        this.cameras.main.setBackgroundColor(COLORS.SKY_DAY);
        const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.NAVY);
        const glow = this.add.rectangle(GAME_WIDTH / 2, 120, 700, 200, COLORS.GOLD, 0.08);
        const title = this.add.text(GAME_WIDTH / 2, 110, 'TROTRO ODYSSEY', { color: '#ffd700', fontFamily: 'Arial Black, Arial', fontSize: '52px', fontStyle: 'bold' }).setOrigin(0.5);
        const sub = this.add.text(GAME_WIDTH / 2, 165, 'Kejetia & The 7 Masks of Asanteman', { color: '#00f5d4', fontFamily: 'Arial', fontSize: '22px' }).setOrigin(0.5);
        const line = this.add.text(GAME_WIDTH / 2, 230, 'Drive the trotro, carry passengers, clear the night shrine.', { color: '#ffffff', fontFamily: 'Arial', fontSize: '15px' }).setOrigin(0.5);
        const ctrls = this.add.text(GAME_WIDTH / 2, 300,
            'WASD / Arrows: Drive   •   E: Load/Unload   •   H: Horn   •   SPACE / 1-7: Mask Power   •   M: Shrine Map   •   G: Garage',
            { color: '#e09f3e', fontFamily: 'Arial', fontSize: '14px', align: 'center', lineSpacing: 6 }).setOrigin(0.5);
        this.menuObjs.push(bg, glow, title, sub, line, ctrls);
        void this.menuObjs;
    }

    private startRun(_mode?: string) {
        synth.resume();
        this.clearWorld();
        this.mode = 'drive';
        this.physics.world.resume();
        this.tweens.resumeAll();
        this.resetRunState();
        this.buildDriveWorld();
        this.setPhase('PLAYING_DRIVE');
    }

    private resetRunState() {
        this.capacity = 0;
        this.rep = 50;
        this.sika = 120;
        this.akwasidae = 180;
        this.health = 100;
        this.district = 0;
        this.activeMask = 0;
        this.maskCd = 0;
        this.maskActive = false;
        this.unlocked = 1;
        this.passengers = [];
        this.relicsGot = 0;
    }

    // --------------------------------------------------------------- DRIVE
    private buildDriveWorld() {
        this.physics.world.gravity.y = 0;
        this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
        this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
        this.cameras.main.setBackgroundColor(COLORS.ASPHALT);

        this.roadLayer = this.add.layer();
        for (let y = 0; y < this.worldH; y += 40) {
            for (let x = 0; x < this.worldW; x += 40) {
                const onRoad = (y % 240 < 120) || (x % 320 < 160);
                this.roadLayer.add(this.add.image(x + 20, y + 20, onRoad ? 'road' : 'grass'));
            }
        }

        // stops placed at intersections
        this.stops = [
            { x: 320, y: 300, name: 'Kejetia Roundabout' },
            { x: 960, y: 660, name: 'Central Market' },
            { x: 1600, y: 300, name: 'Adum Avenue' },
            { x: 640, y: 1020, name: 'Bantama' },
            { x: 1920, y: 1020, name: 'Asokwa' },
            { x: 1280, y: 1260, name: 'Manhyia Palace' },
        ];
        this.stopSprites = this.stops.map(s => this.add.image(s.x, s.y, 'stop').setDepth(1));
        this.stops.forEach((s, i) => {
            this.add.text(s.x, s.y - 40, s.name, { color: '#ffd700', fontFamily: 'Arial', fontSize: '12px' }).setOrigin(0.5).setDepth(2);
            void i;
        });

        // coins scattered
        for (let i = 0; i < 24; i++) {
            this.physics.add.image(
                Phaser.Math.Between(100, this.worldW - 100),
                Phaser.Math.Between(100, this.worldH - 100),
                'coin',
            ).setDepth(1).setData('kind', 'coin');
        }

        // traffic group
        this.traffic = this.physics.add.group();
        for (let i = 0; i < 10; i++) {
            const c = this.traffic.create(Phaser.Math.Between(100, this.worldW - 100), Phaser.Math.Between(100, this.worldH - 100), 'car') as Phaser.Physics.Arcade.Sprite;
            c.setDepth(2).setCollideWorldBounds(true);
            c.setVelocity(Phaser.Math.Between(-60, 60), Phaser.Math.Between(-60, 60));
            c.setData('kind', 'traffic');
        }

        // police (Mr. Quartey)
        this.police = this.physics.add.sprite(this.worldW - 200, 200, 'police').setDepth(3).setCollideWorldBounds(true);
        this.police.setData('kind', 'police');

        // trotro player
        this.trotro = this.physics.add.sprite(200, 200, 'trotro').setDepth(5);
        this.trotro.setCollideWorldBounds(true).setDrag(180).setMaxVelocity(this.topSpeed);
        this.physics.add.collider(this.trotro, this.traffic, this.onTrafficHit, undefined, this);
        this.physics.add.overlap(this.trotro, this.police, this.onPoliceTouch, undefined, this);
        this.physics.add.overlap(this.trotro, this.traffic, undefined, undefined, this);

        this.cameras.main.startFollow(this.trotro, true, 0.08, 0.08);
        this.cameras.main.setZoom(1);
        this.pushHUD();
    }

    private onTrafficHit(_a: any, b: any) {
        if (this.shieldOn) return;
        const car = b as Phaser.Physics.Arcade.Sprite;
        if (!car.active) return;
        this.rep = Math.max(0, this.rep - 6);
        this.health = Math.max(0, this.health - 8);
        this.tweens.add({ targets: this.trotro, angle: { from: -6, to: 6 }, duration: 80, yoyo: true, repeat: 2 });
        car.setTint(0xd21034);
        this.time.delayedCall(200, () => car.clearTint());
        this.pushHUD();
        this.checkFail();
    }

    private onPoliceTouch() {
        if (this.shieldOn) return;
        if (this.speed > this.topSpeed * 0.7) {
            this.rep = Math.max(0, this.rep - 10);
            this.chaseAlert = true;
            this.time.delayedCall(1500, () => { this.chaseAlert = false; this.pushHUD(); });
            this.pushHUD();
            this.checkFail();
        }
    }

    private honkHorn() {
        if (this.hornCd > 0 || this.mode !== 'drive') return;
        synth.honk();
        this.hornCd = 1.2;
        this.hornFlash = 0.4;
        this.rep = Math.min(this.maxRep, this.rep + 2);
        // disperse nearby jaywalkers/traffic
        this.traffic.getChildren().forEach((obj: any) => {
            const d = Phaser.Math.Distance.Between(this.trotro.x, this.trotro.y, obj.x, obj.y);
            if (d < 160) {
                const ang = Math.atan2(obj.y - this.trotro.y, obj.x - this.trotro.x);
                obj.setVelocity(Math.cos(ang) * 220, Math.sin(ang) * 220);
            }
        });
        this.pushHUD();
    }

    private updateDrive(time: number, delta: number) {
        const dt = delta / 1000;
        this.hornCd = Math.max(0, this.hornCd - dt);
        this.hornFlash = Math.max(0, this.hornFlash - dt);
        if (this.maskCd > 0) { this.maskCd -= dt; if (this.maskCd <= 0) { this.maskCd = 0; this.clearMaskEffects(); } }
        if (this.maskActive) { this.maskActiveT -= dt; if (this.maskActiveT <= 0) { this.maskActive = false; this.clearMaskEffects(); } }

        // countdown
        this.akwasidae -= dt;
        if (this.akwasidae <= 0) { this.akwasidae = 0; this.endFestival(); return; }

        // controls
        const k = this.keys;
        const up = k.W.isDown || k.UP.isDown;
        const down = k.S.isDown || k.DOWN.isDown;
        const left = k.A.isDown || k.LEFT.isDown;
        const right = k.D.isDown || k.RIGHT.isDown;

        const accel = 320;
        // top-down: drive along facing angle
        if (up) this.speed = Math.min(this.topSpeed, this.speed + accel * dt);
        else if (down) this.speed = Math.max(-120, this.speed - accel * dt);
        else this.speed *= 0.96;
        if (Math.abs(this.speed) < 4) this.speed = 0;

        const turn = 2.4 * dt * (this.speed !== 0 ? Math.sign(this.speed) : 0);
        if (left) this.trotro.rotation -= turn;
        if (right) this.trotro.rotation += turn;
        this.trotro.setAngle(this.trotro.rotation * 180 / Math.PI);
        const fx = Math.cos(this.trotro.rotation), fy = Math.sin(this.trotro.rotation);
        this.trotro.setVelocity(fx * this.speed, fy * this.speed);
        void time;

        // magnet mask
        if (this.maskActive && this.activeMask === 2) this.attractCoins();

        // proximity to stops
        let near = -1, nd = 90;
        this.stops.forEach((s, i) => {
            const d = Phaser.Math.Distance.Between(this.trotro.x, this.trotro.y, s.x, s.y);
            if (d < nd) { nd = d; near = i; }
        });
        const wasNear = this.nearStopIdx;
        this.nearStopIdx = near;
        if (near !== wasNear) this.emitStop();

        // E to load/unload
        if (Phaser.Input.Keyboard.JustDown(k.E) && near >= 0 && this.speed < 40) {
            this.handleStop(near);
        }

        // police chase AI
        if (this.police) {
            const d = Phaser.Math.Distance.Between(this.trotro.x, this.trotro.y, this.police.x, this.police.y);
            if (d < 420) {
                const ang = Math.atan2(this.trotro.y - this.police.y, this.trotro.x - this.police.x);
                this.police.setVelocity(Math.cos(ang) * 120, Math.sin(ang) * 120);
                this.police.setAngle(this.police.rotation * 180 / Math.PI);
                this.police.rotation = ang;
                if (!this.chaseAlert) { this.chaseAlert = true; this.pushHUD(); }
            } else if (this.chaseAlert) { this.chaseAlert = false; this.pushHUD(); }
        }

        // traffic bounce
        this.traffic.getChildren().forEach((obj: any) => {
            if (obj.x < 40 || obj.x > this.worldW - 40) obj.setVelocityX(-obj.body.velocity.x);
            if (obj.y < 40 || obj.y > this.worldH - 40) obj.setVelocityY(-obj.body.velocity.y);
        });

        // radio banter
        this.dialogueTimer -= dt;
        if (this.dialogueTimer <= 0) {
            this.dialogueTimer = Phaser.Math.Between(8, 14);
            this.triggerRadio();
        }

        // HUD throttle
        this.hudTimer -= dt;
        if (this.hudTimer <= 0) { this.hudTimer = 0.2; this.pushHUD(); }
    }

    private emitStop() {
        if (this.nearStopIdx >= 0) {
            const s = this.stops[this.nearStopIdx];
            const waiting = Phaser.Math.Between(1, 4);
            this.waitingAtStop = waiting;
            EventBus.emit(EV.STOP, { nearStop: true, stopName: s.name, waitingCount: waiting, action: this.capacity >= this.maxCapacity ? 'unload' : 'load' });
        } else {
            EventBus.emit(EV.STOP, { nearStop: false, stopName: '', waitingCount: 0, action: 'load' });
        }
    }

    private handleStop(idx: number) {
        const s = this.stops[idx];
        if (this.capacity > 0 && (this.capacity >= this.maxCapacity || Math.random() < 0.5)) {
            // unload a passenger whose dest matches
            const pi = this.passengers.findIndex(p => p.dest === idx);
            if (pi >= 0) {
                this.passengers.splice(pi, 1);
                this.capacity--;
                const gain = this.charismax2 ? 30 : 15;
                this.rep = Math.min(this.maxRep, this.rep + gain);
                this.sika += 20;
                this.akwasidae += 6;
                this.triggerDialogue('Chale', 'Medaase! Right on time to ' + s.name + '.', undefined, undefined, 20, 'banter');
            } else {
                // generic drop
                this.passengers.pop(); this.capacity--;
                this.rep = Math.min(this.maxRep, this.rep + (this.charismax2 ? 24 : 12));
                this.sika += 15;
            }
        } else if (this.capacity < this.maxCapacity) {
            const load = Math.min(this.waitingAtStop, this.maxCapacity - this.capacity);
            for (let i = 0; i < load; i++) {
                const dest = (idx + Phaser.Math.Between(1, 4)) % this.stops.length;
                this.passengers.push({ dest, color: COLORS.OCHRE });
                this.capacity++;
                const fare = Phaser.Math.Between(15, 30) * (this.charismax2 ? 2 : 1);
                this.sika += fare;
            }
            if (load > 0) {
                const b = BANTER[Phaser.Math.Between(0, BANTER.length - 1)];
                if (Math.random() < 0.4) {
                    const p = PROVERBS[Phaser.Math.Between(0, PROVERBS.length - 1)];
                    this.triggerDialogue('Nana', p[0], p[0], p[1], undefined, 'proverb');
                } else {
                    this.triggerDialogue('Passenger', b, undefined, undefined, undefined, 'banter');
                }
            }
        }
        synth.coin();
        this.emitStop();
        this.pushHUD();
    }

    private attractCoins() {
        this.children.list.forEach(obj => {
            const so = obj as any;
            if (so.getData && so.getData('kind') === 'coin' && so.active) {
                const d = Phaser.Math.Distance.Between(this.trotro.x, this.trotro.y, so.x, so.y);
                if (d < 400) {
                    const ang = Math.atan2(this.trotro.y - so.y, this.trotro.x - so.x);
                    so.x += Math.cos(ang) * 14; so.y += Math.sin(ang) * 14;
                    if (d < 30) { this.sika += 5; so.destroy(); }
                }
            }
        });
    }

    // --------------------------------------------------------------- MASKS
    private activateMask(idx: number) {
        if (idx >= this.unlocked || this.maskCd > 0) return;
        this.activeMask = idx;
        const m = MASKS[idx];
        this.maskCd = m.cooldown;
        this.maskActive = true;
        this.maskActiveT = 6;
        synth.chime();
        EventBus.emit(EV.MASK, { maskId: m.id, duration: 6, effect: m.name });
        switch (m.id) {
            case 'gyenyame': this.shieldOn = true; this.trotro?.setTint(0x00f5d4); this.frog?.setTint(0x00f5d4); break;
            case 'adinkrahene': this.charismax2 = true; this.maskActiveT = 10; break;
            case 'fontomfrom': this.shockwave(); break;
            case 'yaa': this.topSpeed = 420; this.trotro?.setMaxVelocity(420); this.maskActiveT = 8; break;
            case 'sikadwa': this.health = 100; this.sika += 250; this.maskActiveT = 2; break;
            case 'sankofa': this.rep = Math.min(this.maxRep, this.rep + 15); this.maskActiveT = 2; break;
            case 'okomfo': this.maskActiveT = 5; break;
        }
        this.pushHUD();
    }

    private clearMaskEffects() {
        this.shieldOn = false; this.charismax2 = false;
        this.topSpeed = 280;
        this.trotro?.clearTint(); this.frog?.clearTint();
        this.trotro?.setMaxVelocity(this.topSpeed);
    }

    private shockwave() {
        const ring = this.add.circle(this.trotro?.x ?? this.frog?.x ?? 0, this.trotro?.y ?? this.frog?.y ?? 0, 20, 0x9b5de5, 0.3).setDepth(20);
        this.tweens.add({ targets: ring, radius: 240, alpha: 0, scale: 12, duration: 500, onComplete: () => ring.destroy() });
        this.traffic?.getChildren().forEach((obj: any) => {
            const d = Phaser.Math.Distance.Between(ring.x, ring.y, obj.x, obj.y);
            if (d < 240) { const ang = Math.atan2(obj.y - ring.y, obj.x - ring.x); obj.setVelocity(Math.cos(ang) * 260, Math.sin(ang) * 260); obj.setData('stun', 1.5); }
        });
        this.saws?.getChildren().forEach((obj: any) => { if (Phaser.Math.Distance.Between(ring.x, ring.y, obj.x, obj.y) < 240) obj.setData('stun', 2); });
    }

    // --------------------------------------------------------------- NIGHT TRANSITION
    private startNightTransition() {
        if (this.mode === 'shrine') return;
        this.setPhase('TRANSITION_NIGHT');
        this.transitionT = 0;
        synth.gong();
        // keep drive world; tint toward night via camera fade
        this.cameras.main.setBackgroundColor(COLORS.SKY_NIGHT);
        this.tweens.add({
            targets: this.cameras.main,
            duration: 2200,
            onUpdate: (_tw: any, _t: any, _p: any, pn: number) => {
                const lp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
                const rr = lp(0x87, 0x0d, pn), gg = lp(0xc5, 0x1b, pn), bb = lp(0xe8, 0x2a, pn);
                this.cameras.main.setBackgroundColor((rr << 16) | (gg << 8) | bb);
            },
            onComplete: () => this.enterShrine(),
        });
    }

    private enterShrine() {
        this.clearWorld();
        this.mode = 'shrine';
        this.buildShrineWorld();
        this.setPhase('PLAYING_SHRINE');
    }

    // --------------------------------------------------------------- SHRINE PLATFORMER
    private buildShrineWorld() {
        this.physics.world.gravity.y = 850;
        this.shrineWorldW = 2600; this.shrineWorldH = 1200;
        this.physics.world.setBounds(0, 0, this.shrineWorldW, this.shrineWorldH);
        this.cameras.main.setBounds(0, 0, this.shrineWorldW, this.shrineWorldH);
        this.cameras.main.setBackgroundColor(COLORS.SKY_NIGHT);

        // stars
        for (let i = 0; i < 60; i++) this.add.circle(Phaser.Math.Between(0, this.shrineWorldW), Phaser.Math.Between(0, 400), Phaser.Math.Between(1, 2), 0xffffff, Math.random()).setScrollFactor(0.3);

        this.platforms = this.physics.add.staticGroup();
        // ground
        for (let x = 0; x < this.shrineWorldW; x += 40) {
            this.platforms.create(x + 20, this.shrineWorldH - 20, 'stone');
        }
        // floating platforms (reachable: jumpH ~ v^2/2g = 420^2/1700 ≈ 103px, double-jump adds ~85px)
        const plats: Array<[number, number]> = [
            [220, this.shrineWorldH - 100], [420, this.shrineWorldH - 180], [640, this.shrineWorldH - 130],
            [860, this.shrineWorldH - 220], [1080, this.shrineWorldH - 150], [1320, this.shrineWorldH - 240],
            [1560, this.shrineWorldH - 170], [1800, this.shrineWorldH - 260], [2040, this.shrineWorldH - 180],
            [2260, this.shrineWorldH - 120],
        ];
        plats.forEach(([px, py]) => {
            for (let i = 0; i < 3; i++) this.platforms.create(px + i * 40, py, 'stone');
        });

        // saws
        this.saws = this.physics.add.group({ allowGravity: false, immovable: true });
        [500, 980, 1450, 1900].forEach(sx => {
            const s = this.saws.create(sx, this.shrineWorldH - 60, 'saw') as Phaser.Physics.Arcade.Sprite;
            s.setDepth(3).setData('baseY', this.shrineWorldH - 60).setData('phase', Math.random() * 6);
            (s.body as Phaser.Physics.Arcade.Body).setCircle(16);
        });

        // feathers
        this.feathers = this.physics.add.group({ allowGravity: false, immovable: true });
        plats.forEach(([px, py]) => {
            const f = this.feathers.create(px + 40, py - 40, 'feather') as Phaser.Physics.Arcade.Sprite;
            f.setDepth(2);
        });
        this.relicsTotal = this.feathers.countActive(true);
        this.relicsGot = 0;

        // altar at end
        this.altar = this.add.image(this.shrineWorldW - 120, this.shrineWorldH - 80, 'altar').setDepth(2);

        // frog
        this.frog = this.physics.add.sprite(80, this.shrineWorldH - 120, 'frog').setDepth(5);
        this.frog.setCollideWorldBounds(true).setSize(20, 30).setOffset(4, 2);
        this.canDouble = true; this.dashCd = 0; this.dashing = 0;
        this.topSpeed = 280;

        this.physics.add.collider(this.frog, this.platforms, () => {
            const body = (this.frog.body as Phaser.Physics.Arcade.Body); if (body.blocked.down) this.canDouble = true;
        }, undefined, this);
        this.physics.add.overlap(this.frog, this.feathers, this.collectFeather, undefined, this);
        this.physics.add.overlap(this.frog, this.saws, this.onSawHit, undefined, this);
        this.physics.add.collider(this.frog, this.platforms);

        this.cameras.main.startFollow(this.frog, true, 0.1, 0.1);
        this.pushHUD();
    }

    private collectFeather(_a: any, f: any) {
        if (!f.active) return;
        f.disableBody(true, true);
        this.relicsGot++;
        this.sika += 30;
        this.rep = Math.min(this.maxRep, this.rep + 5);
        synth.coin();
        this.pushHUD();
    }

    private onSawHit() {
        if (this.shieldOn) return;
        this.rep = Math.max(0, this.rep - 8);
        this.health = Math.max(0, this.health - 12);
        this.frog.setTint(0xd21034);
        this.frog.setVelocity(0, -260);
        this.time.delayedCall(250, () => this.frog?.clearTint());
        this.pushHUD();
        this.checkFail();
    }

    private updateShrine(time: number, delta: number) {
        const dt = delta / 1000;
        if (this.maskCd > 0) { this.maskCd -= dt; if (this.maskCd <= 0) { this.maskCd = 0; this.clearMaskEffects(); } }
        if (this.maskActive) { this.maskActiveT -= dt; if (this.maskActiveT <= 0) { this.maskActive = false; this.clearMaskEffects(); } }
        this.dashCd = Math.max(0, this.dashCd - dt);
        if (this.dashing > 0) this.dashing -= dt;

        this.akwasidae -= dt;
        if (this.akwasidae <= 0) { this.akwasidae = 0; this.endFestival(); return; }

        const k = this.frogKeys;
        const left = k.A.isDown || k.LEFT.isDown;
        const right = k.D.isDown || k.RIGHT.isDown;
        const runSpeed = (this.maskActive && this.activeMask === 5) ? 420 : 260;
        if (left) { this.frog.setVelocityX(-runSpeed); this.frog.setFlipX(true); }
        else if (right) { this.frog.setVelocityX(runSpeed); this.frog.setFlipX(false); }
        else { this.frog.setVelocityX(this.frog.body!.velocity.x * 0.8); }

        const body = this.frog.body as Phaser.Physics.Arcade.Body;
        const jumpPressed = Phaser.Input.Keyboard.JustDown(k.W) || Phaser.Input.Keyboard.JustDown(k.UP) || Phaser.Input.Keyboard.JustDown(k.SPACE);
        if (jumpPressed) {
            if (body.blocked.down) { this.frog.setVelocityY(-420); this.canDouble = true; synth.jump(); }
            else if (this.canDouble) { this.frog.setVelocityY(-380); this.canDouble = false; this.dashTrail(); synth.jump(); }
        }

        // dash
        if ((Phaser.Input.Keyboard.JustDown(k.SHIFT) || Phaser.Input.Keyboard.JustDown(k.K)) && this.dashCd <= 0) {
            this.dashing = 0.2; this.dashCd = 1.2;
            const dir = this.frog.flipX ? -1 : 1;
            this.frog.setVelocityX(dir * 720);
            this.dashTrail();
        }
        if (this.dashing > 0) { this.dashTrail(); }

        // magnet
        if (this.maskActive && this.activeMask === 2) {
            this.feathers.getChildren().forEach((obj: any) => {
                if (obj.active) { const d = Phaser.Math.Distance.Between(this.frog.x, this.frog.y, obj.x, obj.y); if (d < 400 && d > 20) { const a = Math.atan2(this.frog.y - obj.y, this.frog.x - obj.x); obj.x += Math.cos(a) * 10; obj.y += Math.sin(a) * 10; } }
            });
        }

        // saw motion
        this.saws.getChildren().forEach((obj: any) => {
            obj.rotation += dt * 8;
            const stun = obj.getData('stun') || 0;
            if (stun > 0) { obj.setData('stun', stun - dt); return; }
            obj.y = obj.getData('baseY') + Math.sin(time / 400 + obj.getData('phase')) * 50;
        });

        // reach altar
        if (Phaser.Math.Distance.Between(this.frog.x, this.frog.y, this.altar.x, this.altar.y) < 50) {
            this.completeShrine();
            return;
        }

        this.hudTimer -= dt;
        if (this.hudTimer <= 0) { this.hudTimer = 0.2; this.pushHUD(); }
    }

    private dashTrail() {
        const t = this.add.image(this.frog.x, this.frog.y, 'trail').setDepth(4).setAlpha(0.6);
        this.tweens.add({ targets: t, alpha: 0, scale: 0.2, duration: 300, onComplete: () => t.destroy() });
    }

    private completeShrine() {
        synth.chime();
        this.unlocked = Math.min(MASKS.length, this.unlocked + 1);
        const reward = 300 + this.relicsGot * 20;
        this.sika += reward;
        this.rep = Math.min(this.maxRep, this.rep + 25);
        EventBus.emit(EV.SHRINE_DONE, { shrineId: 'kejetia', sikaReward: reward, repReward: 25, maskUnlocked: MASKS[Math.min(MASKS.length - 1, this.unlocked - 1)].name });
        this.triggerDialogue('Elder', 'The Sankofa Relic is restored! Balance returns to Kumasi.', undefined, undefined, undefined, 'proverb');
        // return to drive
        this.time.delayedCall(1800, () => {
            this.clearWorld();
            this.mode = 'drive';
            this.buildDriveWorld();
            this.cameras.main.setBackgroundColor(COLORS.SKY_DAY);
            this.setPhase('PLAYING_DRIVE');
        });
    }

    // --------------------------------------------------------------- END / FAIL
    private endFestival() {
        if (this.rep >= 70 && this.relicsGot >= this.relicsTotal - 1) {
            this.triggerDialogue('Kumasi', 'AKWASIDAE TRIUMPH! The festival celebrates your sacred service!', undefined, undefined, undefined, 'proverb');
        } else {
            this.triggerDialogue('Elder', 'The festival clock ran out. Chale Rep was not enough.', undefined, undefined, undefined, 'side_event');
        }
        this.setPhase('FINISHED');
    }

    private checkFail() {
        if (this.rep <= 0 || this.health <= 0) {
            this.setPhase('FINISHED');
        }
    }

    // --------------------------------------------------------------- DIALOGUE
    private triggerDialogue(speaker: string, text: string, twi?: string, eng?: string, fare?: number, type: 'banter' | 'proverb' | 'radio' | 'side_event' | 'quartey' = 'banter') {
        EventBus.emit(EV.DIALOGUE, { speaker, text, twiProverb: twi, englishTranslation: eng, fare, type });
    }
    private triggerRadio() {
        synth.radio();
        const r = RADIO[Phaser.Math.Between(0, RADIO.length - 1)];
        this.triggerDialogue('Radio Kumasi 99.7', r, undefined, undefined, undefined, 'radio');
    }

    // --------------------------------------------------------------- UPGRADES
    private applyUpgrade(type: string) {
        if (type === 'capacity' && this.sika >= 100) { this.sika -= 100; this.maxCapacity += 2; }
        if (type === 'engine' && this.sika >= 120) { this.sika -= 120; this.topSpeed += 40; this.trotro?.setMaxVelocity(this.topSpeed); }
        if (type === 'armor' && this.sika >= 80) { this.sika -= 80; this.health = 100; }
        if (type === 'repair' && this.sika >= 40) { this.sika -= 40; this.health = 100; }
        if (type === 'livery') { if (this.sika >= 60) this.sika -= 60; }
        this.pushHUD();
    }

    // --------------------------------------------------------------- PHASE / HUD
    private setPhase(p: GamePhase) {
        this.phase = p;
        EventBus.emit(EV.PHASE, p);
        this.pushHUD();
    }

    private pushHUD() {
        EventBus.emit(EV.HUD, {
            capacity: this.capacity, maxCapacity: this.maxCapacity,
            rep: this.rep, maxRep: this.maxRep,
            sika: this.sika, akwasidae: this.akwasidae,
            district: DISTRICTS[this.district],
            activeMask: MASKS[this.activeMask].name,
            maskCooldown: this.maskCd, maskActive: this.maskActive,
            hornActive: this.hornFlash > 0, chaseAlert: this.chaseAlert,
            health: this.health, mode: this.mode, unlocked: this.unlocked,
            relicsGot: this.relicsGot, relicsTotal: this.relicsTotal,
        });
    }

    // --------------------------------------------------------------- UPDATE LOOP
    update(time: number, delta: number) {
        if (this.phase === 'PLAYING_DRIVE') this.updateDrive(time, delta);
        else if (this.phase === 'PLAYING_SHRINE') this.updateShrine(time, delta);

        // global keys
        const k = this.keys;
        if (k && Phaser.Input.Keyboard.JustDown(k.M) && (this.phase === 'PLAYING_DRIVE' || this.phase === 'SHRINE_MAP')) {
            this.setPhase(this.phase === 'SHRINE_MAP' ? 'PLAYING_DRIVE' : 'SHRINE_MAP');
        }
        if (k && Phaser.Input.Keyboard.JustDown(k.G) && this.phase === 'PLAYING_DRIVE') {
            EventBus.emit(EV.GARAGE, { open: true, sika: this.sika, vehicleLevel: this.maxCapacity, equippedLivery: 'Kente Gold-Royal' });
            this.setPhase('GARAGE_HUB');
        }
        if (k && Phaser.Input.Keyboard.JustDown(k.ESC) && (this.phase === 'PLAYING_DRIVE' || this.phase === 'PLAYING_SHRINE')) {
            this.setPhase('PAUSED');
            this.physics.world.pause(); this.tweens.pauseAll();
        }
        // mask hotkeys
        if (k) {
            ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'].forEach((key, i) => {
                if (Phaser.Input.Keyboard.JustDown(k[key])) this.activateMask(i);
            });
        }
    }

    // called by React to resume from pause
    resumeGame() {
        if (this.phase === 'PAUSED') {
            this.physics.world.resume(); this.tweens.resumeAll();
            this.setPhase(this.mode === 'shrine' ? 'PLAYING_SHRINE' : 'PLAYING_DRIVE');
        }
    }
    closeGarage() { this.setPhase(this.mode === 'shrine' ? 'PLAYING_SHRINE' : 'PLAYING_DRIVE'); }
    closeMap() { this.setPhase('PLAYING_DRIVE'); }
}

export default StartGame;