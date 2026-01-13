/**
 * MainScreen — главный экран меню
 * Отображает профиль игрока, валюту и кнопку входа в арену
 */

import { useEffect, useRef } from 'preact/hooks';
import { pushScreen } from '../signals/gameState';
import styles from './MainScreen.module.css';

export function MainScreen() {
    const gameScreenRef = useRef<HTMLDivElement>(null);

    // Логика масштабирования (Fit to Screen)
    useEffect(() => {
        const handleResize = () => {
            if (!gameScreenRef.current) return;

            const targetW = 960;
            const targetH = 540;
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            const scale = Math.min(winW / targetW, winH / targetH);

            gameScreenRef.current.style.transform = `scale(${Math.min(scale, 1.2)})`;
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleArenaClick = () => {
        pushScreen('lobby');
    };

    return (
        <div class={styles.gameScreen} ref={gameScreenRef}>
            {/* HUD PROFILE */}
            <div class={styles.hudProfileWrapper}>
                <div class={styles.hudContainer}>
                    <div class={styles.hudAvatarGroup}>
                        <img src="/assets/hud/hud_avatar_frame_cookie.png" class={styles.frameTop} alt="frame top" />
                        <img src="/assets/hud/hud_avatar_hero_01.png" class={styles.hudAvatarImg} alt="avatar" />
                        <img src="/assets/hud/hud_avatar_frame_cookie.png" class={styles.frameBottom} alt="frame bottom" />
                    </div>
                    <img src="/assets/hud/hud_profile_base_chocolate.png" class={styles.hudBase} alt="base" />
                    <div class={styles.hudStarGroup}>
                        <img src="/assets/hud/hud_level_badge_star_blue.png" class={styles.hudStar} alt="star" />
                        <div class={styles.hudLevelText}>12</div>
                    </div>
                    <div class={styles.hudInfo}>
                        <div class={styles.hudName}>CHEF_BOB</div>
                        <div class={styles.medalsRow}>
                            <div class={styles.medal} style={{ background: '#FFD700' }}></div>
                            <div class={styles.medal} style={{ background: '#C0C0C0' }}></div>
                            <div class={styles.medal} style={{ background: '#E91E63' }}></div>
                        </div>
                    </div>
                    <div class={styles.xpTrack}><div class={styles.xpFill}></div></div>
                </div>
            </div>

            {/* CURRENCY */}
            <div class={styles.currencyPanel}>
                <div class={styles.currItem}>
                    <img src="/assets/icons/icon_currency_coin.png" class={styles.currIconImg} alt="Coins" />
                    <div class={styles.currVal}>1,450</div>
                    <div class={styles.btnAdd}>+</div>
                </div>
                <div class={styles.currItem}>
                    <img src="/assets/icons/icon_currency_gem.png" class={styles.currIconImg} alt="Gems" />
                    <div class={styles.currVal}>85</div>
                    <div class={styles.btnAdd}>+</div>
                </div>
            </div>

            {/* HERO */}
            <div class={styles.heroContainer}>
                <div class={styles.heroFloorShadow}></div>
                <div class={styles.heroModel}></div>
            </div>

            {/* ARENA BUTTON */}
            <div class={styles.playBtnWrapper}>
                <button class={styles.jellyBtn} onClick={handleArenaClick}>
                    <div class={styles.jellyBtnFrame}></div>
                    <div class={styles.jellyBtnContent}>
                        <span class={styles.jellyText}>ARENA</span>
                        <div class={styles.jellyBtnShine}></div>
                    </div>
                </button>
            </div>

            {/* SIDE MENU */}
            <div class={styles.sideMenu}>
                <div class={styles.menuBtn} title="Настройки"><img src="/assets/icons/icon_menu_settings.png" class={styles.menuIconImg} alt="Settings" /></div>
                <div class={styles.menuBtn} title="Лидеры"><img src="/assets/icons/icon_menu_leaderboard.png" class={styles.menuIconImg} alt="Leaderboard" /></div>
                <div class={styles.menuBtn} title="Гардероб"><img src="/assets/icons/icon_menu_skins.png" class={styles.menuIconImg} alt="Skins" /></div>
            </div>
        </div>
    );
}
