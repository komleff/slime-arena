/**
 * LobbyScreen — экран выбора класса героя
 * Позволяет выбрать класс перед поиском матча
 */

import { useEffect, useRef } from 'preact/hooks';
import { selectedClassId, pushScreen, popScreen } from '../signals/gameState';
import { CLASSES_DATA } from '../data/classes';
import styles from './LobbyScreen.module.css';

export function LobbyScreen() {
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

    const handleBack = () => {
        popScreen();
    };

    const handlePlay = () => {
        // Если класс не выбран, выбираем случайный
        if (selectedClassId.value < 0) {
            const randomIdx = Math.floor(Math.random() * CLASSES_DATA.length);
            selectedClassId.value = CLASSES_DATA[randomIdx].id;
        }
        pushScreen('matchmaking');
    };

    const handleSelectClass = (classId: number) => {
        selectedClassId.value = classId;
    };

    return (
        <div class={styles.lobbyScreen} ref={gameScreenRef}>
            <h1 class={styles.title}>ВЫБЕРИ ГЕРОЯ</h1>

            <div class={styles.cardsContainer}>
                {CLASSES_DATA.map((cls) => (
                    <div
                        key={cls.id}
                        class={`${styles.classCard} ${selectedClassId.value === cls.id ? styles.selected : ''}`}
                        onClick={() => handleSelectClass(cls.id)}
                    >
                        <div class={styles.className}>{cls.name}</div>
                    </div>
                ))}
            </div>

            <div class={styles.controls}>
                <button class={styles.backBtn} onClick={handleBack}>НАЗАД</button>
                <button class={styles.playBtn} onClick={handlePlay}>ИГРАТЬ</button>
            </div>
        </div>
    );
}
