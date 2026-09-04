import { useLayoutEffect, useRef, useState, useEffect, useCallback } from 'react';
import StartGame, { EventBus, EV, MASKS } from './game/main';
import type { GamePhase } from './game/main';

export interface IRefPhaserGame {
    game: Phaser.Game | null;
    scene: Phaser.Scene | null;
}

interface HudState {
    capacity: number; maxCapacity: number;
    rep: number; maxRep: number;
    sika: number; akwasidae: number;
    district: string; activeMask: string;
    maskCooldown: number; maskActive: boolean;
    hornActive: boolean; chaseAlert: boolean;
    health: number; mode: string; unlocked: number;
    relicsGot: number; relicsTotal: number;
}
const DEFAULT_HUD: HudState = {
    capacity: 0, maxCapacity: 10, rep: 50, maxRep: 100, sika: 120,
    akwasidae: 180, district: 'Kejetia Roundabout', activeMask: 'Sankofa',
    maskCooldown: 0, maskActive: false, hornActive: false, chaseAlert: false,
    health: 100, mode: 'drive', unlocked: 1, relicsGot: 0, relicsTotal: 8,
};

interface Dialogue { speaker: string; text: string; twiProverb?: string; englishTranslation?: string; fare?: number; type: string; }
interface StopPrompt { nearStop: boolean; stopName: string; waitingCount: number; action: string; }
interface GarageInfo { open: boolean; sika: number; vehicleLevel: number; equippedLivery: string; }
interface LBEntry { name: string; score: number; date: string; }

const DISTRICTS = [
    { name: 'Kejetia Roundabout', x: 18, y: 58, shrine: true },
    { name: 'Central Market', x: 40, y: 40, shrine: false },
    { name: 'Adum Avenue', x: 62, y: 55, shrine: false },
    { name: 'Suame Magazine', x: 28, y: 78, shrine: false },
    { name: 'Bantama', x: 50, y: 80, shrine: false },
    { name: 'Asokwa', x: 78, y: 72, shrine: false },
    { name: 'Manhyia Palace', x: 82, y: 28, shrine: true },
];

function fmtTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

function MaskIcon({ idx, size = 22 }: { idx: number; size?: number }) {
    const m = MASKS[idx];
    const c = '#' + m.color.toString(16).padStart(6, '0');
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
            <circle cx="16" cy="16" r="14" fill={c} opacity="0.18" />
            <circle cx="16" cy="16" r="13" fill="none" stroke={c} strokeWidth="2" />
            <path d="M9 14c2-3 12-3 14 0-1 6-13 6-14 0z" fill={c} opacity="0.85" />
            <circle cx="12" cy="14" r="1.6" fill="#0d1b2a" />
            <circle cx="20" cy="14" r="1.6" fill="#0d1b2a" />
            <path d="M13 20c2 1.5 4 1.5 6 0" stroke={c} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
    );
}

function CooldownRing({ pct }: { pct: number }) {
    const r = 16, circ = 2 * Math.PI * r;
    return (
        <svg width="40" height="40" viewBox="0 0 40 40" className="cd-ring">
            <circle cx="20" cy="20" r={r} fill="none" stroke="#ffffff22" strokeWidth="3" />
            <circle cx="20" cy="20" r={r} fill="none" stroke="#00f5d4" strokeWidth="3"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
                transform="rotate(-90 20 20)" />
        </svg>
    );
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
        <div className="meter">
            <div className="meter-label">{label}</div>
            <div className="meter-track"><div className="meter-fill" style={{ width: pct + '%', background: color }} /></div>
        </div>
    );
}

function loadLB(): LBEntry[] {
    try { return JSON.parse(localStorage.getItem('trotro_lb') || '[]'); } catch { return []; }
}

