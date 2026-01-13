/**
 * MatchmakingScreen — экран поиска матча
 * Показывает прогресс поиска и позволяет отменить
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { selectedClassId, popScreen, setGamePhase } from '../signals/gameState';
import { CLASSES_DATA } from '../data/classes';
import styles from './MatchmakingScreen.module.css';

export function MatchmakingScreen() {
    const gameScreenRef = useRef<HTMLDivElement>(null);
    const [timer, setTimer] = useState(0);

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

    // Таймер и симуляция поиска матча
    useEffect(() => {
        const interval = setInterval(() => {
            setTimer(t => t + 1);
        }, 1000);

        // Симуляция нахождения матча через 5 секунд
        const matchTimeout = setTimeout(() => {
            setGamePhase('connecting');
        }, 5000);

        return () => {
            clearInterval(interval);
            clearTimeout(matchTimeout);
        };
    }, []);

    const handleCancel = () => {
        popScreen();
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Получаем имя класса из данных
    const classData = CLASSES_DATA.find(c => c.id === selectedClassId.value);
    const className = classData?.name ?? 'Unknown';

    return (
        <div class={styles.matchmakingScreen} ref={gameScreenRef}>
            <div class={styles.loaderContainer}>
                <div class={styles.spinner}></div>
                <div class={styles.statusText}>SEARCHING FOR OPPONENTS...</div>
                <div class={styles.timer}>{formatTime(timer)}</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', marginTop: '10px', fontFamily: 'Nunito' }}>
                    Class: {className.toUpperCase()}
                </div>
            </div>

            <button class={styles.cancelBtn} onClick={handleCancel}>CANCEL</button>
        </div>
    );
}