export default function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [phase, setPhase] = useState<GamePhase>('MENU');
    const [hud, setHud] = useState<HudState>(DEFAULT_HUD);
    const [dialogue, setDialogue] = useState<Dialogue | null>(null);
    const [prompt, setPrompt] = useState<StopPrompt>({ nearStop: false, stopName: '', waitingCount: 0, action: 'load' });
    const [garage, setGarage] = useState<GarageInfo>({ open: false, sika: 120, vehicleLevel: 10, equippedLivery: 'Kente Gold-Royal' });
    const [showCodex, setShowCodex] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [muted, setMuted] = useState(false);
    const [lb, setLb] = useState<LBEntry[]>([]);
    const [playerName, setPlayerName] = useState('Driver');

    useLayoutEffect(() => {
        if (phaserRef.current === null) {
            const game = StartGame('game-container');
            phaserRef.current = { game, scene: null };
        }
        const handler = (scene: Phaser.Scene) => { if (phaserRef.current) phaserRef.current.scene = scene; };
        EventBus.on(EV.SCENE_READY, handler);
        return () => {
            EventBus.removeListener(EV.SCENE_READY, handler);
            if (phaserRef.current) { phaserRef.current.game?.destroy(true); phaserRef.current = null; }
        };
    }, []);

    useEffect(() => {
        const onPhase = (p: GamePhase) => { setPhase(p); if (p !== 'SHRINE_MAP') setShowMap(false); };
        const onHud = (h: HudState) => setHud(prev => ({ ...prev, ...h }));
        const onDialogue = (d: Dialogue) => { setDialogue(d); };
        const onStop = (s: StopPrompt) => setPrompt(s);
        const onGarage = (g: GarageInfo) => setGarage(g);
        EventBus.on(EV.PHASE, onPhase);
        EventBus.on(EV.HUD, onHud);
        EventBus.on(EV.DIALOGUE, onDialogue);
        EventBus.on(EV.STOP, onStop);
        EventBus.on(EV.GARAGE, onGarage);
        return () => {
            EventBus.removeListener(EV.PHASE, onPhase);
            EventBus.removeListener(EV.HUD, onHud);
            EventBus.removeListener(EV.DIALOGUE, onDialogue);
            EventBus.removeListener(EV.STOP, onStop);
            EventBus.removeListener(EV.GARAGE, onGarage);
        };
    }, []);

    // auto-dismiss dialogue
    useEffect(() => {
        if (!dialogue) return;
        const t = setTimeout(() => setDialogue(null), 5200);
        return () => clearTimeout(t);
    }, [dialogue]);

    // persist leaderboard on finish
    useEffect(() => {
        if (phase === 'FINISHED') {
            const score = Math.round(hud.rep * 10 + hud.sika + hud.relicsGot * 50);
            const entry: LBEntry = { name: playerName || 'Driver', score, date: new Date().toLocaleDateString() };
            const next = [...loadLB(), entry].sort((a, b) => b.score - a.score).slice(0, 8);
            localStorage.setItem('trotro_lb', JSON.stringify(next));
            setLb(next);
        }
    }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

    const startGame = useCallback(() => {
        setDialogue(null); setGarage(g => ({ ...g, open: false }));
        EventBus.emit(EV.START, { mode: 'story' });
    }, []);
    const honk = useCallback(() => EventBus.emit(EV.HORN, { volume: 1 }), []);
    const useMask = useCallback((i: number) => EventBus.emit(EV.MASK, i), []);
    const goShrine = useCallback(() => EventBus.emit(EV.ENTER_SHRINE, {}), []);
    const resume = useCallback(() => { (phaserRef.current?.scene as any)?.resumeGame?.(); }, []);
    const buy = useCallback((type: string) => EventBus.emit(EV.PURCHASE, { type }), []);
    const closeGarage = useCallback(() => { setGarage(g => ({ ...g, open: false })); (phaserRef.current?.scene as any)?.closeGarage?.(); }, []);
    const toggleMute = useCallback(() => {
        const g = phaserRef.current?.game;
        if (g) { g.sound.mute = !g.sound.mute; setMuted(g.sound.mute); }
    }, []);

    const inGame = phase === 'PLAYING_DRIVE' || phase === 'PLAYING_SHRINE' || phase === 'TRANSITION_NIGHT' || phase === 'GARAGE_HUB' || phase === 'SHRINE_MAP' || phase === 'PAUSED';
    const maskPct = hud.maskCooldown > 0 ? 1 - (hud.maskCooldown / (MASKS.find(m => m.name === hud.activeMask)?.cooldown || 1)) : 1;

    return (
        <div id="app">
            <div id="game-container" />

            {/* ---------- PERSISTENT HUD ---------- */}
            {inGame && phase !== 'PAUSED' && (
                <div className="hud-top">
                    <div className="hud-left">
                        <div className="hud-chip"><span className="chip-k">⛽</span>
                            <Bar value={hud.capacity} max={hud.maxCapacity} color="#ffd700" label={`Passengers ${hud.capacity}/${hud.maxCapacity}`} />
                        </div>
                        <div className="hud-chip"><span className="chip-k">🤝</span>
                            <Bar value={hud.rep} max={hud.maxRep} color="#00f5d4" label={`Chale Rep ${Math.round(hud.rep)}`} />
                        </div>
                        <div className="hud-chip"><span className="chip-k">🔧</span>
                            <Bar value={hud.health} max={100} color="#d21034" label={`Trotro ${Math.round(hud.health)}%`} />
                        </div>
                    </div>
                    <div className="hud-center">
                        <div className="akwasidae">
                            <div className="ak-label">AKWASIDAE FESTIVAL</div>
                            <div className={'ak-clock' + (hud.akwasidae < 30 ? ' danger' : '')}>{fmtTime(hud.akwasidae)}</div>
                        </div>
                        <div className="hud-district">{hud.district}{hud.mode === 'shrine' ? ' • NIGHT SHRINE' : ' • DAY'}</div>
                    </div>
                    <div className="hud-right">
                        <div className="sika">₵ {hud.sika}</div>
                        <div className="mask-hud">
                            <div className="mask-icon-wrap">
                                <MaskIcon idx={MASKS.findIndex(m => m.name === hud.activeMask) >= 0 ? MASKS.findIndex(m => m.name === hud.activeMask) : 0} size={34} />
                                <CooldownRing pct={maskPct} />
                            </div>
                            <div className="mask-name">{hud.activeMask}{hud.maskActive ? ' ✦' : ''}</div>
                            <div className="mask-key">SPACE / 1-7</div>
                        </div>
                        <div className="hud-btns">
                            <button className="mini-btn" onClick={toggleMute}>{muted ? '🔇' : '🔊'}</button>
                            <button className="mini-btn" onClick={() => setShowCodex(true)}>🎭</button>
                            <button className="mini-btn" onClick={() => { setShowMap(true); setPhase('SHRINE_MAP'); }}>🗺️</button>
                        </div>
                    </div>
                </div>
            )}

            {/* chase alert */}
            {hud.chaseAlert && inGame && <div className="chase-alert">🚨 MR. QUARTEY PATROL — SLOW DOWN! 🚨</div>}
            {/* horn flash */}
            {hud.hornActive && <div className="horn-flash">HONK!</div>}

            {/* load prompt */}
            {prompt.nearStop && phase === 'PLAYING_DRIVE' && (
                <div className="load-prompt">
                    <span className="key-badge">E</span>
                    {prompt.action === 'unload' ? ` DROP OFF at ${prompt.stopName}` : ` LOAD PASSENGERS (${prompt.waitingCount} waiting)`}
                </div>
            )}

            {/* shrine relic counter */}
            {phase === 'PLAYING_SHRINE' && (
                <div className="relic-counter">🪶 Sankofa Relics {hud.relicsGot}/{hud.relicsTotal}</div>
            )}

            {/* mobile action buttons */}
            {phase === 'PLAYING_DRIVE' && (
                <div className="touch-controls">
                    <button className="touch-btn" onClick={honk}>📯 H</button>
                    <button className="touch-btn" onClick={goShrine}>🌙 Shrine</button>
                    <button className="touch-btn" onClick={() => { setShowMap(true); setPhase('SHRINE_MAP'); }}>🗺️</button>
                    <button className="touch-btn" onClick={() => EventBus.emit(EV.GARAGE, { open: true, sika: hud.sika, vehicleLevel: hud.maxCapacity, equippedLivery: garage.equippedLivery })}>🔧</button>
                </div>
            )}
            {phase === 'PLAYING_SHRINE' && (
                <div className="touch-controls">
                    <button className="touch-btn" onClick={() => useMask(MASKS.findIndex(m => m.name === hud.activeMask))}>🎭 Mask</button>
                    <button className="touch-btn" onClick={toggleMute}>{muted ? '🔇' : '🔊'}</button>
                </div>
            )}

            {/* ---------- DIALOGUE BOX ---------- */}
            {dialogue && (
                <div className={'dialogue type-' + dialogue.type} onClick={() => setDialogue(null)}>
                    <div className="dlg-speaker">{dialogue.speaker}</div>
                    <div className="dlg-text">{dialogue.text}</div>
                    {dialogue.twiProverb && <div className="dlg-proverb">“{dialogue.twiProverb}” — <em>{dialogue.englishTranslation}</em></div>}
                    {dialogue.fare != null && <div className="dlg-fare">+₵{dialogue.fare} fare</div>}
                    <div className="dlg-hint">tap to dismiss</div>
                </div>
            )}

            {/* ---------- MENU ---------- */}
            {phase === 'MENU' && (
                <div className="overlay menu-overlay">
                    <div className="menu-card">
                        <div className="kente-bar" />
                        <h1 className="game-title">TROTRO ODYSSEY</h1>
                        <h2 className="game-sub">Kejetia &amp; The 7 Masks of Asanteman</h2>
                        <p className="menu-blurb">Drive the trotro through Kumasi's Kejetia district, carry passengers, build your Chale Rep, then descend into the night shrine to restore the Sankofa Relic.</p>
                        <div className="menu-controls">
                            <div><b>WASD / Arrows</b> Drive &amp; Steer</div>
                            <div><b>E</b> Load / Unload at stops</div>
                            <div><b>H</b> Trotro Horn</div>
                            <div><b>SPACE / 1-7</b> Mask Powers</div>
                            <div><b>M</b> Shrine Map · <b>G</b> Garage</div>
                            <div><b>SHIFT / K</b> Dash · <b>W/␣</b> Double Jump</div>
                        </div>
                        <button className="big-btn" onClick={startGame}>▶ START JOURNEY</button>
                        <button className="ghost-btn" onClick={() => { setLb(loadLB()); setPhase('LEADERBOARD'); }}>🏆 High Rep Records</button>
                    </div>
                </div>
            )}

            {/* ---------- SHRINE MAP ---------- */}
            {(phase === 'SHRINE_MAP' || showMap) && (
                <div className="overlay map-overlay">
                    <div className="map-card">
                        <div className="panel-head"><h3>🗺️ District Shrine Map — Kumasi</h3>
                            <button className="x-btn" onClick={() => { setShowMap(false); if (phase === 'SHRINE_MAP') (phaserRef.current?.scene as any)?.closeMap?.(); }}>✕</button></div>
                        <div className="map-body">
                            <svg viewBox="0 0 100 100" className="map-svg">
                                <path d="M10 50 Q30 30 50 45 T90 40" stroke="#008751" strokeWidth="1.5" fill="none" opacity="0.6" />
                                <path d="M15 70 Q40 60 60 75 T88 68" stroke="#008751" strokeWidth="1.5" fill="none" opacity="0.6" />
                                <line x1="18" y1="58" x2="40" y2="40" stroke="#ffd700" strokeWidth="0.6" opacity="0.5" />
                                <line x1="40" y1="40" x2="62" y2="55" stroke="#ffd700" strokeWidth="0.6" opacity="0.5" />
                                <line x1="62" y1="55" x2="82" y2="28" stroke="#ffd700" strokeWidth="0.6" opacity="0.5" />
                                <line x1="18" y1="58" x2="28" y2="78" stroke="#ffd700" strokeWidth="0.6" opacity="0.5" />
                                <line x1="28" y1="78" x2="50" y2="80" stroke="#ffd700" strokeWidth="0.6" opacity="0.5" />
                                <line x1="50" y1="80" x2="78" y2="72" stroke="#ffd700" strokeWidth="0.6" opacity="0.5" />
                                {DISTRICTS.map((d, i) => (
                                    <g key={d.name} onClick={() => { if (d.shrine) goShrine(); }} className="map-node">
                                        <circle cx={d.x} cy={d.y} r={d.shrine ? 3.4 : 2.4}
                                            fill={d.shrine ? '#ffd700' : '#e09f3e'} stroke="#0d1b2a" strokeWidth="0.6" />
                                        {d.shrine && <circle cx={d.x} cy={d.y} r="5.5" fill="none" stroke="#00f5d4" strokeWidth="0.5" className="pulse" />}
                                        <text x={d.x} y={d.y - 5} fontSize="3.2" fill="#fff" textAnchor="middle">{d.name}</text>
                                        <text x={d.x} y={d.y + 7} fontSize="2.4" fill="#00f5d4" textAnchor="middle">{i === 0 ? 'ACTIVE' : d.shrine ? 'SHRINE' : 'stop'}</text>
                                    </g>
                                ))}
                            </svg>
                            <div className="map-legend">
                                <div><span className="dot gold" /> Shrine Gateway — tap to enter night mode</div>
                                <div><span className="dot ochre" /> Trotro stop</div>
                            </div>
                        </div>
                        <button className="big-btn" onClick={() => { setShowMap(false); if (phase === 'SHRINE_MAP') (phaserRef.current?.scene as any)?.closeMap?.(); }}>RESUME DRIVE</button>
                    </div>
                </div>
            )}

            {/* ---------- GARAGE ---------- */}
            {phase === 'GARAGE_HUB' && (
                <div className="overlay garage-overlay">
                    <div className="garage-card">
                        <div className="panel-head"><h3>🔧 Suame Magazine Workshop</h3>
                            <button className="x-btn" onClick={closeGarage}>✕</button></div>
                        <div className="garage-sika">Balance: ₵ {hud.sika}</div>
                        <div className="upgrade-grid">
                            <UpgradeCard title="Engine Tune" desc="+40 top speed" cost={120} disabled={hud.sika < 120} onBuy={() => buy('engine')} />
                            <UpgradeCard title="Add Seats" desc="+2 passenger capacity" cost={100} disabled={hud.sika < 100} onBuy={() => buy('capacity')} />
                            <UpgradeCard title="Repair Trotro" desc="Restore 100% health" cost={40} disabled={hud.sika < 40} onBuy={() => buy('repair')} />
                            <UpgradeCard title="Armor Plating" desc="Full heal + durability" cost={80} disabled={hud.sika < 80} onBuy={() => buy('armor')} />
                        </div>
                        <h4 className="livery-title">Kente Livery</h4>
                        <div className="livery-row">
                            {['Kente Gold-Royal', 'Ashanti Green-Gold', 'Adinkra Midnight', 'Rainbow Metro', 'Golden Stool'].map(l => (
                                <button key={l} className={'livery' + (garage.equippedLivery === l ? ' active' : '')}
                                    onClick={() => { setGarage(g => ({ ...g, equippedLivery: l })); buy('livery'); }}>{l}</button>
                            ))}
                        </div>
                        <button className="big-btn" onClick={closeGarage}>LEAVE WORKSHOP</button>
                    </div>
                </div>
            )}

            {/* ---------- MASK CODEX ---------- */}
            {showCodex && (
                <div className="overlay codex-overlay">
                    <div className="codex-card">
                        <div className="panel-head"><h3>🎭 The 7 Sacred Ashanti Masks</h3>
                            <button className="x-btn" onClick={() => setShowCodex(false)}>✕</button></div>
                        <div className="codex-grid">
                            {MASKS.map((m, i) => (
                                <div key={m.id} className={'codex-item' + (i < hud.unlocked ? '' : ' locked')}>
                                    <MaskIcon idx={i} size={30} />
                                    <div className="codex-info">
                                        <div className="codex-name">{i + 1}. {m.name} <span className="twi">({m.twi})</span></div>
                                        <div className="codex-desc">{m.desc}</div>
                                        <div className="codex-cd">Cooldown {m.cooldown}s · Key {i + 1}</div>
                                    </div>
                                    {i < hud.unlocked ? <button className="equip-btn" onClick={() => { useMask(i); }}>EQUIP</button>
                                        : <span className="lock-tag">🔒 Locked</span>}
                                </div>
                            ))}
                        </div>
                        <button className="big-btn" onClick={() => setShowCodex(false)}>CLOSE CODEX</button>
                    </div>
                </div>
            )}

            {/* ---------- PAUSE ---------- */}
            {phase === 'PAUSED' && (
                <div className="overlay pause-overlay">
                    <div className="pause-card">
                        <h3>PAUSED</h3>
                        <div className="pause-stats">Rep {Math.round(hud.rep)} · ₵{hud.sika} · Relics {hud.relicsGot}/{hud.relicsTotal}</div>
                        <button className="big-btn" onClick={resume}>▶ RESUME</button>
                        <button className="ghost-btn" onClick={() => setShowCodex(true)}>🎭 Mask Codex</button>
                        <button className="ghost-btn" onClick={toggleMute}>{muted ? '🔇 Unmute' : '🔊 Mute'}</button>
                        <button className="ghost-btn danger" onClick={startGame}>↻ Restart Journey</button>
                    </div>
                </div>
            )}

            {/* ---------- NIGHT TRANSITION ---------- */}
            {phase === 'TRANSITION_NIGHT' && (
                <div className="overlay night-overlay">
                    <div className="night-text">🌙 Twilight falls over Kejetia…<br /><span>Descending into the Ancient Shrine</span></div>
                </div>
            )}

            {/* ---------- FINISHED ---------- */}
            {phase === 'FINISHED' && (
                <div className="overlay finish-overlay">
                    <div className="finish-card">
                        <h3>{hud.rep >= 70 && hud.relicsGot >= hud.relicsTotal - 1 ? '🎉 AKWASIDAE TRIUMPH!' : '🏁 JOURNEY ENDED'}</h3>
                        <div className="finish-score">Final Score: {Math.round(hud.rep * 10 + hud.sika + hud.relicsGot * 50)}</div>
                        <div className="finish-stats">
                            <div>Chale Rep: {Math.round(hud.rep)}</div>
                            <div>Sika: ₵{hud.sika}</div>
                            <div>Relics: {hud.relicsGot}/{hud.relicsTotal}</div>
                            <div>Masks Unlocked: {hud.unlocked}/7</div>
                        </div>
                        <input className="name-input" value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Your name" />
                        <button className="big-btn" onClick={startGame}>▶ DRIVE AGAIN</button>
                        <button className="ghost-btn" onClick={() => setPhase('LEADERBOARD')}>🏆 Leaderboard</button>
                        <button className="ghost-btn" onClick={() => setPhase('MENU')}>🏠 Menu</button>
                    </div>
                </div>
            )}

            {/* ---------- LEADERBOARD ---------- */}
            {phase === 'LEADERBOARD' && (
                <div className="overlay lb-overlay">
                    <div className="lb-card">
                        <div className="panel-head"><h3>🏆 High Rep Records</h3>
                            <button className="x-btn" onClick={() => setPhase('MENU')}>✕</button></div>
                        <table className="lb-table">
                            <thead><tr><th>#</th><th>Driver</th><th>Score</th><th>Date</th></tr></thead>
                            <tbody>
                                {(lb.length ? lb : loadLB()).map((e, i) => (
                                    <tr key={i}><td>{i + 1}</td><td>{e.name}</td><td>{e.score}</td><td>{e.date}</td></tr>
                                ))}
                                {(!lb.length && !loadLB().length) && <tr><td colSpan={4} className="lb-empty">No records yet — start a journey!</td></tr>}
                            </tbody>
                        </table>
                        <button className="big-btn" onClick={() => setPhase('MENU')}>BACK TO MENU</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function UpgradeCard({ title, desc, cost, disabled, onBuy }: { title: string; desc: string; cost: number; disabled: boolean; onBuy: () => void }) {
    return (
        <div className="upgrade-card">
            <div className="upg-title">{title}</div>
            <div className="upg-desc">{desc}</div>
            <button className="upg-btn" disabled={disabled} onClick={onBuy}>₵{cost}</button>
        </div>
    );
}
